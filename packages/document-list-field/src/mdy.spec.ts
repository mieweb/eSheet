import { describe, expect, it } from 'vitest';

import {
  mdyBody,
  parseMdy,
  serializeMdy,
  withMdyBody,
  withMdyFrontMatter,
} from './mdy.js';

const LETTER = `---
docType: acknowledgement
definition: acknowledgement
definitionVersion: '1'
response:
  recipient: { answer: Jane Doe }   # kept as flow style on purpose
  sent_on: { answer: '2026-08-23' }
---
# Acknowledgement

Dear Jane, we received your report.
`;

describe('parseMdy', () => {
  it('splits front matter from the body', () => {
    const file = parseMdy(LETTER);

    expect(file.frontMatter).toMatchObject({
      docType: 'acknowledgement',
      definition: 'acknowledgement',
      definitionVersion: '1',
      response: {
        recipient: { answer: 'Jane Doe' },
        sent_on: { answer: '2026-08-23' },
      },
    });
    expect(file.body).toBe(
      '# Acknowledgement\n\nDear Jane, we received your report.\n'
    );
  });

  it('keeps front matter out of the editor', () => {
    expect(mdyBody(LETTER)).not.toContain('docType');
    expect(mdyBody(LETTER).startsWith('# Acknowledgement')).toBe(true);
  });

  it('treats a document without front matter as all body — the note tier', () => {
    const note = 'Called the employee, no answer.\n';
    const file = parseMdy(note);

    expect(file.frontMatter).toBeNull();
    expect(file.frontMatterSource).toBe('');
    expect(file.body).toBe(note);
  });

  it('reads an empty block', () => {
    const file = parseMdy('---\n---\nBody.\n');

    expect(file.frontMatter).toBeNull();
    expect(file.frontMatterSource).toBe('---\n---\n');
    expect(file.body).toBe('Body.\n');
  });

  it('does not mistake a leading horizontal rule for front matter', () => {
    const ruled = '---\n\nA note that opens with a rule.\n';

    expect(parseMdy(ruled).frontMatterSource).toBe('');
    expect(parseMdy(ruled).body).toBe(ruled);
  });

  it('degrades to the note tier when the YAML is unparseable', () => {
    // An unquoted UCUM code — the pitfall the MDY spec calls out.
    const broken = '---\nresponse: { unit: mm[Hg] }\n---\nBody.\n';
    const file = parseMdy(broken);

    expect(file.frontMatter).toBeNull();
    // ...but the bytes are still carried, so nothing is lost on save.
    expect(serializeMdy(file)).toBe(broken);
  });

  it('ignores a YAML block that is not a mapping', () => {
    const file = parseMdy('---\n- one\n- two\n---\nBody.\n');

    expect(file.frontMatter).toBeNull();
    expect(file.body).toBe('Body.\n');
  });
});

describe('round-trip', () => {
  it.each([
    ['a letter', LETTER],
    ['a bare note', 'Just prose.\n'],
    ['no trailing newline', '---\ndocType: note\n---\nBody without newline'],
    ['CRLF line endings', '---\r\ndocType: note\r\n---\r\nBody.\r\n'],
    ['an empty document', ''],
    ['a body containing a rule', '---\ndocType: note\n---\nA\n\n---\n\nB\n'],
  ])('is byte-for-byte identical for %s', (_name, text) => {
    expect(serializeMdy(parseMdy(text))).toBe(text);
  });

  it('survives an editor that only touches the prose', () => {
    // What the compose panel does: strip, hand the body to Kerebron, take the
    // markdown back, re-attach. Kerebron never sees the YAML.
    const file = parseMdy(LETTER);
    const edited = withMdyBody(file, `${file.body}\nCall us with questions.\n`);

    expect(serializeMdy(edited)).toBe(
      `${LETTER}\nCall us with questions.\n`
    );
    // The data layer is untouched, comments and flow style included.
    expect(serializeMdy(edited)).toContain(
      '  recipient: { answer: Jane Doe }   # kept as flow style on purpose'
    );
  });
});

describe('withMdyFrontMatter', () => {
  it('writes a block onto a document that had none', () => {
    const file = withMdyFrontMatter(parseMdy('Body.\n'), {
      docType: 'note',
      response: { title: { answer: 'Hello' } },
    });

    expect(serializeMdy(file)).toBe(
      '---\ndocType: note\nresponse:\n  title:\n    answer: Hello\n---\nBody.\n'
    );
    expect(parseMdy(serializeMdy(file)).frontMatter).toEqual(file.frontMatter);
  });

  it('drops the block when there is no data left', () => {
    const file = withMdyFrontMatter(parseMdy(LETTER), null);

    expect(file.frontMatterSource).toBe('');
    expect(serializeMdy(file)).toBe(
      '# Acknowledgement\n\nDear Jane, we received your report.\n'
    );
  });
});
