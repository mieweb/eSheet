// Medical compatibility and generic catalog regression coverage.
import { parseShard, searchCatalog, searchShards } from './engine.js';
import {
  rewriteMeta,
  shardFixture,
  type FixtureMeta,
} from './shard.test-fixture.js';

describe('MCDX catalog search', () => {
  it('preserves stable IDs, accents, multiword/prefix/fuzzy search and lazy attributes', () => {
    const shard = parseShard(
      shardFixture([
        {
          id: '001',
          label: 'São Paulo office',
          attributes: { Country: 'BR', Population: '0012' },
        },
        { id: '002', label: 'São Paulo depot', attributes: { Country: 'BR' } },
      ])
    );
    expect(shard.attributesCache).toBeUndefined();
    expect(searchCatalog(shard, 'sao pau', {})).toHaveLength(2);
    expect(searchCatalog(shard, 'paulx', {})[0].id).toBe('001');
    const options = searchCatalog(shard, 'office', {});
    expect(options).toEqual([
      {
        id: '001',
        value: 'São Paulo office',
        attributes: { Country: 'BR', Population: '0012' },
      },
    ]);
    options[0].attributes!.Country = 'changed';
    expect(searchCatalog(shard, 'office', {})[0].attributes?.Country).toBe(
      'BR'
    );
  });

  it('filters before candidate/top-k limits and includes neutral rows', () => {
    const shard = parseShard(
      shardFixture([
        ...Array.from({ length: 160 }, (_, i) => ({
          id: `${i}`,
          label: `Office ${String(i).padStart(3, '0')}`,
          attributes: { Country: 'US' },
        })),
        {
          id: 'wanted',
          label: 'Office Zimbabwe',
          attributes: { Country: 'ZW' },
        },
        { id: 'neutral', label: 'Office global' },
        { id: 'empty', label: 'Office shared', attributes: { Country: '' } },
      ])
    );
    expect(
      searchCatalog(shard, 'office', { Country: 'ZW' })
        .map((o) => o.id)
        .sort()
    ).toEqual(['empty', 'neutral', 'wanted']);
    expect(
      searchCatalog(shard, '', { Country: 'ZW' }).map((o) => o.id)
    ).toEqual(['wanted', 'neutral', 'empty']);
    expect(searchCatalog(shard, '', {})).toHaveLength(20);
    expect(searchCatalog(shard, '', { Country: '' })).toEqual(
      searchCatalog(shard, '', {})
    );
    expect(searchCatalog(shard, '', {}, 0)).toEqual([]);
    expect(searchCatalog(shard, '', {}, 2)).toEqual(
      searchCatalog(shard, '', {}).slice(0, 2)
    );
    expect(() => searchCatalog(shard, '', {}, Infinity)).toThrow('limit');
  });

  it('does not discard filtered prefix candidates beyond the medical expansion cap', () => {
    const shard = parseShard(
      shardFixture(
        Array.from({ length: 160 }, (_, i) => ({
          id: String(i),
          label: `office${String(i).padStart(3, '0')}`,
          attributes: { Country: i === 159 ? 'ZW' : 'US' },
        }))
      )
    );
    expect(
      searchCatalog(shard, 'off', { Country: 'ZW' }).map((r) => r.id)
    ).toEqual(['159']);
  });

  it('supports missing attributes and does not run medical code matching or collapse families', () => {
    const shard = parseShard(
      shardFixture(
        [
          { id: '01', label: 'Depot east', code: '123' },
          { id: '02', label: 'Depot west', code: '123' },
        ],
        { attributes: false }
      )
    );
    expect(searchCatalog(shard, 'depot', { Country: 'US' })).toHaveLength(2);
    expect(searchCatalog(shard, '123', {})).toEqual([]);
    expect(searchCatalog(shard, '', {})[0]).toEqual({
      id: '01',
      value: 'Depot east',
    });
  });

  it.each([1, 2])(
    'accepts medical v%s and preserves code/family behavior',
    (version) => {
      const shard = parseShard(
        shardFixture(
          [
            { id: 'icd-1', label: 'Diabetes mellitus', code: 'E11' },
            {
              id: 'icd-2',
              label: 'Diabetes mellitus with complication',
              code: 'E11.9',
            },
          ],
          { version, medical: true, attributes: false }
        )
      );
      expect(shard.locale).toBe('en');
      expect(searchShards([shard], 'diab')).toHaveLength(2);
      expect(searchShards([shard], 'diab', 20, true)).toHaveLength(1);
      expect(searchShards([shard], 'E11')[0].viaCode).toBe(true);
      expect(
        searchShards([shard], 'diab', 20, false, { billableOnly: true })[0]
          .fullcode
      ).toBe('E11.9');
      expect(() => searchCatalog(shard, '', {})).toThrow('Not a catalog');
    }
  );
});

describe('MCDX validation', () => {
  const fixture = () => shardFixture([{ id: '001', label: 'Office' }]);
  it('rejects truncated headers, metadata, and payloads', () => {
    for (const length of [0, 8, 20, fixture().byteLength - 1])
      expect(() => parseShard(fixture().slice(0, length))).toThrow();
  });
  it.each<[string, (meta: FixtureMeta) => void]>([
    [
      'bounds',
      (m) => {
        m.sections.labelBlob[0] = 0xffffffff;
      },
    ],
    [
      'alignment',
      (m) => {
        m.sections.tokenOffsets[0]++;
      },
    ],
    [
      'count',
      (m) => {
        m.docCount++;
      },
    ],
    [
      'overlap',
      (m) => {
        m.sections.labelBlob[0] = m.sections.tokenBlob[0];
      },
    ],
    [
      'attributes pair',
      (m) => {
        delete m.sections.attributesOffsets;
      },
    ],
  ])('rejects invalid %s', (_, update) => {
    expect(() => parseShard(rewriteMeta(fixture(), update))).toThrow();
  });
  it('rejects invalid offsets and postings before searching', () => {
    for (const section of ['labelOffsets', 'postings', 'docFirstTok']) {
      const buf = fixture();
      rewriteMeta(buf, (meta) => {
        new DataView(buf).setUint32(meta.sections[section][0], 9000, true);
      });
      expect(() => parseShard(buf)).toThrow();
    }
  });
  it('validates attributes lazily and leaves scoring buffers recoverable', () => {
    const shard = parseShard(fixture());
    shard.attributesBlob![0] = '!'.charCodeAt(0);
    expect(() => searchCatalog(shard, 'office', {})).toThrow();
    expect([...shard.maskBuf]).toEqual([0]);
    shard.attributesBlob![0] = '{'.charCodeAt(0);
    expect(searchCatalog(shard, 'office', {})).toHaveLength(1);
  });
});
