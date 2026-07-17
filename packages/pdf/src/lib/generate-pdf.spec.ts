import type { FormDefinition } from '@esheet/core';
import { PDFDocument } from 'pdf-lib';
import { generatePdf, type PdfFieldMapping } from './generate-pdf.js';
import { applyPdfFieldLayout } from './apply-pdf-layout.js';

const definition: FormDefinition = {
  id: 'intake-form',
  title: 'Patient Intake',
  description: 'Complete each field before your appointment.',
  pages: [
    {
      id: 'details',
      title: 'Details',
      fields: [
        {
          id: 'full-name',
          fieldType: 'text',
          question: 'Full name',
          required: true,
        },
        {
          id: 'notes',
          fieldType: 'longtext',
          question: 'Additional notes',
        },
        {
          id: 'consent',
          fieldType: 'boolean',
          question: 'Do you consent?',
        },
        {
          id: 'contact-method',
          fieldType: 'radio',
          question: 'Preferred contact method',
          options: [
            { id: 'email', value: 'Email' },
            { id: 'phone', value: 'Phone' },
          ],
        },
        {
          id: 'services',
          fieldType: 'check',
          question: 'Requested services',
          options: [
            { id: 'consult', value: 'Consultation' },
            { id: 'follow-up', value: 'Follow-up' },
          ],
        },
        {
          id: 'location',
          fieldType: 'dropdown',
          question: 'Location',
          options: [
            { id: 'north', value: 'North office' },
            { id: 'south', value: 'South office' },
          ],
        },
      ],
    },
  ],
};

describe('generatePdf', () => {
  it('creates real AcroForm fields and prefills eSheet responses', async () => {
    const generated = await generatePdf(definition, {
      responses: {
        'full-name': { answer: 'Ada Lovelace' },
        notes: { answer: 'Prefers morning appointments.' },
        consent: { selected: { id: 'yes', value: 'Yes' } },
        'contact-method': {
          selected: { id: 'email', value: 'Email' },
        },
        services: {
          selected: [{ id: 'consult', value: 'Consultation' }],
        },
        location: {
          selected: { id: 'south', value: 'South office' },
        },
      },
    });

    const pdf = await PDFDocument.load(generated.bytes);
    const form = pdf.getForm();
    const byField = generated.mappings.reduce<
      Record<string, typeof generated.mappings>
    >((grouped, mapping) => {
      (grouped[mapping.esheetFieldId] ??= []).push(mapping);
      return grouped;
    }, {});

    const firstMapping = (fieldId: string): PdfFieldMapping => {
      const mapping = byField[fieldId]?.[0];
      if (!mapping) throw new Error(`Missing mapping for ${fieldId}`);
      return mapping;
    };
    const optionMapping = (
      fieldId: string,
      optionId: string
    ): PdfFieldMapping => {
      const mapping = byField[fieldId]?.find(
        (candidate) => candidate.optionId === optionId
      );
      if (!mapping) {
        throw new Error(`Missing mapping for ${fieldId}/${optionId}`);
      }
      return mapping;
    };

    expect(form.getFields()).toHaveLength(7);
    expect(
      form.getTextField(firstMapping('full-name').pdfFieldName).getText()
    ).toBe('Ada Lovelace');
    expect(
      form.getTextField(firstMapping('notes').pdfFieldName).isMultiline()
    ).toBe(true);
    expect(
      form.getCheckBox(firstMapping('consent').pdfFieldName).isChecked()
    ).toBe(true);
    expect(
      form
        .getRadioGroup(firstMapping('contact-method').pdfFieldName)
        .getSelected()
    ).toBe('email');
    expect(
      form
        .getCheckBox(optionMapping('services', 'consult').pdfFieldName)
        .isChecked()
    ).toBe(true);
    expect(
      form.getDropdown(firstMapping('location').pdfFieldName).getSelected()
    ).toEqual(['South office']);
  });

  it('returns deterministic field mappings', async () => {
    const first = await generatePdf(definition);
    const second = await generatePdf(definition);

    expect(first.mappings).toEqual(second.mappings);
    expect(
      first.mappings.every((mapping) =>
        mapping.pdfFieldName.startsWith('esheet_')
      )
    ).toBe(true);
  });

  it('paginates long forms and reports unsupported fields', async () => {
    const longDefinition: FormDefinition = {
      id: 'long-form',
      pages: [
        {
          id: 'page-1',
          fields: [
            ...Array.from({ length: 30 }, (_, index) => ({
              id: `field-${index}`,
              fieldType: 'text' as const,
              question: `Question ${index + 1}`,
            })),
            {
              id: 'signature',
              fieldType: 'signature',
              question: 'Signature',
            },
          ],
        },
      ],
    };

    const generated = await generatePdf(longDefinition);

    expect(generated.pageCount).toBeGreaterThan(1);
    expect(generated.warnings).toContainEqual(
      expect.objectContaining({
        fieldId: 'signature',
        code: 'unsupported-field',
      })
    );
  });

  it('persists moved and newly added AcroForm fields', async () => {
    const generated = await generatePdf(definition);
    const moved = generated.mappings.map((mapping) =>
      mapping.esheetFieldId === 'full-name'
        ? { ...mapping, rect: [72, 500, 260, 32] as PdfFieldMapping['rect'] }
        : mapping
    );
    const added: PdfFieldMapping = {
      esheetFieldId: 'pdf-custom-note',
      pdfFieldName: 'esheet_custom_note',
      kind: 'text',
      page: 0,
      rect: [72, 430, 220, 28],
    };

    const bytes = await applyPdfFieldLayout(
      generated.bytes,
      [...moved, added],
      { addedFields: [added] }
    );
    const document = await PDFDocument.load(bytes);
    const form = document.getForm();
    const fullNameMapping = moved.find(
      (mapping) => mapping.esheetFieldId === 'full-name'
    );
    if (!fullNameMapping) throw new Error('Missing full-name mapping');
    const movedWidget = form
      .getTextField(fullNameMapping.pdfFieldName)
      .acroField.getWidgets()[0];
    if (!movedWidget) throw new Error('Missing moved widget');

    expect(movedWidget.getRectangle()).toEqual({
      x: 72,
      y: 500,
      width: 260,
      height: 32,
    });
    expect(form.getTextField(added.pdfFieldName)).toBeDefined();
  });
});
