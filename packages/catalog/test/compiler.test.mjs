import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import {
  compileCatalogs,
  buildMcdxShard,
  normalize,
} from '../dist/compiler.js';

async function fixture(t, files = {}, catalogs) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'esheet-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'autocomplete');
  await mkdir(directory);
  for (const [file, text] of Object.entries(files)) {
    await writeFile(path.join(directory, file), text);
  }
  if (catalogs !== undefined) {
    await writeFile(
      path.join(directory, 'catalogs.json'),
      JSON.stringify({ schemaVersion: 1, catalogs })
    );
  }
  return {
    root,
    directory,
    compile: () => compileCatalogs({ configRoot: root }),
  };
}

function inspect(payload) {
  const buffer = gunzipSync(payload);
  assert.equal(buffer.readUInt32LE(0), 0x4d434458);
  assert.equal(buffer.readUInt32LE(4), 2);
  const meta = JSON.parse(
    buffer.subarray(12, 12 + buffer.readUInt32LE(8)).toString()
  );
  for (const [offset, length] of Object.values(meta.sections)) {
    assert.equal(offset % 4, 0);
    assert.ok(offset >= 12 + buffer.readUInt32LE(8));
    assert.ok(offset + length <= buffer.length);
  }
  const section = (name) => {
    const [offset, length] = meta.sections[name];
    return buffer.subarray(offset, offset + length);
  };
  const numbers = (name) => {
    const bytes = section(name);
    return Array.from({ length: bytes.length / 4 }, (_, i) =>
      bytes.readUInt32LE(i * 4)
    );
  };
  const strings = (prefix) => {
    const blob = section(`${prefix}Blob`);
    const offsets = numbers(`${prefix}Offsets`);
    assert.equal(offsets[0], 0);
    assert.equal(offsets.at(-1), blob.length);
    return offsets
      .slice(1)
      .map((end, i) => blob.subarray(offsets[i], end).toString());
  };
  const labels = strings('label');
  const ids = strings('fullid');
  const attributes = meta.sections.attributesBlob
    ? strings('attributes').map((value) => JSON.parse(value))
    : labels.map(() => ({}));
  return {
    meta,
    strings,
    numbers,
    section,
    rows: labels.map((label, i) => ({
      label,
      id: ids[i],
      attributes: attributes[i],
    })),
  };
}

test('browser root contains no runtime imports; compiler has a Node-only export', async () => {
  assert.deepEqual(Object.keys(await import('../dist/index.js')), []);
  const pkg = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url))
  );
  assert.deepEqual(Object.keys(pkg.exports['./compiler']), ['node']);

test('discovers single-column CSV/TSV; deterministic gzip, hash and exact API', async (t) => {
  const { compile, directory } = await fixture(t, {
    'Contractors.csv':
      '\uFEFFName\r\n"Café, Inc."\r\n"Multi\r\nline ""name"""\r\n\r\n',
    'People.tsv': 'Person\nZoë\nJosé\n',
    '.DS_Store': 'ignored',
    'README-notes.md': 'ignored',
  });
  const before = await readdir(directory);
  const result = await compile();
  assert.deepEqual(await compile(), result);
  assert.deepEqual(await readdir(directory), before);
  assert.deepEqual(
    result.map((entry) => entry.dataset),
    ['Contractors', 'People']
  );
  for (const item of result) {
    assert.deepEqual(Object.keys(item).sort(), [
      'bytes',
      'dataset',
      'file',
      'locale',
      'payload',
      'rowCount',
      'sha256',
    ]);
    assert.equal(item.locale, 'en');
    assert.equal(item.bytes, item.payload.byteLength);
    assert.equal(
      item.sha256,
      createHash('sha256').update(item.payload).digest('hex')
    );
    assert.equal(item.file, `${item.dataset}.${item.sha256}.mcdx`);
    assert.deepEqual([...item.payload.subarray(0, 2)], [0x1f, 0x8b]);
    const shard = inspect(item.payload);
    assert.equal(shard.meta.catalog, true);
    assert.equal(shard.meta.domain, item.dataset);
    assert.equal(shard.meta.docCount, item.rowCount);
    assert.deepEqual(shard.meta.codetypes, ['catalog']);
    assert.deepEqual(shard.strings('code'), ['', '']);
    assert.ok([...shard.section('docPrior')].every((value) => value === 0));
    assert.ok(shard.numbers('postings').every((value) => (value & 1) === 0));
    assert.equal(shard.meta.sections.attributesBlob, undefined);
  }
  const shard = inspect(result[0].payload);
  assert.deepEqual(shard.strings('label').sort(), [
    'Café, Inc.',
    'Multi\r\nline "name"',
  ]);
  assert.deepEqual(shard.strings('token'), [
    'cafe',
    'inc',
    'line',
    'multi',
    'name',
  ]);
});

