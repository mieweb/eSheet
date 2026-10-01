import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fieldDefinitionSchema,
  registerFieldType,
  type FieldDefinition,
  type FieldOption,
  type FieldResponse,
  type FormDefinition,
  type FormResponse,
} from '@esheet/core';
import { marked } from 'marked';
import { exportResponse } from './export-response.js';
import { parseMdy } from './mdy.js';

const renderedAt = new Date('2026-10-01T12:34:56.000Z');
const exportOptions = { renderedAt, locale: 'en-US' };
const choices: FieldOption[] = [
  { id: 'first', value: 'Stored first', text: 'First label' },
  { id: 'second', value: 'Second value' },
  { id: 'third', value: 'Third value', text: '' },
];

function formWith(
  fields: FieldDefinition[],
  properties: Partial<FormDefinition> = {}
): FormDefinition {
  return {
    id: 'report',
    title: 'Response report',
    pages: [{ id: 'page', title: 'First page', fields }],
    ...properties,
  };
}

function textField(id = 'answer'): FieldDefinition {
  return { id, fieldType: 'text', question: 'Answer' };
}

// Decode only after export when asserting human-readable prose, not security.
function readable(markdown: string): string {
  return markdown.replace(/&#(\d+);/g, (_, digits: string) =>
    String.fromCharCode(Number(digits))
  );
}

function freezeDeep(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  Object.values(value).forEach(freezeDeep);
  Object.freeze(value);
}

const templateFixture = {
  id: 'visit',
  title: 'Visit summary',
  description: 'Snapshot of a visit',
  outputTemplate:
    '# {{form.title}}\n\nPlan: {{fields.plan}}\n\n' +
    'Patient: {{fields.name.display}}\n\nChoice: {{fields.choice}}',
  pages: [
    {
      id: 'history',
      title: 'History',
      fields: [
        { id: 'name', fieldType: 'text', question: 'Patient' },
        {
          id: 'choice',
          fieldType: 'radio',
          question: 'Choice',
          options: choices,
        },
      ],
    },
    {
      id: 'planning',
      title: 'Planning',
      fields: [{ id: 'plan', fieldType: 'longtext', question: 'Plan' }],
    },
  ],
} satisfies FormDefinition;

