import type { FieldDefinition, FormDefinition } from '@esheet/core';
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFString,
  PDFTextField,
  rgb,
} from 'pdf-lib';
import {
  embedEsheetManifest,
  type PdfFieldMapping,
  type PdfResponseMap,
} from './generate-pdf.js';

export interface ApplyPdfLayoutOptions {
  /** New editor-created fields that are not present in the source PDF yet. */
  addedFields?: PdfFieldMapping[];
  /** Serialized eSheet definition to retain in an enhanced source PDF. */
  definition?: FormDefinition;
  /** Current eSheet responses to write into mapped AcroForm fields. */
  responses?: PdfResponseMap;
}

type SupportedPdfField =
  | PDFCheckBox
  | PDFDropdown
  | PDFOptionList
  | PDFRadioGroup
  | PDFTextField;

function findField(
  definition: FormDefinition | undefined,
  fieldId: string
): FieldDefinition | undefined {
  const find = (
    fields: readonly FieldDefinition[]
  ): FieldDefinition | undefined => {
    for (const field of fields) {
      if (field.id === fieldId) return field;
      if (field.fieldType === 'section' || field.fieldType === 'pages') {
        const nested = find(field.fields ?? []);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  return find(definition?.pages.flatMap((page) => page.fields ?? []) ?? []);
}

function applyFieldMetadata(
  field: SupportedPdfField,
  definition: FormDefinition | undefined,
  fieldId: string
): void {
  const fieldDefinition = findField(definition, fieldId);
  if (!fieldDefinition) return;
  if (
    'question' in fieldDefinition &&
    typeof fieldDefinition.question === 'string'
  ) {
    field.acroField.dict.set(
      PDFName.of('TU'),
      PDFString.of(fieldDefinition.question)
    );
  }
  if (fieldDefinition.required) field.enableRequired();
  else field.disableRequired();
}

function optionsForField(
  definition: FormDefinition | undefined,
  fieldId: string
): string[] {
  const findOptions = (
    fields: FormDefinition['pages'][number]['fields']
  ): string[] | undefined => {
    for (const field of fields ?? []) {
      if (field.id === fieldId && 'options' in field) {
        return field.options?.map((option) => option.value);
      }
      if (field.fieldType === 'section' || field.fieldType === 'pages') {
        const options = findOptions(field.fields);
        if (options) return options;
      }
    }
    return undefined;
  };

  return (
    findOptions(definition?.pages.flatMap((page) => page.fields ?? [])) ?? []
  );
}

function selectedValues(
  response: PdfResponseMap[string] | undefined
): string[] {
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

function applyResponse(
  field:
    | PDFCheckBox
    | PDFDropdown
    | PDFOptionList
    | PDFRadioGroup
    | PDFTextField,
  response: PdfResponseMap[string] | undefined
): void {
  if (field instanceof PDFTextField) {
    field.setText(response?.answer ?? '');
    return;
  }
  if (field instanceof PDFCheckBox) {
    const checked = selectedValues(response)
      .map((value) => value.toLowerCase())
      .some((value) => ['true', 'yes', '1'].includes(value));
    if (checked) field.check();
    else field.uncheck();
    return;
  }

  const selected = selectedValues(response);
  const matchingOptions = field
    .getOptions()
    .filter((option) => selected.includes(option));
  if (matchingOptions.length === 0) {
    field.clear();
  } else if (field instanceof PDFOptionList) {
    field.select(matchingOptions);
  } else {
    field.select(matchingOptions[0]);
  }
}

/**
 * Apply editor-controlled AcroForm widget rectangles to a PDF.
 *
 * Existing fields are matched by their PDF field names. Text, checkbox, and
 * radio mappings supplied through `addedFields` are created when they do not
 * exist.
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
      const response =
        options.responses?.[fieldMappings[0]?.esheetFieldId ?? ''];
      if (
        existing instanceof PDFCheckBox ||
        existing instanceof PDFDropdown ||
        existing instanceof PDFOptionList ||
        existing instanceof PDFRadioGroup ||
        existing instanceof PDFTextField
      ) {
        applyResponse(existing, response);
        applyFieldMetadata(
          existing,
          options.definition,
          fieldMappings[0]?.esheetFieldId ?? ''
        );
      }
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
    if (mapping.kind === 'radio') {
      const group = form.createRadioGroup(name);
      for (const [index, radioMapping] of fieldMappings.entries()) {
        const page = pages[radioMapping.page];
        if (!page) continue;
        const [x, y, width, height] = radioMapping.rect;
        group.addOptionToPage(
          radioMapping.optionId ?? `option-${index + 1}`,
          page,
          {
            x,
            y,
            width,
            height,
            borderWidth: 1,
            borderColor: rgb(0.12, 0.36, 0.7),
            backgroundColor: rgb(1, 1, 1),
          }
        );
      }
      applyResponse(group, options.responses?.[mapping.esheetFieldId]);
      applyFieldMetadata(group, options.definition, mapping.esheetFieldId);
      continue;
    }
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
      const checkbox = form.createCheckBox(name);
      checkbox.addToPage(page, appearance);
      applyResponse(checkbox, options.responses?.[mapping.esheetFieldId]);
      applyFieldMetadata(checkbox, options.definition, mapping.esheetFieldId);
    } else if (mapping.kind === 'dropdown') {
      const dropdown = form.createDropdown(name);
      dropdown.setOptions(
        optionsForField(options.definition, mapping.esheetFieldId)
      );
      dropdown.addToPage(page, appearance);
      applyResponse(dropdown, options.responses?.[mapping.esheetFieldId]);
      applyFieldMetadata(dropdown, options.definition, mapping.esheetFieldId);
    } else {
      const textField = form.createTextField(name);
      textField.addToPage(page, appearance);
      textField.setFontSize(10);
      applyResponse(textField, options.responses?.[mapping.esheetFieldId]);
      applyFieldMetadata(textField, options.definition, mapping.esheetFieldId);
    }
  }

  if (options.definition) {
    embedEsheetManifest(document, options.definition, mappings);
  }
  return document.save();
}