const locations = {
  labelColumn: 'Location',
  identityColumns: ['Country', 'Location'],
  searchColumns: ['Location', 'Country'],
  captureColumns: {
    country: 'Country',
    countryName: 'Country',
    population: 'Population',
  },
  attributeValues: { country: { 'United States': 'US', Canada: 'CA' } },
  locale: 'en-US',
  additionalOptions: [{ id: 'off-site', value: 'Off site' }],
};

test('captures exact strings, canonical country aliases and supplemental options', async (t) => {
  const { compile } = await fixture(
    t,
    {
      'Locations.csv':
        'Country,Location,Population\nUnited States,Houston,0023\nCanada,Calgary,4000\n',
    },
    { Locations: locations }
  );
  const [result] = await compile();
  assert.equal(result.rowCount, 3);
  assert.equal(result.locale, 'en-US');
  const shard = inspect(result.payload);
  const houston = shard.rows.find((row) => row.label === 'Houston');
  assert.deepEqual(houston.attributes, {
    country: 'US',
    countryName: 'United States',
    population: '0023',
  });
  assert.deepEqual(
    shard.rows.find((row) => row.id === 'off-site').attributes,
    {}
  );
  assert.ok(shard.strings('token').includes('canada'));
  assert.ok(!shard.strings('token').includes('4000'));
});

test('IDs and payload survive row reorder; population-only edits change hash, not IDs', async (t) => {
  const { compile, directory } = await fixture(
    t,
    {
      'Locations.csv':
        'Country,Location,Population\nUnited States,Houston,0023\nCanada,Calgary,4000\n',
    },
    { Locations: locations }
  );
  const [first] = await compile();
  const source = path.join(directory, 'Locations.csv');
  await writeFile(
    source,
    'Country,Location,Population\nCanada,Calgary,4000\nUnited States,Houston,0023\n'
  );
  assert.deepEqual((await compile())[0], first);
  await writeFile(
    source,
    'Country,Location,Population\nCanada,Calgary,4001\nUnited States,Houston,0023\n'
  );
  const [changed] = await compile();
  assert.notEqual(changed.sha256, first.sha256);
  assert.deepEqual(
    inspect(changed.payload).strings('fullid'),
    inspect(first.payload).strings('fullid')
  );
});

test('headerless TSV, explicit leading-zero IDs and arbitrary search columns', async (t) => {
  const { compile } = await fixture(
    t,
    {
      'Sites.tsv': '0007\tMontréal\t"Québec\tQC"\n0010\tToronto\tOntario\n',
    },
    {
      Sites: {
        columns: ['ID', 'Display', 'Region'],
        idColumn: 'ID',
        labelColumn: 'Display',
        searchColumns: ['Region'],
      },
    }
  );
  const [result] = await compile();
  const shard = inspect(result.payload);
  assert.deepEqual(shard.strings('fullid'), ['0007', '0010']);
  assert.deepEqual(shard.strings('token'), ['ontario', 'qc', 'quebec']);
  assert.ok(!shard.strings('token').includes('montreal'));
});

test('same-size label edits invalidate the content hash', async (t) => {
  const { compile, directory } = await fixture(t, {
    'Names.csv': 'Name\nAlice\n',
  });
  const [before] = await compile();
  await writeFile(path.join(directory, 'Names.csv'), 'Name\nAlise\n');
  const [after] = await compile();
  assert.notEqual(after.sha256, before.sha256);
  assert.notEqual(
    inspect(after.payload).strings('fullid')[0],
    inspect(before.payload).strings('fullid')[0]
  );
});