const templateResponse = {
  name: { answer: 'Ada' },
  choice: { selected: { id: 'first', value: 'Old label' } },
  plan: { answer: 'Review tomorrow' },
} satisfies FormResponse;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('exportResponse canonical snapshot', () => {
  it('summarizes the reserved activity response without moving its data', async () => {
    const form = formWith([
      { id: 'history', fieldType: 'activity', question: 'History' },
    ]);
    const response: FormResponse = {
      _activity: {
        activity: [
          { id: 'event', at: renderedAt.toISOString(), fieldId: 'name' },
        ],
      },
    };
    const result = await exportResponse(form, response, exportOptions);
    expect(result.markdown).toContain(
      '[Activity retained in structured data](#history)'
    );
    expect(parseMdy(result.mdy).frontMatter?.response).toEqual(response);
  });

  it('deeply preserves hidden/orphan answers, metadata, attachments and YAML-sensitive values without mutation', async () => {
    const form = formWith(
      [
        textField('gate'),
        {
          id: 'hidden',
          fieldType: 'text',
          question: 'Hidden question',
          _sourceData: { vendor: 'legacy', nested: [false, 0, null] },
          _conversionWarnings: ['Keep original metadata'],
          rules: [
            {
              effect: 'visible',
              logic: 'AND',
              conditions: [
                { targetId: 'gate', operator: 'equals', expected: 'show' },
              ],
            },
          ],
        },
        { id: 'files', fieldType: 'file', question: 'Evidence' },
      ],
      { _sourceData: { version: '001', enabled: false, count: 0 } }
    );
    const response: FormResponse = {
      gate: { answer: 'hide' },
      hidden: {
        answer: 'Private: yes\n---\n[brackets] & *aliases* {{literal}}',
        _ai: true,
        attributes: { source: 'clinic', code: '000123' },
      },
      files: {
        fileData: [
          {
            title: 'Evidence.pdf',
            contentType: 'application/pdf',
            size: 123,
            url: 'https://files.example.test/evidence',
            fileReference: {
              id: 'external-document',
              contentType: 'application/pdf',
              version: '002',
            },
          },
          { contentType: 'image/png', dataUrl: 'data:image/png;base64,AA==' },
        ],
      },
      orphan: { answer: 'Unmapped answer', attributes: { retained: 'true' } },
    };
    const originalForm = structuredClone(form);
    const originalResponse = structuredClone(response);
    freezeDeep(form);
    freezeDeep(response);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const result = await exportResponse(form, response, exportOptions);
    const parsed = parseMdy(result.mdy);
    expect(parsed.frontMatter).toEqual({
      mdy: {
        kind: 'document',
        schema: 'esheet',
        renderedAt: renderedAt.toISOString(),
      },
      form: originalForm,
      response: originalResponse,
    });
    expect(parsed.body).toBe(result.markdown);
    expect(form).toEqual(originalForm);
    expect(response).toEqual(originalResponse);
    expect(result.markdown).not.toContain('Private');
    expect(result.markdown).not.toContain('Unmapped answer');
    expect(readable(result.markdown)).toContain('Evidence.pdf');
    expect(result.markdown).toContain('Attachment reference');
    expect(result.diagnostics).toContainEqual({
      code: 'orphan-response',
      fieldId: 'orphan',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(await exportResponse(form, response, exportOptions)).toEqual(result);
  });

  it('renders the typed outputTemplate fixture in template order, retaining its source only in YAML', async () => {
    const result = await exportResponse(
      templateFixture,
      templateResponse,
      exportOptions
    );
    expect(result.markdown).toBe(
      '# Visit summary\n\nPlan: [Review tomorrow](#plan)\n\n' +
        'Patient: Ada\n\nChoice: [First label](#choice)'
    );
    expect(result.markdown).not.toMatch(/History|Planning|\{\{/);
    expect(parseMdy(result.mdy).frontMatter).toEqual({
      mdy: {
        kind: 'document',
        schema: 'esheet',
        renderedAt: renderedAt.toISOString(),
        template: {
          name: 'visit',
          engine: 'handlebars',
          source: templateFixture.outputTemplate,
        },
      },
      form: templateFixture,
      response: templateResponse,
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('gives an explicit template precedence without altering the canonical form template', async () => {
    const template = '{{form.id}}: {{fields.name}}';
    const result = await exportResponse(templateFixture, templateResponse, {
      ...exportOptions,
      template,
    });
    expect(result.markdown).toBe('visit: [Ada](#name)');
    expect(parseMdy(result.mdy).frontMatter).toMatchObject({
      form: { outputTemplate: templateFixture.outputTemplate },
      mdy: { template: { source: template } },
    });
  });
});

describe('default narrative structure and visibility', () => {
  it('walks pages, nested sections and page groups in definition order without treating containers as answers', async () => {
    const form = formWith(
      [
        {
          id: 'outer',
          fieldType: 'section',
          title: 'Outer section',
          fields: [
            textField('first'),
            {
              id: 'inner',
              fieldType: 'section',
              title: 'Inner section',
              fields: [textField('second')],
            },
            {
              id: 'group',
              fieldType: 'pages',
              title: 'Nested pages',
              fields: [textField('third')],
            },
          ],
        },
      ],
      { description: 'Report description' }
    );
    form.pages.push({
      id: 'last-page',
      title: 'Last page',
      fields: [textField('fourth')],
    });
    const result = await exportResponse(
      form,
      {
        first: { answer: 'One' },
        second: { answer: 'Two' },
        third: { answer: 'Three' },
        fourth: { answer: 'Four' },
      },
      exportOptions
    );
    expect(result.markdown).toBe(
      '# Response report\n\nReport description\n\n## First page\n\n' +
        '### Outer section\n\n- **Answer:** [One](#first)\n\n' +
        '#### Inner section\n\n- **Answer:** [Two](#second)\n\n' +
        '#### Nested pages\n\n- **Answer:** [Three](#third)\n\n' +
        '## Last page\n\n- **Answer:** [Four](#fourth)\n'
    );
    expect(result.diagnostics).toEqual([]);
    expect(parseMdy(result.mdy).frontMatter?.mdy).not.toHaveProperty(
      'template'
    );
  });

  it('omits hidden fields and every descendant of a hidden section, but keeps all their answers in YAML', async () => {
    const rules: NonNullable<FieldDefinition['rules']> = [
      {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          { targetId: 'gate', operator: 'equals', expected: 'show' },
        ],
      },
    ];
    const form = formWith([
      textField('gate'),
      { ...textField('hidden'), rules },
      {
        id: 'hidden-section',
        fieldType: 'section',
        title: 'Secret section',
        rules,
        fields: [textField('descendant'), textField('unanswered-child')],
      },
      textField('visible'),
    ]);
    const response: FormResponse = {
      gate: { answer: 'hide' },
      hidden: { answer: 'Hidden answer' },
      descendant: { answer: 'Hidden descendant' },
      visible: { answer: 'Visible answer' },
    };
    const result = await exportResponse(form, response, exportOptions);
    expect(result.markdown).toContain('[Visible answer](#visible)');
    expect(result.markdown).not.toMatch(/Hidden|Secret|#hidden|#descendant/);
    expect(result.diagnostics).toEqual([]);
    expect(parseMdy(result.mdy).frontMatter?.response).toEqual(response);
    const shown = await exportResponse(
      form,
      { ...response, gate: { answer: 'show' } },
      exportOptions
    );
    expect(shown.markdown).toContain('[Hidden answer](#hidden)');
    expect(shown.markdown).toContain('[Hidden descendant](#descendant)');
  });

  it('supports empty pages and falls back to form and field IDs for absent labels', async () => {
    const result = await exportResponse(
      {
        id: 'report',
        pages: [
          { id: 'empty' },
          { id: 'page', fields: [{ id: 'answer', fieldType: 'text' }] },
        ],
      },
      { answer: { answer: 'Present' } },
      exportOptions
    );
    expect(result.markdown).toBe(
      '# report\n\n- **answer:** [Present](#answer)\n'
    );
  });
});

describe('answer formatting', () => {
  it.each(['radio', 'dropdown', 'rating', 'slider'] as const)(
    'uses option text before value and ignores stale stored labels for %s',
    async (fieldType) => {
      const form = formWith([{ id: 'choice', fieldType, options: choices }]);
      for (const [id, expected] of [
        ['first', 'First label'],
        ['second', 'Second value'],
        ['third', 'Third value'],
      ]) {
        const result = await exportResponse(
          form,
          { choice: { selected: { id, value: 'Stale label' } } },
          exportOptions
        );
        expect(result.markdown).toContain(`[${expected}](#choice)`);
        expect(result.markdown).not.toContain('Stale label');
        expect(result.diagnostics).toEqual([]);
      }
    }
  );

  it.each(['check', 'multiselectdropdown', 'ranking', 'openchoice'] as const)(
    'preserves response selection order for %s rather than sorting by definition',
    async (fieldType) => {
      const result = await exportResponse(
        formWith([{ id: 'choice', fieldType, options: choices }]),
        {
          choice: {
            selected: [
              { id: 'third', value: 'Old third' },
              { id: 'first', value: 'Old first' },
              { id: 'second', value: 'Old second' },
            ],
          },
        },
        exportOptions
      );
      expect(readable(result.markdown)).toContain(
        '[Third value, First label, Second value](#choice)'
      );
    }
  );

  it('uses stored labels for dynamic choices and diagnoses unlabeled unknown options once per field', async () => {
    const result = await exportResponse(
      formWith([{ id: 'choice', fieldType: 'openchoice', options: choices }]),
      {
        choice: {
          selected: [
            { id: 'custom', value: 'Custom answer' },
            { id: 'gone', value: '' },
            { id: 'also-gone', value: '' },
          ],
        },
      },
      exportOptions
    );
    expect(readable(result.markdown)).toContain(
      '[Custom answer, Unknown option, Unknown option](#choice)'
    );
    expect(result.diagnostics).toEqual([
      { code: 'unknown-option', fieldId: 'choice' },
    ]);
  });

  it('formats multitext in definition order, preserving zero text and unknown rows', async () => {
    const result = await exportResponse(
      formWith([{ id: 'multi', fieldType: 'multitext', options: choices }]),
      {
        multi: {
          multitextAnswers: {
            second: 'Second answer',
            orphan: 'Retained answer',
            first: '0',
            third: '',
          },
        },
      },
      exportOptions
    );
    expect(readable(result.markdown)).toContain(
      '[First label: 0; Second value: Second answer; Unknown option: Retained answer](#multi)'
    );
    expect(result.diagnostics).toEqual([
      { code: 'unknown-option', fieldId: 'multi' },
    ]);
  });

  it.each(['singlematrix', 'multimatrix'] as const)(
    'formats %s row/column labels in row order, including missing and unknown rows',
    async (fieldType) => {
      const result = await exportResponse(
        formWith([
          {
            id: 'matrix',
            fieldType,
            rows: [
              { id: 'row1', value: 'First row' },
              { id: 'row2', value: 'Second row' },
              { id: 'row3', value: 'Third row' },
            ],
            columns: [
              { id: 'yes', value: 'Yes column' },
              { id: 'no', value: 'No column' },
            ],
          },
        ]),
        {
          matrix: {
            selected: {
              row2: { id: 'no', value: 'Old no' },
              row1:
                fieldType === 'singlematrix'
                  ? { id: 'yes', value: 'Old yes' }
                  : [
                      { id: 'no', value: 'Old no' },
                      { id: 'yes', value: 'Old yes' },
                    ],
              orphan: { id: 'yes', value: 'Old yes' },
            },
          },
        },
        exportOptions
      );
      const first =
        fieldType === 'singlematrix' ? 'Yes column' : 'No column, Yes column';
      expect(readable(result.markdown)).toContain(
        `[First row: ${first}; Second row: No column; Third row: Not answered; Unknown option: Yes column](#matrix)`
      );
      expect(result.diagnostics).toEqual([
        { code: 'unknown-option', fieldId: 'matrix' },
      ]);
    }
  );

  describe.each(['singlematrix', 'multimatrix'] as const)(
    '%s clearing',
    (fieldType) => {
      const form = formWith([
        {
          id: 'matrix',
          fieldType,
          rows: [
            { id: 'row1', value: 'First row' },
            { id: 'row2', value: 'Second row' },
            { id: 'row3', value: 'Third row' },
          ],
          columns: [{ id: 'yes', value: 'Yes column' }],
        },
      ]);

      it.each([
        { name: 'no row entries', selected: {} },
        { name: 'empty row arrays', selected: { row1: [], row2: [] } },
        { name: 'null rows', selected: { row1: null, row2: null } },
        {
          name: 'undefined rows',
          selected: { row1: undefined, row2: undefined },
        },
      ])('treats fully cleared $name as unanswered', async ({ selected }) => {
        // JS callers can retain null/undefined row entries after clearing a matrix.
        const response = { matrix: { selected } } as unknown as FormResponse;
        const result = await exportResponse(form, response, exportOptions);
        expect(result.markdown).toContain('[Not answered](#matrix)');
        expect(result.markdown).not.toMatch(/First row|Second row|Third row/);
        expect(result.diagnostics).toEqual([
          { code: 'missing-answer', fieldId: 'matrix' },
        ]);

        const templateResult = await exportResponse(form, response, {
          ...exportOptions,
          template: '{{fields.matrix.answered}}: {{fields.matrix}}',
        });
        expect(templateResult.markdown).toBe('false: [Not answered](#matrix)');
        expect(templateResult.diagnostics).toEqual([]);
      });

      it('keeps partially answered matrices answered with cleared and missing row placeholders', async () => {
        const response: FormResponse = {
          matrix: {
            selected: {
              row1: [],
              row2:
                fieldType === 'singlematrix'
                  ? { id: 'yes', value: 'Old label' }
                  : [{ id: 'yes', value: 'Old label' }],
            },
          },
        };
        const display =
          '[First row: Not answered; Second row: Yes column; Third row: Not answered](#matrix)';
        const result = await exportResponse(form, response, exportOptions);
        expect(readable(result.markdown)).toContain(display);
        expect(result.diagnostics).toEqual([]);

        const templateResult = await exportResponse(form, response, {
          ...exportOptions,
          template: '{{fields.matrix.answered}}: {{fields.matrix}}',
        });
        expect(readable(templateResult.markdown)).toBe(`true: ${display}`);
        expect(templateResult.diagnostics).toEqual([]);
      });
    }
  );

  const emptyCases: {
    name: string;
    field: FieldDefinition;
    response?: FieldResponse;
  }[] = [
    { name: 'absent response', field: textField() },
    { name: 'empty response object', field: textField(), response: {} },
    { name: 'empty answer', field: textField(), response: { answer: '' } },
    {
      name: 'whitespace answer',
      field: textField(),
      response: { answer: ' \n\t ' },
    },
    {
      name: 'metadata only',
      field: textField(),
      response: { _ai: true, attributes: { source: 'demo' } },
    },
    {
      name: 'no selected options',
      field: { id: 'answer', fieldType: 'check' },
      response: { selected: [] },
    },
    {
      name: 'empty multitext',
      field: { id: 'answer', fieldType: 'multitext', options: choices },
      response: { multitextAnswers: { first: '' } },
    },
    {
      name: 'empty file list',
      field: { id: 'answer', fieldType: 'file' },
      response: { fileData: [] },
    },
    {
      name: 'empty signature',
      field: { id: 'answer', fieldType: 'signature' },
      response: { signatureData: '', signatureImage: '' },
    },
    {
      name: 'empty diagram',
      field: { id: 'answer', fieldType: 'diagram' },
      response: { markupData: '', markupImage: '' },
    },
    {
      name: 'empty activity',
      field: { id: 'answer', fieldType: 'activity' },
      response: { activity: [] },
    },
  ];

  it.each(emptyCases)(
    'renders $name as Not answered, never an unsupported placeholder',
    async ({ field, response }) => {
      const result = await exportResponse(
        formWith([field]),
        response ? { answer: response } : {},
        exportOptions
      );
      expect(result.markdown).toContain('[Not answered](#answer)');
      expect(result.markdown).not.toContain(
        'Value retained in structured data'
      );
      expect(result.diagnostics).toEqual([
        { code: 'missing-answer', fieldId: 'answer' },
      ]);
    }
  );

  it.each([
    { fieldType: 'boolean', answer: 'true', expected: 'Yes' },
    { fieldType: 'boolean', answer: 'false', expected: 'No' },
    { fieldType: 'text', answer: '0', expected: '0' },
  ] as const)(
    'preserves $fieldType answer $answer as $expected',
    async ({ fieldType, answer, expected }) => {
      const result = await exportResponse(
        formWith([{ id: 'answer', fieldType }]),
        { answer: { answer } },
        exportOptions
      );
      expect(result.markdown).toContain(`[${expected}](#answer)`);
      expect(result.diagnostics).toEqual([]);
    }
  );

  it.each([
    { fieldType: 'boolean', answer: false, expected: 'No' },
    { fieldType: 'boolean', answer: true, expected: 'Yes' },
    { fieldType: 'text', answer: 0, expected: '0' },
  ] as const)(
    'also handles runtime scalar $answer without truthiness loss',
    async ({ fieldType, answer, expected }) => {
      // Public FieldResponse.answer is string; JS callers can supply scalar JSON.
      const response = { answer: { answer } } as unknown as FormResponse;
      const result = await exportResponse(
        formWith([{ id: 'answer', fieldType }]),
        response,
        exportOptions
      );
      expect(result.markdown).toContain(`[${expected}](#answer)`);
      expect(result.diagnostics).toEqual([]);
      expect(parseMdy(result.mdy).frontMatter?.response).toEqual(response);
    }
  );

  it.each([
    '9007199254740993',
    '123456789012345678901234567890',
    '9007199254740993.123456789',
  ])(
    'preserves every digit of numeric string %s in prose and YAML',
    async (answer) => {
      const result = await exportResponse(
        formWith([{ id: 'answer', fieldType: 'text', inputType: 'number' }]),
        { answer: { answer } },
        exportOptions
      );
      // Grouping is presentation-only; no rounding or IEEE-754 coercion is allowed.
      expect(readable(result.markdown).replaceAll(',', '')).toContain(
        `[${answer}](#answer)`
      );
      expect(parseMdy(result.mdy).frontMatter?.response).toEqual({
        answer: { answer },
      });
    }
  );

  it('formats dates in UTC and numbers with locale and units while retaining originals', async () => {
    const response: FormResponse = {
      date: { answer: '2024-01-01' },
      leap: { answer: '2024-02-29' },
      invalid: { answer: '2024-02-30' },
      number: { answer: '1234.5' },
      zero: { answer: '0' },
    };
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const result = await exportResponse(
      formWith([
        { id: 'date', fieldType: 'text', inputType: 'date' },
        { id: 'leap', fieldType: 'text', inputType: 'date' },
        { id: 'invalid', fieldType: 'text', inputType: 'date' },
        { id: 'number', fieldType: 'text', inputType: 'number', unit: 'kg' },
        { id: 'zero', fieldType: 'longtext', inputType: 'number', unit: 'mL' },
      ]),
      response,
      exportOptions
    );
    const prose = readable(result.markdown);
    expect(prose).toContain('[Jan 1, 2024](#date)');
    expect(prose).toContain('[Feb 29, 2024](#leap)');
    expect(prose).toContain('[2024-02-30](#invalid)');
    expect(prose).toContain('[1,234.5 kg](#number)');
    expect(prose).toContain('[0 mL](#zero)');
    expect(parseMdy(result.mdy).frontMatter?.response).toEqual(response);
  });

  it('honors localized answer labels', async () => {
    const result = await exportResponse(
      formWith([textField('missing'), { id: 'boolean', fieldType: 'boolean' }]),
      { boolean: { answer: 'false' } },
      { ...exportOptions, labels: { notAnswered: 'Sin respuesta', no: 'Nein' } }
    );
    expect(result.markdown).toContain('[Sin respuesta](#missing)');
    expect(result.markdown).toContain('[Nein](#boolean)');
  });

  it('summarizes rich responses without leaking raw data or object coercion', async () => {
    const result = await exportResponse(
      formWith([
        { id: 'signature', fieldType: 'signature' },
        { id: 'diagram', fieldType: 'diagram' },
        { id: 'activity', fieldType: 'activity' },
      ]),
      {
        signature: { signatureImage: 'data:image/png;base64,AA==' },
        diagram: { markupData: '{"strokes":[1]}' },
        activity: {
          activity: [
            {
              id: 'entry',
              at: '2026-10-01T00:00:00Z',
              fieldId: 'signature',
              to: 'Signed',
            },
          ],
        },
      },
      exportOptions
    );
    expect(result.markdown).toContain('[Signature recorded](#signature)');
    expect(result.markdown).toContain('[Diagram recorded](#diagram)');
    expect(result.markdown).toContain(
      '[Activity retained in structured data](#activity)'
    );
    expect(result.markdown).not.toMatch(
      /\[object Object\]|undefined|base64|strokes/
    );
  });

  it('falls back for registered custom structured values with one actionable diagnostic', async () => {
    registerFieldType('test-export-custom', {
      label: 'Custom field',
      category: 'rich',
      answerType: 'media',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {},
    });
    const custom = fieldDefinitionSchema.parse({
      id: 'custom',
      fieldType: 'test-export-custom',
      question: 'Custom answer',
      vendorConfig: { mode: 'structured' },
    });
    const response: FormResponse = {
      custom: {
        markupData: '{"vendor":[1,2]}',
        attributes: { source: 'plugin' },
      },
    };
    const result = await exportResponse(
      formWith([custom]),
      response,
      exportOptions
    );
    expect(result.markdown).toContain(
      '[Value retained in structured data](#custom)'
    );
    expect(result.diagnostics).toEqual([
      { code: 'unsupported-value', fieldId: 'custom' },
    ]);
    expect(result.markdown).not.toMatch(/\[object Object\]|undefined|vendor/);
    expect(parseMdy(result.mdy).frontMatter?.response).toEqual(response);
  });
});

describe('template semantics and validation', () => {
  it.each(['#answer', 'mdy:answer'])(
    'accepts explicit and reference-style field links to %s',
    async (destination) => {
      const template =
        `[Explicit](${destination}) [Reference][field] [field][] [field]\n\n` +
        `[field]: ${destination}`;
      const result = await exportResponse(
        formWith([textField()]),
        {},
        {
          ...exportOptions,
          template,
        }
      );
      expect(result.markdown).toBe(template);
      expect(result.diagnostics).toEqual([]);
      const html = await marked.parse(result.markdown);
      expect(
        [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
      ).toEqual(Array(4).fill(destination));
    }
  );

  describe.each(['inline', 'reference'] as const)('%s field links', (style) => {
    it.each([
      '#unknown',
      'mdy:unknown',
      '#',
      'mdy:',
      '#UPPER',
      'mdy:UPPER',
      '#answer.bad',
      'mdy:answer.bad',
      '#answer/child',
      'mdy:answer/child',
      '#answer%20bad',
      'mdy:answer%20bad',
      '#page',
      'mdy:report',
      '#orphan',
      'mdy:orphan',
      '#summary',
    ])('rejects unknown or malformed destination %s', async (destination) => {
      const template =
        '# Summary\n\n' +
        (style === 'inline'
          ? `[Field](${destination})`
          : `[Field][target]\n\n[target]: ${destination}`);
      await expect(
        exportResponse(
          formWith([textField()]),
          { orphan: { answer: 'Not a form field' } },
          { ...exportOptions, template }
        )
      ).rejects.toThrow(`Unknown MDY field link: ${destination}`);
    });
  });

  it('does not validate field-link examples or reference definitions in code fences', async () => {
    const template =
      '```markdown\n[Unknown](#unknown) [Malformed](mdy:)\n' +
      '[Reference][target]\n\n[target]: #missing\n```';
    const result = await exportResponse(
      formWith([textField()]),
      {},
      {
        ...exportOptions,
        template,
      }
    );
    expect(result.markdown).toBe(template);
    expect(result.diagnostics).toEqual([]);
    expect(await marked.parse(result.markdown)).not.toContain('<a ');
  });

  it.each([
    'https://example.test/guide#unknown',
    'http://example.test/mdy:unknown',
    'mailto:help@example.test',
  ])('allows external template links to %s', async (destination) => {
    const template =
      `[External](${destination}) [Reference][external]\n\n` +
      `[external]: ${destination}`;
    const result = await exportResponse(
      formWith([textField()]),
      {},
      {
        ...exportOptions,
        template,
      }
    );
    expect(result.markdown).toBe(template);
    expect(result.diagnostics).toEqual([]);
  });

  it('supports if, unless and each over prepared fields without leaving template controls', async () => {
    const result = await exportResponse(
      formWith([textField('present'), textField('missing')]),
      { present: { answer: 'Available' } },
      {
        ...exportOptions,
        template:
          '{{form.id}} / {{form.description}}\n' +
          '{{#if fields.present.answered}}Answered: {{fields.present}}{{else}}Wrong branch{{/if}}\n' +
          '{{#unless fields.missing.answered}}Missing: {{fields.missing}}{{/unless}}\n' +
          '{{#each fields}}{{@index}} {{@key}} {{this.display}} {{#if this.answered}}yes{{else}}no{{/if}};{{/each}}',
      }
    );
    expect(result.markdown).toBe(
      'report / \nAnswered: [Available](#present)\nMissing: [Not answered](#missing)\n' +
        '0 present Available yes;1 missing Not answered no;'
    );
    expect(result.markdown).not.toMatch(
      /\{\{|\{%|\[object Object\]|undefined|Wrong branch/
    );
  });

  it.each(['', ' ', '\n\t'])(
    'rejects an empty form template %j instead of silently using the default',
    async (outputTemplate) => {
      await expect(
        exportResponse(
          formWith([textField()], { outputTemplate }),
          {},
          exportOptions
        )
      ).rejects.toThrow(/template.*empty/i);
    }
  );

  it('rejects an empty override even when the form template is valid', async () => {
    await expect(
      exportResponse(templateFixture, templateResponse, {
        ...exportOptions,
        template: '',
      })
    ).rejects.toThrow(/template.*empty/i);
  });

  it.each(['{{#if fields.answer.answered}}', '{{fields.answer', '{{/unless}}'])(
    'rejects invalid template syntax %s',
    async (template) => {
      await expect(
        exportResponse(
          formWith([textField()]),
          {},
          { ...exportOptions, template }
        )
      ).rejects.toThrow();
    }
  );

  it.each([
    '{{fields.unknown}}',
    '{{fields.answer.secret}}',
    '{{form.unknown}}',
    '{{response.answer}}',
    '{{fields.constructor}}',
    '{{fields.__proto__}}',
    '{{lookup fields "answer"}}',
    '{{#if fields.answer.answered}}{{fields.unknown}}{{/if}}',
    '{{#unless fields.answer.answered}}Safe{{else}}{{fields.unknown}}{{/unless}}',
    '{{#each fields}}{{../form.title}}{{/each}}',
  ])(
    'rejects unknown or unsafe reference even in an untaken branch: %s',
    async (template) => {
      await expect(
        exportResponse(
          formWith([textField()]),
          {},
          { ...exportOptions, template }
        )
      ).rejects.toThrow(/Unknown output template reference/);
    }
  );

  it.each(['{{> missing}}', '{{#each form}}{{this}}{{/each}}'])(
    'rejects unsupported template feature %s',
    async (template) => {
      await expect(
        exportResponse(
          formWith([textField()]),
          {},
          { ...exportOptions, template }
        )
      ).rejects.toThrow(/partials|iterate fields/);
    }
  );

  it.each(['default', 'template'] as const)(
    'keeps literal template delimiters inert in %s output',
    async (mode) => {
      const answer =
        '{{fields.secret}} {{#if true}}not evaluated{{/if}} {% execute %}';
      const result = await exportResponse(
        formWith([textField('answer'), textField('secret')]),
        { answer: { answer }, secret: { answer: 'SECRET' } },
        {
          ...exportOptions,
          ...(mode === 'template' ? { template: '{{fields.answer}}' } : {}),
        }
      );
      expect(readable(result.markdown)).toContain(`[${answer}](#answer)`);
      expect(result.markdown).not.toMatch(/\{\{|\{%/);
      expect(parseMdy(result.mdy).frontMatter?.response).toMatchObject({
        answer: { answer },
      });
    }
  );
});

describe('safe data and Markdown boundaries', () => {
  it.each(['default', 'template', 'triple-stash'] as const)(
    'prevents response Markdown from creating scripts, external links or images in %s output before sanitization',
    async (mode) => {
      const attack =
        '<script>alert(1)</script><img src=x onerror=alert(1)> ' +
        '](https://evil.test/escape) [link](javascript:alert%281%29) ' +
        '![pixel](https://evil.test/pixel) <https://evil.test/auto> ' +
        '&lt;script&gt; &#60;img&#62;\n\n# Injected heading\n[ref]: https://evil.test/ref';
      const result = await exportResponse(
        formWith([textField()]),
        { answer: { answer: attack } },
        {
          ...exportOptions,
          ...(mode === 'default'
            ? {}
            : {
                template:
                  mode === 'template'
                    ? '{{fields.answer}}'
                    : '{{{fields.answer.display}}}',
              }),
        }
      );
      // Use unsanitized Markdown HTML: a sanitizer must not mask exporter bugs.
      const html = await marked.parse(result.markdown);
      expect(html).not.toMatch(/<(?:script|img|iframe|svg)\b/i);
      expect(
        [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
      ).toEqual(mode === 'triple-stash' ? [] : ['#answer']);
      expect(html).not.toContain('<h1>Injected heading');
      expect(readable(result.markdown)).toContain(attack);
      expect(parseMdy(result.mdy).frontMatter?.response).toEqual({
        answer: { answer: attack },
      });
    }
  );

  it('escapes all static text surfaces and retains unsupported HTML only in canonical data', async () => {
    const attack =
      '<script>run()</script> [external](https://evil.test) ![img](https://evil.test/img)';
    const form = formWith(
      [
        {
          id: 'section',
          fieldType: 'section',
          title: attack,
          fields: [
            { id: 'answer', fieldType: 'text', question: attack, unit: attack },
          ],
        },
        { id: 'display', fieldType: 'display', content: attack },
        {
          id: 'image',
          fieldType: 'image',
          caption: attack,
          imageUri: 'https://evil.test/asset',
        },
        { id: 'html', fieldType: 'html', htmlContent: attack },
      ],
      { title: attack, description: attack }
    );
    form.pages[0].title = attack;
    const result = await exportResponse(
      form,
      { answer: { answer: 'Safe' } },
      exportOptions
    );
    const html = await marked.parse(result.markdown);
    expect(html).not.toMatch(/<(?:script|img)\b/i);
    expect(
      [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
    ).toEqual(['#answer']);
    expect(readable(result.markdown).split(attack)).toHaveLength(9);
    expect(result.diagnostics).toContainEqual({
      code: 'unsupported-value',
      fieldId: 'html',
    });
    expect(parseMdy(result.mdy).frontMatter?.form).toEqual(form);
  });

  it.each([
    'bad id',
    'UPPER',
    'a.b',
    'a/b',
    'x](evil)',
    '',
    '__proto__',
    'constructor',
    'prototype',
  ])('rejects unsafe field ID %j instead of rewriting it', async (id) => {
    await expect(
      exportResponse(formWith([textField(id)]), {}, exportOptions)
    ).rejects.toThrow(/Invalid MDY field identifier/);
  });

  it.each(['same page', 'nested section', 'different page'])(
    'rejects duplicate IDs in %s',
    async (location) => {
      const form = formWith([textField('duplicate')]);
      if (location === 'same page')
        form.pages[0].fields?.push(textField('duplicate'));
      if (location === 'nested section')
        form.pages[0].fields?.push({
          id: 'section',
          fieldType: 'section',
          fields: [textField('duplicate')],
        });
      if (location === 'different page')
        form.pages.push({ id: 'second', fields: [textField('duplicate')] });
      await expect(exportResponse(form, {}, exportOptions)).rejects.toThrow(
        /Duplicate field identifier: duplicate/
      );
    }
  );

  it('never executes JS visibility, calculations, template-like responses or asset fetching', async () => {
    const execute = vi.fn();
    const fetch = vi.fn();
    vi.stubGlobal('__exportResponseProbe', execute);
    vi.stubGlobal('fetch', fetch);
    const form = formWith(
      [
        {
          id: 'calculated',
          fieldType: 'text',
          calculation: 'globalThis.__exportResponseProbe()',
        },
        {
          id: 'guarded',
          fieldType: 'text',
          rules: [
            {
              effect: 'visible',
              logic: 'AND',
              conditions: [
                {
                  conditionType: 'js',
                  expression: '(globalThis.__exportResponseProbe(), true)',
                },
              ],
            },
          ],
        },
      ],
      { dangerouslyAllowJS: true }
    );
    const response: FormResponse = {
      calculated: { answer: 'Stored, not recomputed' },
      guarded: { answer: '{{globalThis.__exportResponseProbe()}}' },
    };
    const result = await exportResponse(form, response, exportOptions);
    expect(readable(result.markdown)).toContain(
      '[Stored, not recomputed](#calculated)'
    );
    expect(result.markdown).not.toContain('#guarded');
    expect(result.diagnostics).toContainEqual({
      code: 'javascript-disabled',
      fieldId: 'guarded',
    });
    expect(parseMdy(result.mdy).frontMatter?.response).toEqual(response);
    expect(execute).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['form', 'response'] as const)(
    'rejects a getter in %s without invoking it',
    async (target) => {
      const form = formWith([textField()]);
      const response: FormResponse = { answer: {} };
      const getter = vi.fn(() => 'Do not read');
      Object.defineProperty(
        target === 'form' ? form : response.answer,
        target === 'form' ? 'title' : 'answer',
        { enumerable: true, get: getter }
      );
      await expect(
        exportResponse(form, response, exportOptions)
      ).rejects.toThrow(/accessors/);
      expect(getter).not.toHaveBeenCalled();
    }
  );

  it.each(['form', 'response'] as const)(
    'rejects cycles in %s instead of recursing indefinitely',
    async (target) => {
      const form = formWith([textField()]);
      const response: FormResponse = { answer: {} };
      if (target === 'form') form._sourceData = form;
      else
        Object.defineProperty(response.answer, 'cycle', {
          enumerable: true,
          value: response,
        });
      await expect(
        exportResponse(form, response, exportOptions)
      ).rejects.toThrow(/cyclic/);
    }
  );

  it('accepts shared noncyclic references without mistaking them for cycles', async () => {
    const shared: FieldResponse = { answer: 'Shared' };
    const response: FormResponse = { first: shared, second: shared };
    const result = await exportResponse(
      formWith([textField('first'), textField('second')]),
      response,
      exportOptions
    );
    expect(result.markdown).toContain('[Shared](#first)');
    expect(result.markdown).toContain('[Shared](#second)');
    expect(parseMdy(result.mdy).frontMatter?.response).toEqual(response);
    expect(result.markdown).not.toMatch(/\[object Object\]|undefined/);
  });
});
