import type {
  FieldDefinition,
  FieldOption,
  FieldResponse,
  FormDefinition,
} from '@esheet/core';
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFString,
  PDFTextField,
  type PDFField,
} from 'pdf-lib';
import type {
  PdfFieldKind,
  PdfFieldMapping,
  PdfResponseMap,
} from './generate-pdf.js';
import type { EsheetPdfManifest } from './generate-pdf.js';

const ESHEET_MANIFEST_KEY = PDFName.of('eSheet');

export type PdfSource = Uint8Array | ArrayBuffer | Blob;

export interface PdfImportWarning {
  fieldName?: string;
  code:
    | 'no-acroform-fields'
    | 'unsupported-field'
    | 'missing-label'
    | 'xfa-unsupported'
    | 'encrypted-pdf'
    | 'malformed-field';
  message: string;
}

export interface ImportedPdf {
  definition: FormDefinition;
  responses: PdfResponseMap;
  mappings: PdfFieldMapping[];
  sourcePdf: Uint8Array;
  warnings: PdfImportWarning[];
  pageCount: number;
}

interface PdfFieldSourceData {
  source: 'pdf';
  fieldName: string;
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'option-list';
  labelSource: 'alternate-name' | 'field-name' | 'placeholder';
  required?: boolean;
  readOnly?: boolean;
  widgets: Array<{
    page: number;
    rect: PdfFieldMapping['rect'];
  }>;
}

interface ImportedField {
  definition: FieldDefinition;
  response?: FieldResponse;
  mappings: PdfFieldMapping[];
}

export async function importPdf(source: PdfSource): Promise<ImportedPdf> {
  const sourcePdf = await toUint8Array(source);
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(sourcePdf, { ignoreEncryption: false });
  } catch (error) {
    if (isEncryptedPdfError(error)) {
      return emptyImport(sourcePdf, 'encrypted-pdf', 'The PDF is encrypted.');
    }
    throw error;
  }

  const pages = document.getPages();
  const manifest = readManifest(document);
  const warnings: PdfImportWarning[] = [];
  const fields: FieldDefinition[] = [];
  const mappings: PdfFieldMapping[] = [];
  const responses: PdfResponseMap = {};
  const occurrences = new Map<string, number>();

  for (const field of document.getForm().getFields()) {
    const name = field.getName();
    const occurrence = occurrences.get(name) ?? 0;
    occurrences.set(name, occurrence + 1);
    const imported = importField(field, pages, occurrence, warnings);
    if (!imported) continue;
    if (!manifest) {
      fields.push(imported.definition);
      mappings.push(...imported.mappings);
    }
    const fieldId = manifestFieldId(manifest, name) ?? imported.definition.id;
    if (imported.response) responses[fieldId] = imported.response;
  }

  if (!manifest && fields.length === 0) {
    warnings.push({
      code: 'no-acroform-fields',
      message:
        'The PDF has no supported AcroForm fields. You can add fields manually.',
    });
  }

  return {
    definition: manifest?.definition ?? {
      id: `pdf-${hashString(bytesIdentity(sourcePdf))}`,
      title: 'Imported PDF',
      pages: [{ id: 'pdf-page-1', fields }],
    },
    responses,
    mappings: manifest?.mappings ?? mappings,
    sourcePdf,
    warnings,
    pageCount: pages.length,
  };
}