test('identity is NFC/trim canonical, not lossy search normalization', async (t) => {
  const { compile, directory } = await fixture(t, {
    'Names.csv': 'Name\nCafé\nCafe\nA-B\nA B\n',
  });
  const [before] = await compile();
  assert.equal(before.rowCount, 4);
  await writeFile(path.join(directory, 'Names.csv'), 'Name\n Cafe\u0301 \n');
  const [after] = await compile();
  assert.equal(
    inspect(after.payload).rows[0].id,
    inspect(before.payload).rows.find((row) => row.label === 'Café').id
  );
  assert.equal(normalize(' ÉCOLE / U.S.A. 42 '), 'ecole u s a 42');
});

test('JSON attribute names and original values never use inherited object keys', async (t) => {
  const captures = JSON.parse('{"__proto__":"Name","toString":"Name"}');
  const { compile } = await fixture(
    t,
    { 'Names.csv': 'Name\nconstructor\n' },
    {
      Names: { captureColumns: captures, attributeValues: {} },
    }
  );
  const shard = inspect((await compile())[0].payload);
  assert.deepEqual(
    shard.rows[0].attributes,
    JSON.parse('{"__proto__":"constructor","toString":"constructor"}')
  );
});

const badSources = [
  ['ambiguous columns', 'A,B\nx,y\n', {}, /multi-column.*labelColumn/],
  ['duplicate headers', 'Name,Name\nx,y\n', {}, /duplicate columns/],
  ['empty header', ',Name\nx,y\n', {}, /nonempty string/],
  ['empty source', '', {}, /missing header/],
  ['header only', 'Name\n', {}, /no data rows/],
  [
    'duplicate identity',
    'Name\nSame\nSame\n',
    {},
    /duplicate ID\/identity.*first at/,
  ],
  ['canonical duplicate', 'Name\nSame\n Same \n', {}, /duplicate ID\/identity/],
  [
    'missing column',
    'Name\nx\n',
    { labelColumn: 'Absent' },
    /missing column "Absent"/,
  ],
  [
    'empty label',
    'ID,Name\n001,\n',
    { idColumn: 'ID', labelColumn: 'Name' },
    /line 2.*column "Name".*nonempty/,
  ],
  [
    'empty capture',
    'Name,Country\nx,\n',
    { labelColumn: 'Name', captureColumns: { country: 'Country' } },
    /column "Country".*nonempty/,
  ],
  [
    'empty identity',
    'ID,Name\n,x\n',
    { idColumn: 'ID', labelColumn: 'Name' },
    /column "ID".*nonempty/,
  ],
  ['bad width', 'Name\nx,y\n', {}, /expected 1 columns, received 2/],
  ['unclosed quote', 'Name\n"unclosed\n', {}, /malformed CSV\/TSV/],
  ['invalid quote', 'Name\nx"y\n', {}, /malformed CSV\/TSV/],
  [
    'unknown country',
    'Name,Country\nx,Canada\n',
    {
      labelColumn: 'Name',
      captureColumns: { country: 'Country' },
      attributeValues: { country: { USA: 'US' } },
    },
    /unknown country mapping value "Canada"/,
  ],
  [
    'inherited country',
    'Name,Country\nx,toString\n',
    {
      labelColumn: 'Name',
      captureColumns: { country: 'Country' },
      attributeValues: { country: {} },
    },
    /unknown country mapping value/,
  ],
  [
    'supplement collision',
    'ID,Name\n001,x\n',
    {
      idColumn: 'ID',
      labelColumn: 'Name',
      additionalOptions: [{ id: '001', value: 'Other' }],
    },
    /additionalOptions\[0\].*duplicate/,
  ],
];
for (const [title, text, mapping, error] of badSources) {
  test(`rejects ${title} with actionable source context`, async (t) => {
    const { compile } = await fixture(
      t,
      { 'Items.csv': text },
      { Items: mapping }
    );
    await assert.rejects(compile(), error);
  });
}

