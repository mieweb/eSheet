import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { applyPdfFieldLayout } from './apply-pdf-layout.js';
import { generatePdf } from './generate-pdf.js';
import { importPdf } from './import-pdf.js';

describe('importPdf', () => {
  it('imports supported AcroForm fields, values, mappings, and source metadata', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([612, 792]);
    const form = document.getForm();
    const name = form.createTextField('patient.name');
    name.setText('Ada Lovelace');
    name.addToPage(page, { x: 72, y: 700, width: 240, height: 24 });
    const consent = form.createCheckBox('consent');
    consent.check();
    consent.addToPage(page, { x: 72, y: 660, width: 18, height: 18 });
    const contact = form.createRadioGroup('contact');
    contact.addOptionToPage('email', page, {
      x: 72,
      y: 620,
      width: 18,
      height: 18,
    });
    contact.addOptionToPage('phone', page, {
      x: 120,
      y: 620,
      width: 18,
      height: 18,
    });
    contact.select('email');
    const location = form.createDropdown('location');
    location.setOptions(['North', 'South']);
    location.select('South');
    location.addToPage(page, { x: 72, y: 580, width: 120, height: 24 });

    const imported = await importPdf(await document.save());
    const byName = new Map(
      imported.definition.pages[0].fields?.map((field) => [
        (field._sourceData as { fieldName: string }).fieldName,
        field,
      ])
    );

    expect(imported.pageCount).toBe(1);
    expect(imported.warnings).toEqual([]);
    expect(byName.get('patient.name')).toMatchObject({
      fieldType: 'text',
      question: 'Name',
      _sourceData: {
        source: 'pdf',
        fieldName: 'patient.name',
        fieldType: 'text',
        widgets: [{ page: 0, rect: [71.5, 699.5, 241, 25] }],
      },
    });
    expect(byName.get('contact')).toMatchObject({
      fieldType: 'radio',
      options: [{ value: 'email' }, { value: 'phone' }],
    });
    expect(byName.get('location')).toMatchObject({
      fieldType: 'dropdown',
      options: [{ value: 'North' }, { value: 'South' }],
    });
    expect(imported.responses).toMatchObject({
      [byName.get('patient.name')?.id ?? '']: { answer: 'Ada Lovelace' },
      [byName.get('consent')?.id ?? '']: {
        selected: { id: 'yes', value: 'Yes' },
      },
      [byName.get('contact')?.id ?? '']: {
        selected: { value: 'email' },
      },
      [byName.get('location')?.id ?? '']: {
        selected: { value: 'South' },
      },
    });
    expect(imported.mappings).toHaveLength(5);
    expect(
      imported.mappings
        .filter((mapping) => mapping.pdfFieldName === 'contact')
        .map((mapping) => mapping.optionId)
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^option-/),
        expect.stringMatching(/^option-/),
      ])
    );
  });

  it('retains fieldless PDFs with a warning', async () => {
    const document = await PDFDocument.create();
    document.addPage();

    const imported = await importPdf(await document.save());

    expect(imported.definition.pages[0].fields).toEqual([]);
    expect(imported.warnings).toContainEqual(
      expect.objectContaining({ code: 'no-acroform-fields' })
    );
  });

  it('restores eSheet questions from generated PDF tooltips', async () => {
    const generated = await generatePdf({
      id: 'oxygen-order',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'patient-last-name',
              fieldType: 'text',
              question: 'Last Name',
            },
            {
              id: 'patient-gender',
              fieldType: 'radio',
              question: "What is this person's gender?",
              options: [
                { id: 'female', value: 'Female' },
                { id: 'male', value: 'Male' },
              ],
            },
          ],
        },
      ],
    });

    const imported = await importPdf(generated.bytes);

    expect(imported.definition.pages[0].fields).toMatchObject([
      { question: 'Last Name' },
      { question: "What is this person's gender?" },
    ]);
  });

  it('restores complete eSheet metadata from a generated PDF manifest', async () => {
    const definition = {
      id: 'home-o2-std-questionnaire',
      title: 'Home Oxygen Therapy Order Template',
      _sourceData: {
        url: 'http://example.org/fhir/Questionnaire/home-o2-std-questionnaire',
        status: 'active',
      },
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: '1',
              question: 'Patient Information',
              title: 'Patient Information',
              fieldType: 'section' as const,
              _sourceData: { fhirItemType: 'group' },
              fields: [
                {
                  id: '1.1',
                  question: 'Last Name',
                  required: true,
                  fieldType: 'text' as const,
                  inputType: 'string' as const,
                  _sourceData: { fhirItemType: 'string' },
                },
                {
                  id: '1.gender',
                  question: "What is this person's gender?",
                  fieldType: 'radio' as const,
                  options: [],
                  _sourceData: {
                    fhirItemType: 'choice',
                    answerValueSet:
                      'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                  },
                },
              ],
            },
            {
              id: '2.1',
              question: 'Deadline for submission (7 days from now)',
              fieldType: 'text' as const,
              inputType: 'date' as const,
              _sourceData: {
                fhirItemType: 'date',
                readOnly: true,
                initialExpression: { expression: 'today() + 7 days' },
              },
              rules: [
                {
                  effect: 'setValue' as const,
                  logic: 'AND' as const,
                  conditions: [
                    {
                      conditionType: 'expression' as const,
                      expression: 'addDays(today(), 7)',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const generated = await generatePdf(definition);

    const imported = await importPdf(generated.bytes);

    expect(imported.definition).toEqual(definition);
    expect(imported.mappings).toEqual(generated.mappings);
  });

  it('adds text widgets and a manifest to an enhanced source PDF', async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    const definition = {
      id: 'enhanced-source',
      title: 'Enhanced source PDF',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'name', fieldType: 'text' as const, question: 'Name' },
          ],
        },
      ],
    };
    const mapping = {
      esheetFieldId: 'name',
      pdfFieldName: 'name',
      kind: 'text' as const,
      page: 0,
      rect: [72, 680, 240, 24] as [number, number, number, number],
    };

    const enhanced = await applyPdfFieldLayout(await source.save(), [mapping], {
      addedFields: [mapping],
      definition,
    });
    const document = await PDFDocument.load(enhanced);
    const imported = await importPdf(enhanced);

    expect(document.getForm().getTextField('name')).toBeDefined();
    expect(imported.definition).toEqual(definition);
    expect(imported.mappings).toEqual([mapping]);
  });

  it('adds dropdown widgets with eSheet options to an enhanced source PDF', async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    const definition = {
      id: 'enhanced-source-dropdown',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'location',
              fieldType: 'dropdown' as const,
              question: 'Location',
              options: [
                { id: 'north', value: 'North' },
                { id: 'south', value: 'South' },
              ],
            },
          ],
        },
      ],
    };
    const mapping = {
      esheetFieldId: 'location',
      pdfFieldName: 'location',
      kind: 'dropdown' as const,
      page: 0,
      rect: [72, 680, 240, 24] as [number, number, number, number],
    };

    const enhanced = await applyPdfFieldLayout(await source.save(), [mapping], {
      addedFields: [mapping],
      definition,
    });
    const document = await PDFDocument.load(enhanced);
    const imported = await importPdf(enhanced);

    expect(document.getForm().getDropdown('location').getOptions()).toEqual([
      'North',
      'South',
    ]);
    expect(imported.definition).toEqual(definition);
    expect(imported.mappings).toEqual([mapping]);
  });

  it('writes eSheet labels and required state to mapped source fields', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([612, 792]);
    const sourceField = source.getForm().createTextField('name');
    sourceField.addToPage(page, { x: 72, y: 680, width: 240, height: 24 });
    const definition = {
      id: 'source-field-metadata',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'name',
              fieldType: 'text' as const,
              question: 'Applicant name',
              required: true,
            },
          ],
        },
      ],
    };
    const mapping = {
      esheetFieldId: 'name',
      pdfFieldName: 'name',
      kind: 'text' as const,
      page: 0,
      rect: [72, 680, 240, 24] as [number, number, number, number],
    };

    const enhanced = await applyPdfFieldLayout(await source.save(), [mapping], {
      definition,
    });
    const updatedField = (await PDFDocument.load(enhanced))
      .getForm()
      .getTextField('name');

    expect(updatedField.isRequired()).toBe(true);
    expect(
      updatedField.acroField.dict
        .lookup(PDFName.of('TU'), PDFString)
        .decodeText()
    ).toBe('Applicant name');
  });
});