function readManifest(document: PDFDocument): EsheetPdfManifest | undefined {
  const encoded = document.catalog.lookupMaybe(
    ESHEET_MANIFEST_KEY,
    PDFString,
    PDFHexString
  );
  if (!encoded) return undefined;

  try {
    const value: unknown = JSON.parse(encoded.decodeText());
    if (!isManifest(value)) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function isManifest(value: unknown): value is EsheetPdfManifest {
  if (
    !isRecord(value) ||
    value['version'] !== 1 ||
    !isRecord(value['definition'])
  ) {
    return false;
  }
  const definition = value['definition'];
  return (
    typeof definition['id'] === 'string' &&
    Array.isArray(definition['pages']) &&
    Array.isArray(value['mappings'])
  );
}

function manifestFieldId(
  manifest: EsheetPdfManifest | undefined,
  pdfFieldName: string
): string | undefined {
  return manifest?.mappings.find(
    (mapping) => mapping.pdfFieldName === pdfFieldName
  )?.esheetFieldId;
}

function importField(
  field: PDFField,
  pages: ReturnType<PDFDocument['getPages']>,
  occurrence: number,
  warnings: PdfImportWarning[]
): ImportedField | undefined {
  const fieldName = field.getName();
  const alternateName = field.acroField.dict
    .lookupMaybe(PDFName.of('TU'), PDFString, PDFHexString)
    ?.decodeText()
    .trim();
  const source = sourceData(
    field,
    fieldName,
    pages,
    warnings,
    alternateName !== undefined && alternateName.length > 0
  );
  if (!source) return undefined;
  const id = stableFieldId(fieldName, source.fieldType, occurrence);
  const question = labelFor(alternateName, fieldName, warnings);
  const mappings = widgetMappings(
    field,
    id,
    mappingKind(source.fieldType),
    pages
  );
  const base = {
    id,
    question,
    required: source.required,
    _sourceData: source,
  };

  if (field instanceof PDFTextField) {
    return {
      definition: {
        ...base,
        fieldType: field.isMultiline() ? 'longtext' : 'text',
      },
      ...(field.getText() ? { response: { answer: field.getText() } } : {}),
      mappings,
    };
  }
  if (field instanceof PDFCheckBox) {
    return {
      definition: { ...base, fieldType: 'boolean' },
      ...(field.isChecked()
        ? { response: { selected: { id: 'yes', value: 'Yes' } } }
        : {}),
      mappings,
    };
  }
  if (field instanceof PDFRadioGroup) {
    const options = field.getOptions().map(optionFor);
    const selected = field.getSelected();
    return {
      definition: { ...base, fieldType: 'radio', options },
      ...(selected ? { response: { selected: optionFor(selected) } } : {}),
      mappings,
    };
  }
  if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
    const options = field.getOptions().map(optionFor);
    const selected = field.getSelected();
    const isMultiselect = field.isMultiselect();
    return {
      definition: {
        ...base,
        fieldType: isMultiselect ? 'multiselectdropdown' : 'dropdown',
        options,
      },
      ...(selected.length > 0
        ? {
            response: isMultiselect
              ? { selected: selected.map(optionFor) }
              : { selected: optionFor(selected[0] ?? '') },
          }
        : {}),
      mappings,
    };
  }

  warnings.push({
    fieldName,
    code: 'unsupported-field',
    message: `The ${field.constructor.name} field is not supported.`,
  });
  return undefined;
}

function sourceData(
  field: PDFField,
  fieldName: string,
  pages: ReturnType<PDFDocument['getPages']>,
  warnings: PdfImportWarning[],
  hasAlternateName: boolean
): PdfFieldSourceData | undefined {
  const fieldType = pdfFieldType(field);
  if (!fieldType) return undefined;
  const widgets = widgetMappings(field, '', mappingKind(fieldType), pages).map(
    ({ page, rect }) => ({ page, rect })
  );
  if (widgets.length === 0) {
    warnings.push({
      fieldName,
      code: 'malformed-field',
      message: 'The field has no readable widget rectangle.',
    });
  }
  return {
    source: 'pdf',
    fieldName,
    fieldType,
    labelSource: hasAlternateName
      ? 'alternate-name'
      : fieldName.trim()
      ? 'field-name'
      : 'placeholder',
    ...(field.isRequired() ? { required: true } : {}),
    ...(field.isReadOnly() ? { readOnly: true } : {}),
    widgets,
  };
}

function widgetMappings(
  field: PDFField,
  esheetFieldId: string,
  kind: PdfFieldKind,
  pages: ReturnType<PDFDocument['getPages']>
): PdfFieldMapping[] {
  const pageIndexes = new Map(
    pages.map((page, index) => [page.ref.toString(), index])
  );
  return field.acroField.getWidgets().flatMap((widget) => {
    const page = pageIndexes.get(widget.P()?.toString() ?? '');
    const rectangle = widget.getRectangle();
    if (page === undefined || !rectangle) return [];
    return [
      {
        esheetFieldId,
        pdfFieldName: field.getName(),
        kind,
        page,
        rect: [rectangle.x, rectangle.y, rectangle.width, rectangle.height],
      },
    ];
  });
}

function pdfFieldType(
  field: PDFField
): PdfFieldKind | 'option-list' | undefined {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'option-list';
  return undefined;
}

function mappingKind(fieldType: PdfFieldSourceData['fieldType']): PdfFieldKind {
  return fieldType === 'option-list' ? 'dropdown' : fieldType;
}

function optionFor(value: string): FieldOption {
  return { id: `option-${hashString(value)}`, value };
}

function labelFor(
  alternateName: string | undefined,
  fieldName: string,
  warnings: PdfImportWarning[]
): string {
  if (alternateName?.trim()) return alternateName.trim();
  const label = fieldName
    .split('.')
    .at(-1)
    ?.replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  if (label) return label.charAt(0).toUpperCase() + label.slice(1);
  warnings.push({
    fieldName,
    code: 'missing-label',
    message: 'The field has no usable label; an editable placeholder was used.',
  });
  return 'Untitled PDF field';
}

function stableFieldId(
  fieldName: string,
  fieldType: PdfFieldSourceData['fieldType'],
  occurrence: number
): string {
  const base = `pdf-${safeName(fieldName)}-${fieldType}`;
  return occurrence === 0 ? base : `${base}-${occurrence + 1}`;
}

function safeName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'field'
  );
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function toUint8Array(source: PdfSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return new Uint8Array(source);
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(await source.arrayBuffer());
}

function bytesIdentity(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

function isEncryptedPdfError(error: unknown): boolean {
  return error instanceof Error && /encrypted/i.test(error.message);
}

function emptyImport(
  sourcePdf: Uint8Array,
  code: PdfImportWarning['code'],
  message: string
): ImportedPdf {
  return {
    definition: {
      id: `pdf-${hashString(bytesIdentity(sourcePdf))}`,
      title: 'Imported PDF',
      pages: [{ id: 'pdf-page-1', fields: [] }],
    },
    responses: {},
    mappings: [],
    sourcePdf,
    warnings: [{ code, message }],
    pageCount: 0,
  };
}
