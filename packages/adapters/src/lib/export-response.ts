import {
  normalizeDefinition,
  resolveEffect,
  type FieldDefinition,
  type FieldResponse,
  type FormDefinition,
  type FormResponse,
} from '@esheet/core';
import Handlebars from 'handlebars';
import { decorateFieldLinks, renderWithEngine } from '@mieweb/templit';
import { marked } from 'marked';
import { createMdy } from './mdy.js';

export const responseExportLabels = {
  notAnswered: 'Not answered',
  unknownOption: 'Unknown option',
  unsupported: 'Value retained in structured data',
  attachment: 'Attachment reference',
  signature: 'Signature recorded',
  diagram: 'Diagram recorded',
  activity: 'Activity retained in structured data',
  yes: 'Yes',
  no: 'No',
};

export interface ResponseDocumentExportOptions {
  /** Overrides form.outputTemplate. An empty template is an error. */
  readonly template?: string;
  readonly locale?: string;
  readonly labels?: Partial<typeof responseExportLabels>;
  /** Inject a timestamp for reproducible exports. */
  readonly renderedAt?: Date;
}

export interface ResponseExportDiagnostic {
  readonly code:
    | 'missing-answer'
    | 'unknown-option'
    | 'unsupported-value'
    | 'orphan-response'
    | 'javascript-disabled';
  readonly fieldId?: string;
}

export interface ResponseExport {
  readonly mdy: string;
  readonly markdown: string;
  readonly diagnostics: readonly ResponseExportDiagnostic[];
}

interface DisplayField {
  display: string;
  answered: boolean;
}

interface FormatContext {
  labels: typeof responseExportLabels;
  locale?: string;
  warn: (code: ResponseExportDiagnostic['code'], fieldId: string) => void;
}

/**
 * Export a snapshot, not a re-computation or a redaction. YAML retains the entire
 * supplied form and response (including hidden/orphan answers and references).
 * Templates see only escaped display values, never raw response objects or JS.
 */
export async function exportResponse(
  form: FormDefinition,
  response: FormResponse,
  options: ResponseDocumentExportOptions = {}
): Promise<ResponseExport> {
  assertData(form);
  assertData(response);
  const diagnostics: ResponseExportDiagnostic[] = [];
  const context: FormatContext = {
    labels: { ...responseExportLabels, ...options.labels },
    locale: options.locale,
    warn: (code, fieldId) => {
      if (!diagnostics.some((d) => d.code === code && d.fieldId === fieldId)) {
        diagnostics.push({ code, fieldId });
      }
    },
  };
  const definitions = indexFields(form);
  const fields: Record<string, DisplayField> = {};
  for (const [id, field] of definitions) {
    const storedResponse =
      field.fieldType === 'activity'
        ? response[id] ?? response._activity
        : response[id];
    const value = formatResponse(field, storedResponse, context);
    fields[id] = {
      display: escapeMarkdown(value ?? context.labels.notAnswered),
      answered: value !== undefined,
    };
  }
  for (const id of Object.keys(response)) {
    if (!definitions.has(id)) context.warn('orphan-response', id);
  }
  const template = options.template ?? form.outputTemplate;
  const markdown =
    template === undefined
      ? defaultMarkdown(form, response, fields, context)
      : await templateMarkdown(template, form, fields);
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type !== 'link' || !/^(?:#|mdy:)/.test(token.href)) return;
    const id = token.href.replace(/^(?:#|mdy:)/, '');
    if (!definitions.has(id))
      throw new Error(`Unknown MDY field link: ${token.href}`);
  });
  const metadata = {
    kind: 'document',
    schema: 'esheet',
    renderedAt: (options.renderedAt ?? new Date()).toISOString(),
    ...(template !== undefined && {
      template: { name: form.id, engine: 'handlebars', source: template },
    }),
  };
  return {
    mdy: createMdy({ mdy: metadata, form, response }, markdown),
    markdown,
    diagnostics,
  };
}

/** Entity-encode punctuation so response text cannot create Markdown or HTML. */
function escapeMarkdown(value: string): string {
  return value.replace(
    /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~\r\n]/g,
    (char) => `&#${char.charCodeAt(0)};`
  );
}

function assertData(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') throw new Error('Export requires plain data.');
  if (ancestors.has(value)) throw new Error('Export data must not be cyclic.');
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new Error('Export requires plain data objects.');
  }
  ancestors.add(value);
  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(value)
  )) {
    if (descriptor.get || descriptor.set)
      throw new Error('Export data cannot contain accessors.');
    assertData(descriptor.value, ancestors);
  }
  ancestors.delete(value);
}

function indexFields(form: FormDefinition): Map<string, FieldDefinition> {
  const result = new Map<string, FieldDefinition>();
  const visit = (fields: readonly FieldDefinition[]) => {
    for (const field of fields) {
      if (
        !/^[a-z0-9_-]+$/.test(field.id) ||
        ['__proto__', 'constructor', 'prototype'].includes(field.id)
      ) {
        throw new Error(`Invalid MDY field identifier: ${field.id}`);
      }
      if (result.has(field.id))
        throw new Error(`Duplicate field identifier: ${field.id}`);
      result.set(field.id, field);
      if ('fields' in field) visit(field.fields ?? []);
    }
  };
  for (const page of form.pages) visit(page.fields ?? []);
  return result;
}

function scalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() ? value : undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function formatResponse(
  field: FieldDefinition,
  response: FieldResponse | undefined,
  context: FormatContext
): string | undefined {
  if (!response) return undefined;
  const { labels, warn } = context;
  if (field.fieldType === 'multitext') {
    const answers = response.multitextAnswers ?? {};
    const options = field.options ?? [];
    const ids = [
      ...options.map((o) => o.id),
      ...Object.keys(answers).filter((id) => !options.some((o) => o.id === id)),
    ];
    return (
      ids
        .flatMap((id) => {
          const answer = scalar(answers[id]);
          if (answer === undefined) return [];
          const option = options.find((o) => o.id === id);
          if (!option) warn('unknown-option', field.id);
          return [
            `${
              option?.text || option?.value || labels.unknownOption
            }: ${answer}`,
          ];
        })
        .join('; ') || undefined
    );
  }
  if (field.fieldType === 'singlematrix' || field.fieldType === 'multimatrix') {
    const selected = record(response.selected) ?? {};
    if (
      !Object.values(selected).some((value) =>
        Array.isArray(value) ? value.length > 0 : value != null
      )
    )
      return undefined;
    const rows = field.rows ?? [];
    const ids = [
      ...rows.map((r) => r.id),
      ...Object.keys(selected).filter((id) => !rows.some((r) => r.id === id)),
    ];
    return (
      ids
        .map((id) => {
          const row = rows.find((r) => r.id === id);
          if (!row) warn('unknown-option', field.id);
          const display = choiceDisplay(
            selected[id],
            field.columns ?? [],
            field.id,
            context
          );
          return `${row?.value || labels.unknownOption}: ${
            display ?? labels.notAnswered
          }`;
        })
        .join('; ') || undefined
    );
  }
  if (field.fieldType === 'file' && response.fileData) {
    const files = Array.isArray(response.fileData)
      ? response.fileData
      : [response.fileData];
    return (
      files.map((file) => scalar(file.title) ?? labels.attachment).join('; ') ||
      undefined
    );
  }
  if (
    field.fieldType === 'signature' &&
    (response.signatureData || response.signatureImage)
  )
    return labels.signature;
  if (
    field.fieldType === 'diagram' &&
    (response.markupData || response.markupImage)
  )
    return labels.diagram;
  if (response.activity?.length) return labels.activity;
  const answer = scalar(response.answer);
  if (answer !== undefined) {
    if (field.fieldType === 'boolean') {
      if (answer === 'true') return labels.yes;
      if (answer === 'false') return labels.no;
    }
    return formatScalar(field, answer, context);
  }
  if (response.selected !== undefined) {
    const choices = 'options' in field ? field.options ?? [] : [];
    return choiceDisplay(response.selected, choices, field.id, context);
  }
  const hasValue = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasValue);
    const object = record(value);
    if (object) return Object.values(object).some(hasValue);
    return scalar(value) !== undefined;
  };
  if (
    Object.entries(response).some(
      ([key, value]) => key !== '_ai' && key !== 'attributes' && hasValue(value)
    )
  ) {
    warn('unsupported-value', field.id);
    return labels.unsupported;
  }
  return undefined;
}

function choiceDisplay(
  selected: unknown,
  choices: readonly { id: string; value: string; text?: string }[],
  fieldId: string,
  context: FormatContext
): string | undefined {
  if (selected === null || selected === undefined) return undefined;
  if (Array.isArray(selected)) {
    return (
      selected
        .map((item) => choiceDisplay(item, choices, fieldId, context))
        .filter((item) => item !== undefined)
        .join(', ') || undefined
    );
  }
  const item = record(selected);
  const option = choices.find((choice) => choice.id === item?.id);
  if (option) return option.text || option.value;
  const storedLabel = scalar(item?.value);
  if (storedLabel !== undefined) return storedLabel;
  context.warn('unknown-option', fieldId);
  return context.labels.unknownOption;
}