const badMappings = [
  [null, /expected an object/],
  [{ labelCol: 'Name' }, /unknown property labelCol/],
  [{ columns: [] }, /nonempty column array/],
  [{ searchColumns: ['Name', 'Name'] }, /duplicate columns/],
  [{ identityColumns: 'Name' }, /nonempty column array/],
  [{ idColumn: 'Name', identityColumns: ['Name'] }, /choose idColumn OR/],
  [{ locale: '../en' }, /invalid literal path segment/],
  [{ locale: '{field:language}' }, /invalid literal path segment/],
  [{ labelColumn: 2 }, /nonempty string/],
  [{ captureColumns: { country: 123 } }, /nonempty string/],
  [{ attributeValues: { country: { USA: 'US' } } }, /not in captureColumns/],
  [
    {
      captureColumns: { country: 'Name' },
      attributeValues: { country: { USA: 1 } },
    },
    /nonempty string/,
  ],
  [{ additionalOptions: {} }, /must be an array/],
  [{ additionalOptions: [{ id: 1, value: 'Item' }] }, /nonempty string/],
  [{ additionalOptions: [{ id: 'x', value: '' }] }, /nonempty string/],
  [
    {
      additionalOptions: [
        { id: 'x', value: 'Item', attributes: { country: null } },
      ],
    },
    /nonempty string/,
  ],
];
for (const [index, [mapping, error]] of badMappings.entries()) {
  test(`validates mapping schema case ${index + 1}`, async (t) => {
    const { compile } = await fixture(
      t,
      { 'Items.csv': 'Name\nx\n' },
      { Items: mapping }
    );
    await assert.rejects(compile(), error);
  });
}

test('validates mapping envelope, JSON and unknown targets', async (t) => {
  const { compile, directory } = await fixture(t, { 'Items.csv': 'Name\nx\n' });
  for (const text of [
    '{',
    '{"schemaVersion":2,"catalogs":{}}',
    '{"schemaVersion":1,"catalogs":[]}',
  ]) {
    await writeFile(path.join(directory, 'catalogs.json'), text);
    await assert.rejects(compile(), /catalogs.json/);
  }
  await writeFile(
    path.join(directory, 'catalogs.json'),
    JSON.stringify({ schemaVersion: 1, catalogs: { Unknown: {} } })
  );
  await assert.rejects(compile(), /unknown mapping target/);
});

test('rejects duplicate stems, unsupported sources, nested folders and unsafe names', async (t) => {
  for (const [files, error] of [
    [
      { 'Sites.csv': 'Name\na\n', 'Sites.tsv': 'Name\nb\n' },
      /duplicate dataset stem/,
    ],
    [{ 'Sites.xlsx': '' }, /unsupported source/],
    [{ 'bad name.csv': 'Name\na\n' }, /invalid literal path segment/],
    [{ 'x{field}.csv': 'Name\na\n' }, /invalid literal path segment/],
    [{ 'a..b.csv': 'Name\na\n' }, /invalid literal path segment/],
  ]) {
    const { compile } = await fixture(t, files);
    await assert.rejects(compile(), error);
  }
  const { compile, directory } = await fixture(t);
  await mkdir(path.join(directory, 'Nested.csv'));
  await assert.rejects(compile(), /expected a regular file/);
});

test('missing autocomplete is empty, but broken symlinks are errors', async (t) => {
  const { compile, directory } = await fixture(t);
  await rm(directory, { recursive: true });
  assert.deepEqual(await compile(), []);
  await symlink(path.join(directory, 'missing'), directory);
  await assert.rejects(compile());
});

for (const target of ['folder', 'mapping', 'source']) {
  test(`rejects ${target} symlink escape from configRoot`, async (t) => {
    const outside = await fixture(t, { 'Items.csv': 'Name\nx\n' }, {});
    const inside = await fixture(t);
    if (target === 'folder') {
      await rm(inside.directory, { recursive: true });
      await symlink(outside.directory, inside.directory);
    } else {
      const name = target === 'mapping' ? 'catalogs.json' : 'Items.csv';
      await symlink(
        path.join(outside.directory, name),
        path.join(inside.directory, name)
      );
    }
    await assert.rejects(inside.compile(), /symlink escapes configRoot/);
  });
}

