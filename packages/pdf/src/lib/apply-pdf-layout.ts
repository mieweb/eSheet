import { PDFDocument, rgb } from 'pdf-lib';
import type { PdfFieldMapping } from './generate-pdf.js';

export interface ApplyPdfLayoutOptions {
  /** New editor-created fields that are not present in the source PDF yet. */
  addedFields?: PdfFieldMapping[];
}

/**
 * Apply editor-controlled AcroForm widget rectangles to a PDF.
 *
 * Existing fields are matched by their PDF field names. Text and checkbox
 * mappings supplied through `addedFields` are created when they do not exist.
 */
export async function applyPdfFieldLayout(
  source: Uint8Array,
  mappings: PdfFieldMapping[],
  options: ApplyPdfLayoutOptions = {}
): Promise<Uint8Array> {
  const document = await PDFDocument.load(source);
  const form = document.getForm();
  const pages = document.getPages();
  const addedNames = new Set(
    (options.addedFields ?? []).map((mapping) => mapping.pdfFieldName)
  );
  const mappingsByName = new Map<string, PdfFieldMapping[]>();

  for (const mapping of mappings) {
    const group = mappingsByName.get(mapping.pdfFieldName) ?? [];
    group.push(mapping);
    mappingsByName.set(mapping.pdfFieldName, group);
  }

  for (const [name, fieldMappings] of mappingsByName) {
    const existing = form.getFieldMaybe(name);
    if (existing) {
      const widgets = existing.acroField.getWidgets();
      for (let index = 0; index < fieldMappings.length; index += 1) {
        const widget = widgets[index];
        const mapping = fieldMappings[index];
        if (!widget || !mapping) continue;
        const [x, y, width, height] = mapping.rect;
        widget.setRectangle({ x, y, width, height });
      }
      continue;
    }

    if (!addedNames.has(name)) continue;
    const mapping = fieldMappings[0];
    if (!mapping) continue;
    const page = pages[mapping.page];
    if (!page) continue;
    const [x, y, width, height] = mapping.rect;
    const appearance = {
      x,
      y,
      width,
      height,
      borderWidth: 1,
      borderColor: rgb(0.12, 0.36, 0.7),
      backgroundColor: rgb(1, 1, 1),
    };

    if (mapping.kind === 'checkbox') {
      form.createCheckBox(name).addToPage(page, appearance);
    } else {
      const textField = form.createTextField(name);
      textField.addToPage(page, appearance);
      textField.setFontSize(10);
    }
  }

  return document.save();
}