function formatScalar(
  field: FieldDefinition,
  answer: string,
  context: FormatContext
): string {
  if (field.fieldType !== 'text' && field.fieldType !== 'longtext')
    return answer;
  let display = answer;
  // Number() must not round a precise answer before rendering it. Keep those
  // lexical values intact instead of claiming a different measurement.
  if (
    field.inputType === 'number' &&
    Number.isFinite(Number(answer)) &&
    answer.replace(/[^0-9]/g, '').length <= 15
  ) {
    display = new Intl.NumberFormat(context.locale, {
      maximumSignificantDigits: 21,
    }).format(Number(answer));
  }
  if (field.inputType === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(answer)) {
    const date = new Date(`${answer}T00:00:00Z`);
    if (
      !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === answer
    ) {
      display = new Intl.DateTimeFormat(context.locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(date);
    }
  }
  return `${display}${field.unit ? ` ${field.unit}` : ''}`;
}

function defaultMarkdown(
  form: FormDefinition,
  response: FormResponse,
  fields: Record<string, DisplayField>,
  context: FormatContext
): string {
  // The normalizer handles sections; nested page groups follow the same tree rules.
  const sections = (items: readonly FieldDefinition[]): FieldDefinition[] =>
    items.map((field) =>
      'fields' in field
        ? {
            ...field,
            fieldType: 'section',
            fields: sections(field.fields ?? []),
          }
        : field
    );
  const normalized = normalizeDefinition(
    form.pages.map((page) => ({ ...page, fields: sections(page.fields ?? []) }))
  );
  const walk = (items: readonly FieldDefinition[], depth: number): string[] =>
    items.flatMap((field) => {
      if (
        form.dangerouslyAllowJS &&
        field.rules?.some((rule) => rule.effect === 'visible')
      ) {
        context.warn('javascript-disabled', field.id);
      }
      if (!resolveEffect('visible', field, normalized, response, false))
        return [];
      if (
        'fields' in field ||
        field.fieldType === 'section' ||
        field.fieldType === 'pages'
      ) {
        const title = 'title' in field ? field.title : field.question;
        return [
          title
            ? `${'#'.repeat(Math.min(depth, 6))} ${escapeMarkdown(title)}`
            : '',
          ...walk(field.fields ?? [], depth + 1),
        ];
      }
      if (field.fieldType === 'display')
        return field.content ? [escapeMarkdown(field.content)] : [];
      if (field.fieldType === 'html') {
        if (field.htmlContent) context.warn('unsupported-value', field.id);
        return field.htmlContent
          ? [escapeMarkdown(context.labels.unsupported)]
          : [];
      }
      if (field.fieldType === 'image')
        return [
          escapeMarkdown(
            field.caption ||
              field.altText ||
              field.question ||
              context.labels.attachment
          ),
        ];
      const value = fields[field.id];
      if (!value.answered) context.warn('missing-answer', field.id);
      return [
        `- **${escapeMarkdown(field.question || field.id)}:** [${
          value.display
        }](#${field.id})`,
      ];
    });
  return (
    [
      `# ${escapeMarkdown(form.title || form.id)}`,
      form.description ? escapeMarkdown(form.description) : '',
      ...form.pages.flatMap((page) => [
        page.title ? `## ${escapeMarkdown(page.title)}` : '',
        ...walk(page.fields ?? [], 3),
      ]),
    ]
      .filter(Boolean)
      .join('\n\n') + '\n'
  );
}

async function templateMarkdown(
  template: string,
  form: FormDefinition,
  fields: Record<string, DisplayField>
): Promise<string> {
  if (!template.trim())
    throw new Error('The output template must not be empty.');
  const engine = Handlebars.create();
  validateTemplate(engine.parse(template), fields);
  const markdown = await renderWithEngine(
    template,
    decorateFieldLinks({
      fields,
      form: {
        id: escapeMarkdown(form.id),
        title: escapeMarkdown(form.title ?? form.id),
        description: escapeMarkdown(form.description ?? ''),
      },
    }),
    {
      name: 'handlebars',
      render: (source, variables) =>
        engine.compile(source, { strict: true, noEscape: true })(variables),
    }
  );
  if (/\{\{|\{%/.test(markdown))
    throw new Error('Unresolved template syntax in exported document.');
  return markdown;
}

/** Validate even paths inside untaken branches: strict Handlebars alone does not. */
function validateTemplate(
  node: unknown,
  fields: Record<string, DisplayField>,
  inEach = false
): void {
  const object = record(node);
  if (!object) return;
  if (object.type === 'PathExpression') {
    const path = String(object.original);
    const parts = object.parts as string[];
    const field =
      parts[0] === 'fields' && Object.hasOwn(fields, parts[1] ?? '');
    const valid =
      ['if', 'unless', 'each', 'fields'].includes(path) ||
      (field &&
        (parts.length === 2 ||
          (parts.length === 3 &&
            ['display', 'answered'].includes(parts[2])))) ||
      (parts[0] === 'form' &&
        parts.length === 2 &&
        ['id', 'title', 'description'].includes(parts[1])) ||
      (inEach &&
        [
          'this',
          'this.display',
          'this.answered',
          '@key',
          '@index',
          '@first',
          '@last',
        ].includes(path));
    if (!valid || object.depth)
      throw new Error(`Unknown output template reference: ${path}`);
  }
  if (
    object.type === 'PartialStatement' ||
    object.type === 'PartialBlockStatement' ||
    object.type === 'Decorator' ||
    object.type === 'DecoratorBlock'
  ) {
    throw new Error('Output templates do not support partials or decorators.');
  }
  const each = record(object.path)?.original === 'each';
  if (
    each &&
    (object.params as unknown[])?.some(
      (param) => record(param)?.original !== 'fields'
    )
  ) {
    throw new Error('Output template each loops must iterate fields.');
  }
  for (const [key, value] of Object.entries(object)) {
    if (key === 'loc') continue;
    const scope = inEach || (each && key === 'program');
    if (Array.isArray(value))
      value.forEach((child) => validateTemplate(child, fields, scope));
    else if (typeof value === 'object') validateTemplate(value, fields, scope);
  }
}