test('compiles all in memory: later errors do not change any source directory entries', async (t) => {
  const { compile, directory } = await fixture(t, {
    'A.csv': 'Name\nValid\n',
    'Z.csv': 'A,B\nx,y\n',
  });
  const before = await readdir(directory);
  await assert.rejects(compile(), /multi-column/);
  assert.deepEqual(await readdir(directory), before);
  assert.ok(!(await readdir(directory)).some((file) => file.endsWith('.mcdx')));
});

test('writer retains medical alias flags, priors, codetypes and optional attributes', () => {
  const payload = buildMcdxShard({
    domain: 'condition',
    locale: 'en',
    docs: [
      {
        fullid: '001',
        codetype: 'ICD10',
        fullcode: 'J00',
        label: 'Café common cold',
      },
    ],
    aliasGroups: [
      { phrases: ['common cold', 'sniffle'], singleTokens: ['sniffle'] },
    ],
    usageByCode: new Map([['ICD10|J00', 100]]),
    usageMaxCount: 100,
  });
  const shard = inspect(payload);
  assert.equal(shard.meta.catalog, undefined);
  assert.equal(shard.meta.sections.attributesBlob, undefined);
  assert.deepEqual(shard.meta.codetypes, ['ICD10']);
  assert.deepEqual(shard.strings('code'), ['J00']);
  assert.deepEqual(shard.strings('token'), [
    'cafe',
    'cold',
    'common',
    'sniffle',
  ]);
  assert.deepEqual(shard.numbers('postings'), [0, 0, 0, 1]);
  assert.deepEqual([...shard.section('docPrior')], [255]);
});

// Optional exact-byte parity check against an existing codify checkout. No
// sibling dependency is required for normal package tests or published builds.
test(
  'medical payload equals the original codify writer bytes',
  {
    skip: !process.env.CODIFY_WRITER,
  },
  async (t) => {
    const { root } = await fixture(t);
    const input = path.join(root, 'input.tsv');
    const aliases = path.join(root, 'aliases.json');
    const usage = path.join(root, 'usage.tsv');
    const absent = path.join(root, 'absent');
    const docs = [
      {
        fullid: '001',
        codetype: 'ICD10',
        fullcode: 'J00',
        label: 'Café common cold',
      },
      {
        fullid: '002',
        codetype: 'SNOMED US',
        fullcode: '123',
        label: 'Cold syndrome',
      },
    ];
    await writeFile(
      input,
      docs
        .map((doc) =>
          [doc.fullid, doc.codetype, doc.fullcode, doc.label].join('\t')
        )
        .join('\n')
    );
    await writeFile(
      aliases,
      JSON.stringify({ groups: [['common cold', 'sniffle']] })
    );
    await writeFile(
      usage,
      'condition\tcode\tICD10|J00\t1\ncondition\tphrase\tcold syndrome\t2\n'
    );
    const result = spawnSync(
      process.execPath,
      [
        process.env.CODIFY_WRITER,
        '--in',
        input,
        '--out',
        root,
        '--aliases',
        aliases,
        '--usage',
        usage,
        '--extra',
        absent,
        '--extra2',
        absent,
        '--programs',
        absent,
      ],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    const original = await readFile(path.join(root, 'en', 'condition.mcdx'));
    const extracted = buildMcdxShard({
      domain: 'condition',
      locale: 'en',
      docs,
      aliasGroups: [
        { phrases: ['common cold', 'sniffle'], singleTokens: ['sniffle'] },
      ],
      usageByCode: new Map([['ICD10|J00', 1_000_000]]),
      usagePhrases: [{ phrase: ' cold syndrome ', count: 500_000 }],
      usageMaxCount: 1_000_000,
    });
    assert.deepEqual(Buffer.from(extracted), original);
  }
);
