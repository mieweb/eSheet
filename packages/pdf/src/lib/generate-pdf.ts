import type {
  FieldDefinition,
  FieldOption,
  FieldResponse,
  FieldWidth,
  FormDefinition,
} from '@esheet/core';
import {
  PDFDocument,
  type PDFFont,
  type PDFForm,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

export type PdfPageSize = 'letter' | 'a4';

export type PdfResponseMap = Record<string, FieldResponse>;

export type PdfFieldKind =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown';

export interface PdfFieldMapping {
  esheetFieldId: string;
  pdfFieldName: string;
  kind: PdfFieldKind;
  page: number;
  rect: [x: number, y: number, width: number, height: number];
  optionId?: string;
}

export interface PdfGenerationWarning {
  fieldId?: string;
  code: 'unsupported-field' | 'unsupported-character';
  message: string;
}

export interface PdfGenerationOptions {
  pageSize?: PdfPageSize;
  margin?: number;
  title?: string;
  /** Current eSheet responses to write into the generated AcroForm fields. */
  responses?: PdfResponseMap;
}

export interface GeneratedPdf {
  bytes: Uint8Array;
  mappings: PdfFieldMapping[];
  warnings: PdfGenerationWarning[];
  pageCount: number;
}

interface RenderContext {
  document: PDFDocument;
  form: PDFForm;
  font: PDFFont;
  boldFont: PDFFont;
  options: Required<Pick<PdfGenerationOptions, 'margin' | 'pageSize'>>;
  responses: PdfResponseMap;
  mappings: PdfFieldMapping[];
  warnings: PdfGenerationWarning[];
  warnedFields: Set<string>;
  page: PDFPage;
  pageIndex: number;
  y: number;
  /** Left edge of the current column in points. */
  columnX: number;
  /** Width of the current column in points. */
  columnWidth: number;
}

const PAGE_SIZES: Record<PdfPageSize, [number, number]> = {
  letter: [612, 792],
  a4: [595.28, 841.89],
};

const COLORS = {
  text: rgb(0.12, 0.15, 0.2),
  muted: rgb(0.38, 0.42, 0.48),
  border: rgb(0.68, 0.72, 0.78),
  surface: rgb(0.98, 0.99, 1),
  primary: rgb(0.12, 0.36, 0.7),
};

const BODY_SIZE = 10;
const LABEL_SIZE = 10.5;
const LINE_HEIGHT = 14;
const FIELD_GAP = 16;
const INPUT_HEIGHT = 24;
/** Gap between adjacent columns in a multi-column row (points). */
const COL_GAP = 10;

// ---------------------------------------------------------------------------
// Column layout (mirrors the 6-col grid used in the renderer Canvas)
// ---------------------------------------------------------------------------

function fieldColSpan(field: { fieldType: string; width?: FieldWidth }): number {
  if (field.fieldType === 'section' || field.fieldType === 'pages') return 6;
  switch (field.width) {
    case 'half':
      return 3;
    case 'third':
      return 2;
    default:
      return 6;
  }
}

interface RowEntry {
  field: FieldDefinition;
  colStart: number;
  colSpan: number;
}

function groupIntoRows(fields: FieldDefinition[]): RowEntry[][] {
  const rows: RowEntry[][] = [];
  let row: RowEntry[] = [];
  let col = 0;
  for (const field of fields) {
    const span = fieldColSpan(field);
    if (span === 6 || col + span > 6) {
      if (row.length > 0) rows.push(row);
      row = [];
      col = 0;
    }
    row.push({ field, colStart: col, colSpan: span });
    col += span;
    if (col >= 6) {
      rows.push(row);
      row = [];
      col = 0;
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

function colGeometry(
  pageWidth: number,
  margin: number,
  colStart: number,
  colSpan: number
): { x: number; width: number } {
  const totalContent = pageWidth - margin * 2;
  const totalGaps = COL_GAP * 5; // 5 gaps for 6 columns
  const unit = (totalContent - totalGaps) / 6;
  return {
    x: margin + colStart * (unit + COL_GAP),
    width: colSpan * unit + (colSpan - 1) * COL_GAP,
  };
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function safeName(value: string): string {
  const readable = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `${readable || 'field'}_${hashString(value)}`;
}

function fieldName(fieldId: string, suffix?: string): string {
  const base = `esheet_${safeName(fieldId)}`;
  return suffix ? `${base}_${safeName(suffix)}` : base;
}

function pdfText(
  value: string | undefined,
  context: RenderContext,
  fieldId?: string
): string {
  if (!value) return '';
  const punctuationNormalized = value
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...');
  const normalized = Array.from(punctuationNormalized, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === '\t' ||
      character === '\n' ||
      character === '\r' ||
      (code >= 0x20 && code <= 0x7e)
      ? character
      : '?';
  }).join('');

  if (normalized !== value) {
    const warningKey = fieldId ?? '__document__';
    if (!context.warnedFields.has(warningKey)) {
      context.warnedFields.add(warningKey);
      context.warnings.push({
        ...(fieldId ? { fieldId } : {}),
        code: 'unsupported-character',
        message:
          'Some characters were replaced because the initial PDF generator uses a standard PDF font.',
      });
    }
  }
  return normalized;
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function newPage(context: RenderContext, continuation = false): void {
  context.page = context.document.addPage(PAGE_SIZES[context.options.pageSize]);
  context.pageIndex = context.document.getPageCount() - 1;
  context.y = context.page.getHeight() - context.options.margin;
  if (continuation) {
    context.page.drawText('Continued', {
      x: context.options.margin,
      y: context.y,
      size: 8,
      font: context.font,
      color: COLORS.muted,
    });
    context.y -= 22;
  }
}

function ensureSpace(context: RenderContext, height: number): void {
  if (context.y - height < context.options.margin + 20) {
    newPage(context, true);
  }
}

function drawLines(
  context: RenderContext,
  text: string,
  options: {
    font?: PDFFont;
    size?: number;
    color?: ReturnType<typeof rgb>;
    indent?: number;
    spacingAfter?: number;
  } = {}
): void {
  const font = options.font ?? context.font;
  const size = options.size ?? BODY_SIZE;
  const indent = options.indent ?? 0;
  const width = context.columnWidth - Math.max(0, indent);
  const lines = wrapText(text, font, size, width);
  const height = Math.max(LINE_HEIGHT, lines.length * LINE_HEIGHT);
  ensureSpace(context, height);
  for (const line of lines) {
    context.page.drawText(line, {
      x: context.columnX + indent,
      y: context.y,
      size,
      font,
      color: options.color ?? COLORS.text,
    });
    context.y -= LINE_HEIGHT;
  }
  context.y -= options.spacingAfter ?? 4;
}

function selectedValues(response: FieldResponse | undefined): string[] {
  const selected = response?.selected;
  if (!selected) return [];
  if (Array.isArray(selected)) {
    return selected.flatMap((option) => [option.id, option.value]);
  }
  if (
    'id' in selected &&
    typeof selected.id === 'string' &&
    'value' in selected &&
    typeof selected.value === 'string'
  ) {
    return [selected.id, selected.value];
  }
  return [];
}

function drawQuestion(context: RenderContext, field: FieldDefinition): void {
  const question =
    'question' in field && field.question
      ? field.question
      : `Untitled ${field.fieldType} field`;
  drawLines(
    context,
    pdfText(`${question}${field.required ? ' *' : ''}`, context, field.id),
    { font: context.boldFont, size: LABEL_SIZE, spacingAfter: 5 }
  );
}

function addTextField(
  context: RenderContext,
  field: FieldDefinition,
  name: string,
  value: string | undefined,
  multiline = false,
  optionId?: string
): void {
  const height = multiline ? 58 : INPUT_HEIGHT;
  ensureSpace(context, height + FIELD_GAP);
  const x = context.columnX;
  const y = context.y - height;
  const width = context.columnWidth;
  const pdfField = context.form.createTextField(name);
  if (multiline) pdfField.enableMultiline();
  if (value) pdfField.setText(pdfText(value, context, field.id));
  pdfField.addToPage(context.page, {
    x,
    y,
    width,
    height,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    textColor: COLORS.text,
    font: context.font,
  });
  pdfField.setFontSize(BODY_SIZE);
  context.mappings.push({
    esheetFieldId: field.id,
    pdfFieldName: name,
    kind: 'text',
    page: context.pageIndex,
    rect: [x, y, width, height],
    ...(optionId ? { optionId } : {}),
  });
  context.y = y - FIELD_GAP;
}

function drawOptionLabel(
  context: RenderContext,
  value: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  const label = pdfText(value, context);
  const clipped = wrapText(label, context.font, BODY_SIZE, maxWidth)[0] ?? '';
  context.page.drawText(clipped, {
    x,
    y,
    size: BODY_SIZE,
    font: context.font,
    color: COLORS.text,
  });
}

function addCheckboxes(
  context: RenderContext,
  field: FieldDefinition,
  options: FieldOption[],
  selected: string[]
): void {
  const boxSize = 14;
  for (const option of options) {
    ensureSpace(context, 24);
    const name = fieldName(field.id, option.id);
    const checkbox = context.form.createCheckBox(name);
    const x = context.columnX;
    const y = context.y - boxSize + 2;
    checkbox.addToPage(context.page, {
      x,
      y,
      width: boxSize,
      height: boxSize,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    });
    if (selected.includes(option.id) || selected.includes(option.value)) {
      checkbox.check();
    }
    drawOptionLabel(
      context,
      option.value,
      x + boxSize + 7,
      y + 2,
      context.columnWidth - boxSize - 7
    );
    context.mappings.push({
      esheetFieldId: field.id,
      pdfFieldName: name,
      kind: 'checkbox',
      page: context.pageIndex,
      rect: [x, y, boxSize, boxSize],
      optionId: option.id,
    });
    context.y -= 22;
  }
  context.y -= FIELD_GAP - 6;
}

function addBoolean(
  context: RenderContext,
  field: FieldDefinition,
  response: FieldResponse | undefined
): void {
  ensureSpace(context, 28);
  const name = fieldName(field.id);
  const checkbox = context.form.createCheckBox(name);
  const x = context.columnX;
  const size = 16;
  const y = context.y - size + 2;
  checkbox.addToPage(context.page, {
    x,
    y,
    width: size,
    height: size,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  });
  const selected = selectedValues(response).map((value) => value.toLowerCase());
  const answer = response?.answer?.toLowerCase();
  if (
    selected.some((value) => ['true', 'yes', '1'].includes(value)) ||
    (answer !== undefined && ['true', 'yes', '1'].includes(answer))
  ) {
    checkbox.check();
  }
  drawOptionLabel(context, 'Yes', x + size + 7, y + 3, 120);
  context.mappings.push({
    esheetFieldId: field.id,
    pdfFieldName: name,
    kind: 'checkbox',
    page: context.pageIndex,
    rect: [x, y, size, size],
  });
  context.y -= 28 + FIELD_GAP - 6;
}

function addRadioGroup(
  context: RenderContext,
  field: FieldDefinition,
  options: FieldOption[],
  selected: string[]
): void {
  const name = fieldName(field.id);
  const group = context.form.createRadioGroup(name);
  const size = 14;
  let selectedOptionId: string | undefined;
  for (const option of options) {
    ensureSpace(context, 24);
    const x = context.columnX;
    const y = context.y - size + 2;
    group.addOptionToPage(option.id, context.page, {
      x,
      y,
      width: size,
      height: size,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    });
    if (selected.includes(option.id) || selected.includes(option.value)) {
      selectedOptionId = option.id;
    }
    drawOptionLabel(
      context,
      option.value,
      x + size + 7,
      y + 2,
      context.columnWidth - size - 7
    );
    context.mappings.push({
      esheetFieldId: field.id,
      pdfFieldName: name,
      kind: 'radio',
      page: context.pageIndex,
      rect: [x, y, size, size],
      optionId: option.id,
    });
    context.y -= 22;
  }
  if (selectedOptionId) group.select(selectedOptionId);
  context.y -= FIELD_GAP - 6;
}

function addDropdown(
  context: RenderContext,
  field: FieldDefinition,
  options: FieldOption[],
  selected: string[]
): void {
  ensureSpace(context, INPUT_HEIGHT + FIELD_GAP);
  const name = fieldName(field.id);
  const dropdown = context.form.createDropdown(name);
  const values = options.map((option) => option.value);
  if (values.length > 0) dropdown.addOptions(values);
  const selectedOption = options.find(
    (option) => selected.includes(option.id) || selected.includes(option.value)
  );
  if (selectedOption) dropdown.select(selectedOption.value);
  const x = context.columnX;
  const y = context.y - INPUT_HEIGHT;
  const width = context.columnWidth;
  dropdown.addToPage(context.page, {
    x,
    y,
    width,
    height: INPUT_HEIGHT,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    textColor: COLORS.text,
    font: context.font,
  });
  dropdown.setFontSize(BODY_SIZE);
  context.mappings.push({
    esheetFieldId: field.id,
    pdfFieldName: name,
    kind: 'dropdown',
    page: context.pageIndex,
    rect: [x, y, width, INPUT_HEIGHT],
  });
  context.y = y - FIELD_GAP;
}

function addUnsupported(
  context: RenderContext,
  field: FieldDefinition,
  response: FieldResponse | undefined
): void {
  const answer = response?.answer;
  drawLines(
    context,
    pdfText(answer ? `Response: ${answer}` : 'Not editable in PDF yet.', context, field.id),
    { color: COLORS.muted, spacingAfter: FIELD_GAP }
  );
  context.warnings.push({
    fieldId: field.id,
    code: 'unsupported-field',
    message: `${field.fieldType} fields are rendered as static PDF content in this initial version.`,
  });
}

function renderField(context: RenderContext, field: FieldDefinition): void {
  const response = context.responses[field.id];

  if (field.fieldType === 'display') {
    drawLines(context, pdfText(field.content ?? '', context, field.id), {
      spacingAfter: FIELD_GAP,
    });
    return;
  }

  if (field.fieldType === 'section' || field.fieldType === 'pages') {
    const title = field.title || field.question || 'Section';
    drawLines(context, pdfText(title, context, field.id), {
      font: context.boldFont,
      size: 13,
      color: COLORS.primary,
      spacingAfter: 8,
    });
    renderFields(context, field.fields ?? []);
    return;
  }

  drawQuestion(context, field);

  switch (field.fieldType) {
    case 'text':
      addTextField(
        context,
        field,
        fieldName(field.id),
        response?.answer,
        false
      );
      break;
    case 'longtext':
      addTextField(
        context,
        field,
        fieldName(field.id),
        response?.answer,
        true
      );
      break;
    case 'multitext':
      for (const option of field.options ?? []) {
        drawLines(context, pdfText(option.value, context, field.id), {
          size: 9,
          color: COLORS.muted,
          spacingAfter: 3,
        });
        addTextField(
          context,
          field,
          fieldName(field.id, option.id),
          response?.multitextAnswers?.[option.id],
          false,
          option.id
        );
      }
      break;
    case 'boolean':
      addBoolean(context, field, response);
      break;
    case 'check':
    case 'multiselectdropdown':
      addCheckboxes(
        context,
        field,
        field.options ?? [],
        selectedValues(response)
      );
      break;
    case 'radio':
    case 'rating':
    case 'slider':
      addRadioGroup(
        context,
        field,
        field.options ?? [],
        selectedValues(response)
      );
      break;
    case 'dropdown':
      addDropdown(
        context,
        field,
        field.options ?? [],
        selectedValues(response)
      );
      break;
    default:
      addUnsupported(context, field, response);
  }
}

/**
 * Render an array of fields grouped into rows by their `width` property,
 * mirroring the 6-column grid used in the renderer Canvas.
 */
function renderFields(context: RenderContext, fields: FieldDefinition[]): void {
  const rows = groupIntoRows(fields);
  for (const row of rows) {
    const pageWidth = context.page.getWidth();
    const margin = context.options.margin;
    if (row.length === 1) {
      const { field, colStart, colSpan } = row[0];
      const { x, width } = colGeometry(pageWidth, margin, colStart, colSpan);
      context.columnX = x;
      context.columnWidth = width;
      renderField(context, field);
    } else {
      // Multi-column row: ensure enough space for at least one field, then
      // render each field from the same Y start, advancing Y by the max drop.
      ensureSpace(context, INPUT_HEIGHT + LINE_HEIGHT + FIELD_GAP);
      const startY = context.y;
      let minY = startY;
      for (const { field, colStart, colSpan } of row) {
        context.y = startY;
        const { x, width } = colGeometry(pageWidth, margin, colStart, colSpan);
        context.columnX = x;
        context.columnWidth = width;
        renderField(context, field);
        if (context.y < minY) minY = context.y;
      }
      context.y = minY;
    }
    // Restore full-width defaults after each row
    context.columnX = margin;
    context.columnWidth = pageWidth - margin * 2;
  }
}

function addPageFooters(context: RenderContext): void {
  const pages = context.document.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const label = `Page ${index + 1} of ${pages.length}`;
    const width = context.font.widthOfTextAtSize(label, 8);
    page.drawText(label, {
      x: page.getWidth() - context.options.margin - width,
      y: 22,
      size: 8,
      font: context.font,
      color: COLORS.muted,
    });
  }
}

/**
 * Generate a deterministic, fillable PDF from an eSheet definition.
 *
 * Question content is drawn into the PDF page while supported answer controls
 * are emitted as real AcroForm fields. The returned mapping is the bridge for
 * later importing and filling external PDF templates.
 */
export async function generatePdf(
  definition: FormDefinition,
  options: PdfGenerationOptions = {}
): Promise<GeneratedPdf> {
  const document = await PDFDocument.create();
  document.setTitle(options.title ?? definition.title ?? definition.id);
  document.setCreator('@esheet/pdf');
  document.setProducer('pdf-lib');

  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const form = document.getForm();
  const [pageWidth, pageHeight] = PAGE_SIZES[options.pageSize ?? 'letter'];
  const firstPage = document.addPage([pageWidth, pageHeight]);
  const resolvedMargin = options.margin ?? 48;
  const context: RenderContext = {
    document,
    form,
    font,
    boldFont,
    options: {
      pageSize: options.pageSize ?? 'letter',
      margin: resolvedMargin,
    },
    responses: options.responses ?? {},
    mappings: [],
    warnings: [],
    warnedFields: new Set<string>(),
    page: firstPage,
    pageIndex: 0,
    y: firstPage.getHeight() - resolvedMargin,
    columnX: resolvedMargin,
    columnWidth: pageWidth - resolvedMargin * 2,
  };

  const title = pdfText(
    options.title ?? definition.title ?? definition.id,
    context
  );
  drawLines(context, title, {
    font: boldFont,
    size: 20,
    color: COLORS.primary,
    spacingAfter: 8,
  });
  if (definition.description) {
    drawLines(context, pdfText(definition.description, context), {
      color: COLORS.muted,
      spacingAfter: 18,
    });
  }

  for (let pageIndex = 0; pageIndex < definition.pages.length; pageIndex += 1) {
    const definitionPage = definition.pages[pageIndex];
    if (pageIndex > 0) newPage(context);
    if (definitionPage.title) {
      drawLines(context, pdfText(definitionPage.title, context), {
        font: boldFont,
        size: 15,
        spacingAfter: 12,
      });
    }
    renderFields(context, definitionPage.fields ?? []);
  }

  if (definition.pages.length === 0) {
    drawLines(context, 'This eSheet does not contain any pages yet.', {
      color: COLORS.muted,
    });
  }

  addPageFooters(context);
  form.updateFieldAppearances(font);
  const bytes = await document.save();
  return {
    bytes,
    mappings: context.mappings,
    warnings: context.warnings,
    pageCount: document.getPageCount(),
  };
}
