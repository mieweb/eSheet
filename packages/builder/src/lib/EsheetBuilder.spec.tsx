import {
  render,
  cleanup,
  act,
  fireEvent,
  waitFor,
  screen,
} from '@testing-library/react';
import React from 'react';
import {
  createFormStore,
  createUIStore,
  type FormDefinition,
  type FormStore,
  type UIState,
} from '@esheet/core';
import {
  EsheetBuilder,
  type EsheetBuilderHandle,
  useFormStore,
  useUI,
  FormStoreContext,
  UIContext,
} from './EsheetBuilder.js';
import { BuilderHeader } from './components/BuilderHeader.js';
import { PdfView, type ImportedPdfSession } from './components/PdfView.js';
import type { StoreApi } from 'zustand';

const mockImportPdf = vi.hoisted(() => vi.fn());
const mockGetDocument = vi.hoisted(() => vi.fn());

vi.mock('@esheet/pdf', () => ({
  applyPdfFieldLayout: vi.fn(),
  applyPdfPlacementOverrides: vi.fn((_, mappings) => mappings),
  generatePdf: vi.fn().mockResolvedValue({
    bytes: new Uint8Array([1]),
    mappings: [],
    pageCount: 1,
  }),
  importPdf: mockImportPdf,
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: mockGetDocument,
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'pdf-worker.js',
}));

function renderWithContexts(
  form: FormStore,
  ui: StoreApi<UIState>,
  children: React.ReactNode
) {
  return render(
    <FormStoreContext.Provider value={form}>
      <UIContext.Provider value={ui}>{children}</UIContext.Provider>
    </FormStoreContext.Provider>
  );
}

afterEach(cleanup);

describe('EsheetBuilder', () => {
  it('loads a PDF through its handle and retains the document session', async () => {
    const ref = React.createRef<EsheetBuilderHandle>();
    let form: FormStore | null = null;
    mockImportPdf.mockResolvedValue({
      definition: {
        id: 'imported-form',
        pages: [
          {
            id: 'imported-page',
            fields: [{ id: 'name', fieldType: 'text', question: 'Name' }],
          },
        ],
      },
      responses: { name: { answer: 'Ada Lovelace' } },
      mappings: [],
      sourcePdf: new Uint8Array([37, 80, 68, 70]),
      warnings: [],
      pageCount: 1,
    });

    function Capture() {
      form = useFormStore();
      return null;
    }

    render(
      <EsheetBuilder ref={ref}>
        <Capture />
      </EsheetBuilder>
    );

    let session: ImportedPdfSession | undefined;
    await act(async () => {
      session = await ref.current?.loadPdf(new Uint8Array([37, 80, 68, 70]));
    });

    expect(mockImportPdf).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(session?.pageCount).toBe(1);
    expect(form!.getState().responses).toEqual({
      name: { answer: 'Ada Lovelace' },
    });
    expect(screen.getByText('PDF designer')).toBeTruthy();
  });

  it('should render the 3-panel layout', () => {
    const { container } = render(<EsheetBuilder />);
    expect(container.querySelector('.ms-builder-root')).not.toBeNull();
    expect(container.querySelector('.panel-tools')).not.toBeNull();
    expect(container.querySelector('.panel-canvas')).not.toBeNull();
    expect(container.querySelector('.panel-editor')).not.toBeNull();
  });

  it('should load initial definition', () => {
    let engineFields: readonly string[] = [];

    function Inspector() {
      const form = useFormStore();
      engineFields = form.getState().normalized.pages[0]?.fieldIds ?? [];
      return null;
    }

    render(
      <EsheetBuilder
        definition={{
          id: 'initial-form',
          pages: [
            {
              id: 'page-1',
              fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
            },
          ],
        }}
      >
        <Inspector />
      </EsheetBuilder>
    );

    // Wait — definition is loaded synchronously in ref init.
    expect(engineFields).toContain('q1');
  });

  it('should fire onChange when form updates', () => {
    const changes: unknown[] = [];
    let form: ReturnType<typeof useFormStore> | null = null;

    function Capture() {
      form = useFormStore();
      return null;
    }

    render(
      <EsheetBuilder onChange={(def: FormDefinition) => changes.push(def)}>
        <Capture />
      </EsheetBuilder>
    );

    act(() => {
      form!.getState().loadDefinition({
        id: 'change-form',
        pages: [{ id: 'page-1', fields: [{ id: 'f1', fieldType: 'text' }] }],
      });
    });

    expect(changes.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide form and ui via context hooks', () => {
    let hasForm = false;
    let hasUI = false;

    function Inspector() {
      const form = useFormStore();
      const ui = useUI();
      hasForm = !!form;
      hasUI = !!ui;
      return null;
    }

    render(
      <EsheetBuilder>
        <Inspector />
      </EsheetBuilder>
    );

    expect(hasForm).toBe(true);
    expect(hasUI).toBe(true);
  });
});

describe('BuilderHeader import feedback', () => {
  const originalFileReader = globalThis.FileReader;
  let mockFileContent = '';

  class MockFileReader {
    public onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;

    readAsText() {
      this.onload?.({
        target: { result: mockFileContent },
      } as unknown as ProgressEvent<FileReader>);
    }
  }

  beforeEach(() => {
    mockFileContent = '';
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  });

  afterEach(() => {
    globalThis.FileReader = originalFileReader;
  });

  it('shows error modal for invalid JSON import', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockFileContent = '{ invalid json';

    renderWithContexts(form, ui, <BuilderHeader />);

    const input = screen.getByLabelText(
      'Import form (JSON or YAML)'
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['x'], 'bad.json', { type: 'application/json' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Import Failed')).toBeTruthy();
      expect(screen.getByText('Invalid JSON file format.')).toBeTruthy();
    });

    expect(form.getState().normalized.pages[0]?.fieldIds.length ?? 0).toBe(0);
  });

  it('shows error modal for schema-invalid import', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockFileContent = JSON.stringify({
      id: 'invalid-schema',
      fields: [{ fieldType: 'text' }],
    });

    renderWithContexts(form, ui, <BuilderHeader />);

    const input = screen.getByLabelText(
      'Import form (JSON or YAML)'
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['x'], 'invalid-schema.json', { type: 'application/json' }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Import Failed')).toBeTruthy();
      expect(
        screen.getByText(
          'The file is valid JSON but does not match the form schema.'
        )
      ).toBeTruthy();
    });

    expect(form.getState().normalized.pages[0]?.fieldIds.length ?? 0).toBe(0);
  });

  it('blocks import when runtime-quality issues are detected', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockFileContent = JSON.stringify({
      id: 'with-warnings',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'a', fieldType: 'text', question: 'A' },
            {
              id: 'b',
              fieldType: 'text',
              question: 'B',
              rules: [
                {
                  effect: 'visible',
                  logic: 'AND',
                  conditions: [{ conditionType: 'field' }],
                },
              ],
            },
          ],
        },
      ],
    });

    renderWithContexts(form, ui, <BuilderHeader />);

    const input = screen.getByLabelText(
      'Import form (JSON or YAML)'
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['x'], 'with-warnings.json', { type: 'application/json' }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Import Blocked')).toBeTruthy();
      expect(
        screen.getByText(/contains 2 unsupported issue\(s\)/)
      ).toBeTruthy();
      expect(screen.getByText(/is missing targetId/)).toBeTruthy();
    });

    expect(form.getState().normalized.pages[0]?.fieldIds.length ?? 0).toBe(0);
  });

  it('shows success modal for clean import', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockFileContent = JSON.stringify({
      id: 'good-form',
      pages: [
        {
          id: 'page-1',
          fields: [{ id: 'ok', fieldType: 'text', question: 'OK' }],
        },
      ],
    });

    renderWithContexts(form, ui, <BuilderHeader />);

    const input = screen.getByLabelText(
      'Import form (JSON or YAML)'
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['x'], 'good.json', { type: 'application/json' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Import Successful')).toBeTruthy();
      expect(screen.getByText('Loaded 1 field(s).')).toBeTruthy();
    });

    expect(form.getState().normalized.pages[0]?.fieldIds ?? []).toContain('ok');
  });
});

describe('BuilderHeader PDF representation', () => {
  it('keeps Build and Preview activity while switching their representations', () => {
    render(<EsheetBuilder />);
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(screen.getByText('PDF designer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Build' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(screen.getByText('PDF preview')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Add field' })).toBeNull();
  });
});

describe('PdfView import workflow', () => {
  beforeEach(() => {
    mockImportPdf.mockReset();
    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: new Promise(() => undefined),
    });
  });

  it('confirms replacement then loads imported fields and responses', async () => {
    const form = createFormStore({
      id: 'existing-form',
      pages: [
        {
          id: 'page-1',
          fields: [{ id: 'existing', fieldType: 'text', question: 'Existing' }],
        },
      ],
    });
    const ui = createUIStore();
    mockImportPdf.mockResolvedValue({
      definition: {
        id: 'imported-form',
        pages: [
          {
            id: 'imported-page',
            fields: [
              { id: 'imported-name', fieldType: 'text', question: 'Name' },
            ],
          },
        ],
      },
      responses: { 'imported-name': { answer: 'Ada Lovelace' } },
      mappings: [],
      sourcePdf: new Uint8Array([37, 80, 68, 70]),
      warnings: [],
      pageCount: 1,
    });

    renderWithContexts(form, ui, <PdfView />);
    fireEvent.change(screen.getByLabelText('Open PDF'), {
      target: {
        files: [new File(['pdf'], 'intake.pdf', { type: 'application/pdf' })],
      },
    });

    expect(mockImportPdf).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', {
        name: 'Replace the current questionnaire?',
      })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Replace and open' }));

    await waitFor(() => {
      expect(mockImportPdf).toHaveBeenCalledTimes(1);
    });
    expect(form.getState().normalized.pages[0]?.fieldIds).toEqual([
      'imported-name',
    ]);
    expect(form.getState().responses).toEqual({
      'imported-name': { answer: 'Ada Lovelace' },
    });
  });

  it('shows fieldless import warnings and failures', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockImportPdf.mockResolvedValueOnce({
      definition: {
        id: 'fieldless-pdf',
        pages: [{ id: 'pdf-page-1', fields: [] }],
      },
      responses: {},
      mappings: [],
      sourcePdf: new Uint8Array([37, 80, 68, 70]),
      warnings: [
        {
          code: 'no-acroform-fields',
          message: 'The PDF has no supported AcroForm fields.',
        },
      ],
      pageCount: 1,
    });

    renderWithContexts(form, ui, <PdfView />);
    const input = screen.getByLabelText('Open PDF');
    fireEvent.change(input, {
      target: {
        files: [new File(['pdf'], 'flat.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(
        screen.getByText('The PDF has no supported AcroForm fields.')
      ).toBeTruthy();
    });

    mockImportPdf.mockRejectedValueOnce(new Error('The PDF is malformed.'));
    fireEvent.change(input, {
      target: {
        files: [new File(['pdf'], 'bad.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replace and open' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'The PDF is malformed.'
      );
    });
  });

  it('retains an imported PDF session when the view remounts', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockImportPdf.mockResolvedValue({
      definition: {
        id: 'imported-form',
        pages: [{ id: 'page-1', fields: [] }],
      },
      responses: {},
      mappings: [],
      sourcePdf: new Uint8Array([37, 80, 68, 70]),
      warnings: [],
      pageCount: 1,
    });

    function SessionHost() {
      const [visible, setVisible] = React.useState(true);
      const [session, setSession] = React.useState<ImportedPdfSession | null>(
        null
      );
      return (
        <>
          <button type="button" onClick={() => setVisible((value) => !value)}>
            Toggle PDF view
          </button>
          {visible && (
            <PdfView
              importedSession={session}
              onImportedSessionChange={setSession}
            />
          )}
        </>
      );
    }

    renderWithContexts(form, ui, <SessionHost />);
    fireEvent.change(screen.getByLabelText('Open PDF'), {
      target: {
        files: [new File(['pdf'], 'intake.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(mockGetDocument).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle PDF view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle PDF view' }));

    await waitFor(() => {
      expect(mockGetDocument).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText(/Imported source and field layer/)).toBeTruthy();
  });

  it('updates an imported mapping when its placed field is renamed', async () => {
    const form = createFormStore({
      id: 'imported-form',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'text-field-2',
              fieldType: 'text',
              question: 'Ref. Dr.',
              _sourceData: {
                source: 'pdf',
                fieldName: 'ref-doctor-source',
              },
            },
          ],
        },
      ],
    });
    const ui = createUIStore();

    function SessionHost() {
      const [session, setSession] = React.useState<ImportedPdfSession | null>({
        sourcePdf: new Uint8Array([37, 80, 68, 70]),
        mappings: [
          {
            esheetFieldId: 'text-field-2',
            pdfFieldName: 'ref-doctor-source',
            kind: 'text',
            page: 0,
            rect: [292, 723, 104, 24],
          },
        ],
        sourceFieldNames: [],
        warnings: [],
        pageCount: 1,
      });
      return (
        <>
          <output>
            {session?.mappings[0]?.esheetFieldId}|
            {session?.mappings[0]?.pdfFieldName}
          </output>
          <PdfView
            importedSession={session}
            onImportedSessionChange={setSession}
          />
        </>
      );
    }

    renderWithContexts(form, ui, <SessionHost />);

    act(() => {
      form.getState().updateField('text-field-2', { id: 'ref-doctor' });
    });

    await waitFor(() => {
      expect(screen.getByText('ref-doctor|ref-doctor-source')).toBeTruthy();
    });
  });

  it('creates distinct fields for manually added PDF text boxes and deletes the selected field', async () => {
    const form = createFormStore({
      id: 'imported-form',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'question-1', fieldType: 'text', question: 'Question 1' },
          ],
        },
      ],
    });
    const ui = createUIStore();
    mockGetDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({
            width: 612,
            height: 792,
            viewBox: [0, 0, 612, 792],
            convertToViewportPoint: (x: number, y: number) => [x, y],
            convertToPdfPoint: (x: number, y: number) => [x, y],
          }),
          render: () => ({ cancel: vi.fn(), promise: Promise.resolve() }),
        }),
      }),
    });

    function SessionHost() {
      const [session, setSession] = React.useState<ImportedPdfSession | null>({
        sourcePdf: new Uint8Array([37, 80, 68, 70]),
        mappings: [],
        sourceFieldNames: [],
        warnings: [],
        pageCount: 1,
      });
      return (
        <>
          <output>
            {session?.mappings
              .map((mapping) => mapping.esheetFieldId)
              .join(',')}
          </output>
          <PdfView
            importedSession={session}
            onImportedSessionChange={setSession}
          />
        </>
      );
    }

    renderWithContexts(form, ui, <SessionHost />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: '+ Add field' })
          .hasAttribute('disabled')
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Add field' }));
    expect(screen.getByRole('menuitem', { name: 'Checkbox' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Radio button' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Text field' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add field' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Text field' }));

    await waitFor(() => {
      expect(screen.getByText('text-field,text-field-1')).toBeTruthy();
    });
    expect(form.getState().normalized.byId['question-1']).toBeDefined();
    expect(form.getState().normalized.byId['text-field']).toBeDefined();
    expect(form.getState().normalized.byId['text-field-1']).toBeDefined();

    fireEvent.change(screen.getByLabelText('PDF field label'), {
      target: { value: 'Custom field' },
    });
    fireEvent.change(screen.getByLabelText('PDF field name'), {
      target: { value: 'custom_field_name' },
    });
    fireEvent.blur(screen.getByLabelText('PDF field name'));
    fireEvent.click(screen.getByLabelText('Required PDF field'));

    expect(form.getState().getField('text-field-1')?.definition.question).toBe(
      'Custom field'
    );
    expect(form.getState().getField('text-field-1')?.definition.required).toBe(
      true
    );
    expect(
      form.getState().getField('text-field-1')?.definition._sourceData
    ).toMatchObject({
      esheet: { pdf: { fieldName: 'custom_field_name' } },
    });
    fireEvent.change(screen.getByLabelText('Width (pt)'), {
      target: { value: '260' },
    });
    fireEvent.change(screen.getByLabelText('Height (pt)'), {
      target: { value: '32' },
    });

    await waitFor(() => {
      expect(screen.getByText('text-field,text-field-1')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete PDF field' }));

    await waitFor(() => {
      expect(screen.getByText('text-field')).toBeTruthy();
    });
    expect(form.getState().normalized.byId['question-1']).toBeDefined();
    expect(form.getState().normalized.byId['text-field']).toBeDefined();
    expect(form.getState().normalized.byId['text-field-1']).toBeUndefined();
  });

  it('duplicates a manually authored PDF field with an offset mapping', async () => {
    const form = createFormStore({
      id: 'imported-form',
      pages: [{ id: 'page-1', fields: [] }],
    });
    const ui = createUIStore();
    mockGetDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({
            width: 612,
            height: 792,
            viewBox: [0, 0, 612, 792],
            convertToViewportPoint: (x: number, y: number) => [x, y],
            convertToPdfPoint: (x: number, y: number) => [x, y],
          }),
          render: () => ({ cancel: vi.fn(), promise: Promise.resolve() }),
        }),
      }),
    });

    function SessionHost() {
      const [session, setSession] = React.useState<ImportedPdfSession | null>({
        sourcePdf: new Uint8Array([37, 80, 68, 70]),
        mappings: [],
        sourceFieldNames: [],
        warnings: [],
        pageCount: 1,
      });
      return (
        <>
          <output>
            {session?.mappings
              .map(
                (mapping) =>
                  `${mapping.esheetFieldId}/${mapping.pdfFieldName}/${mapping.rect[0]}`
              )
              .join(',')}
          </output>
          <PdfView
            importedSession={session}
            onImportedSessionChange={setSession}
          />
        </>
      );
    }

    renderWithContexts(form, ui, <SessionHost />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: '+ Add field' })
          .hasAttribute('disabled')
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Add field' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Text field' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Duplicate PDF field' })
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'text-field/text-field/72,text-field-1/text-field-1/88'
        )
      ).toBeTruthy();
    });
    expect(form.getState().getField('text-field-1')?.definition).toMatchObject({
      fieldType: 'text',
      question: 'Text field',
    });
    expect(form.getState().responses['text-field-1']).toBeUndefined();
  });

  it('selects, resizes, and reorders widgets in PDF Build without answer inputs', async () => {
    const form = createFormStore({
      id: 'imported-form',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'first-name', fieldType: 'text', question: 'First name' },
            { id: 'patient-name', fieldType: 'text', question: 'Patient name' },
          ],
        },
      ],
    });
    const ui = createUIStore();
    mockGetDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({
            width: 612,
            height: 792,
            viewBox: [0, 0, 612, 792],
            convertToViewportPoint: (x: number, y: number) => [x, y],
            convertToPdfPoint: (x: number, y: number) => [x, y],
          }),
          render: () => ({ cancel: vi.fn(), promise: Promise.resolve() }),
        }),
      }),
    });

    function SessionHost() {
      const [session, setSession] = React.useState<ImportedPdfSession | null>({
        sourcePdf: new Uint8Array([37, 80, 68, 70]),
        mappings: [
          {
            esheetFieldId: 'patient-name',
            pdfFieldName: 'patient-name',
            kind: 'text',
            page: 0,
            rect: [72, 620, 220, 28],
          },
          {
            esheetFieldId: 'patient-name',
            pdfFieldName: 'patient-name',
            kind: 'text',
            page: 1,
            rect: [72, 620, 220, 28],
          },
        ],
        sourceFieldNames: ['patient-name'],
        warnings: [],
        pageCount: 2,
      });
      return (
        <>
          <output>
            {session?.mappings
              .map((mapping) => mapping.rect.join('/'))
              .join(',')}
          </output>
          <PdfView
            importedSession={session}
            onImportedSessionChange={setSession}
          />
        </>
      );
    }

    renderWithContexts(form, ui, <SessionHost />);

    await waitFor(() => {
      expect(screen.getAllByLabelText('PDF field patient-name')).toHaveLength(
        2
      );
    });
    expect(screen.queryByLabelText('PDF text field patient-name')).toBeNull();
    fireEvent.click(screen.getAllByLabelText('PDF field patient-name')[0]);
    expect(
      screen.getByText(
        '2 PDF widgets across pages 1, 2 share this questionnaire response.'
      )
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Width (pt)'), {
      target: { value: '260' },
    });
    fireEvent.change(screen.getByLabelText('Height (pt)'), {
      target: { value: '32' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Move PDF field earlier' })
    );

    await waitFor(() => {
      expect(screen.getByText('72/620/260/32,72/620/220/28')).toBeTruthy();
    });
    expect(form.getState().normalized.pages[0]?.fieldIds).toEqual([
      'patient-name',
      'first-name',
    ]);
    expect(form.getState().responses['patient-name']).toBeUndefined();
  });

  it('fills multi-page widgets in PDF Preview without authoring controls', async () => {
    const form = createFormStore({
      id: 'imported-form',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'patient-name', fieldType: 'text', question: 'Patient name' },
          ],
        },
      ],
    });
    const ui = createUIStore();
    mockGetDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({
            width: 612,
            height: 792,
            viewBox: [0, 0, 612, 792],
            convertToViewportPoint: (x: number, y: number) => [x, y],
            convertToPdfPoint: (x: number, y: number) => [x, y],
          }),
          render: () => ({ cancel: vi.fn(), promise: Promise.resolve() }),
        }),
      }),
    });

    function PreviewSessionHost() {
      const [session, setSession] = React.useState<ImportedPdfSession | null>({
        sourcePdf: new Uint8Array([37, 80, 68, 70]),
        mappings: [
          {
            esheetFieldId: 'patient-name',
            pdfFieldName: 'patient-name',
            kind: 'text',
            page: 0,
            rect: [72, 620, 220, 28],
          },
          {
            esheetFieldId: 'patient-name',
            pdfFieldName: 'patient-name',
            kind: 'text',
            page: 1,
            rect: [72, 620, 220, 28],
          },
        ],
        sourceFieldNames: ['patient-name'],
        warnings: [],
        pageCount: 2,
      });
      return (
        <PdfView
          authoring={false}
          importedSession={session}
          onImportedSessionChange={setSession}
        />
      );
    }

    renderWithContexts(form, ui, <PreviewSessionHost />);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText('PDF text field patient-name')
      ).toHaveLength(2);
    });
    expect(screen.queryByRole('button', { name: 'Move PDF field' })).toBeNull();
    fireEvent.change(
      screen.getAllByLabelText('PDF text field patient-name')[1],
      {
        target: { value: 'Ada' },
      }
    );

    expect(form.getState().responses['patient-name']).toEqual({
      answer: 'Ada',
    });
  });

  it('edits options for selected PDF radio groups and dropdowns', async () => {
    const form = createFormStore({
      id: 'imported-form',
      pages: [{ id: 'page-1', fields: [] }],
    });
    const ui = createUIStore();
    mockGetDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getViewport: () => ({
            width: 612,
            height: 792,
            viewBox: [0, 0, 612, 792],
            convertToViewportPoint: (x: number, y: number) => [x, y],
            convertToPdfPoint: (x: number, y: number) => [x, y],
          }),
          render: () => ({ cancel: vi.fn(), promise: Promise.resolve() }),
        }),
      }),
    });

    function SessionHost() {
      const [session, setSession] = React.useState<ImportedPdfSession | null>({
        sourcePdf: new Uint8Array([37, 80, 68, 70]),
        mappings: [],
        sourceFieldNames: [],
        warnings: [],
        pageCount: 1,
      });
      return (
        <>
          <output>
            {session?.mappings
              .map((mapping) => `${mapping.pdfFieldName}/${mapping.optionId}`)
              .join(',')}
          </output>
          <PdfView
            importedSession={session}
            onImportedSessionChange={setSession}
          />
        </>
      );
    }

    renderWithContexts(form, ui, <SessionHost />);

    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: '+ Add field' })
          .hasAttribute('disabled')
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Add field' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Radio button' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Add option to group' })
    );
    fireEvent.change(screen.getByLabelText('PDF option 1'), {
      target: { value: 'Email' },
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'radio-button/option-1,radio-button/radio-button-option'
        )
      ).toBeTruthy();
    });
    const radioField = form.getState().getField('radio-button')?.definition;
    expect(radioField?.fieldType).toBe('radio');
    if (radioField?.fieldType !== 'radio') {
      throw new Error('Expected the PDF field to be a radio group.');
    }
    expect(radioField.options).toHaveLength(2);
    expect(radioField.options?.[0]?.value).toBe('Email');
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove PDF option 2' })
    );

    await waitFor(() => {
      expect(screen.getByText('radio-button/option-1')).toBeTruthy();
    });
    expect(form.getState().getField('radio-button')?.definition).toMatchObject({
      options: [{ id: 'option-1', value: 'Email' }],
    });

    fireEvent.click(screen.getByRole('button', { name: '+ Add field' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Dropdown' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Add dropdown option' })
    );
    fireEvent.change(screen.getByLabelText('PDF option 1'), {
      target: { value: 'North' },
    });

    const dropdownField = form.getState().getField('dropdown')?.definition;
    expect(dropdownField?.fieldType).toBe('dropdown');
    if (dropdownField?.fieldType !== 'dropdown') {
      throw new Error('Expected the PDF field to be a dropdown.');
    }
    expect(dropdownField.options).toHaveLength(2);
    expect(dropdownField.options?.[0]?.value).toBe('North');
  });
});

describe('BuilderHeader dry run submit', () => {
  function createRequiredTextDefinition() {
    return {
      id: 'dry-run-form',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'q1',
              fieldType: 'text' as const,
              question: 'Name?',
              required: true,
            },
          ],
        },
      ],
    };
  }

  it('dry run shows failed result when required field is unanswered', async () => {
    const form = createFormStore(createRequiredTextDefinition());
    const ui = createUIStore();

    act(() => {
      ui.getState().setMode('preview');
    });

    renderWithContexts(form, ui, <BuilderHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Dry run submit' }));

    await waitFor(() => {
      expect(
        screen.getAllByText('Dry Run Submit Failed').length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText('Submit would fail validation with 1 error(s).')
          .length
      ).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/"wouldSubmit": false/).length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText(/"fieldId": "q1"/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/"rule": "required"/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryAllByText('Dry Run Submit Failed')).toHaveLength(0);
    });
  });

  it('dry run shows passed result with hydrated response when valid', async () => {
    const form = createFormStore(createRequiredTextDefinition());
    const ui = createUIStore();

    act(() => {
      ui.getState().setMode('preview');
      form.getState().setResponse('q1', { answer: 'Ada' });
    });

    renderWithContexts(form, ui, <BuilderHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Dry run submit' }));

    await waitFor(() => {
      expect(
        screen.getAllByText('Dry Run Submit Passed').length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText('Submit would pass validation.').length
      ).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/"wouldSubmit": true/).length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText(/"errorCount": 0/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/"id": "q1"/).length).toBeGreaterThan(0);
  });

  it('does not show dry run action outside preview mode', () => {
    const form = createFormStore(createRequiredTextDefinition());
    const ui = createUIStore();

    renderWithContexts(form, ui, <BuilderHeader />);

    expect(screen.queryByRole('button', { name: 'Dry run submit' })).toBeNull();
  });

  it('dry run excludes disabled answers from the serialized response payload', async () => {
    const form = createFormStore({
      id: 'conditional-form',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'trigger',
              fieldType: 'text',
              question: 'Trigger?',
            },
            {
              id: 'q1',
              fieldType: 'text',
              question: 'Name?',
              required: true,
              rules: [
                {
                  effect: 'enable',
                  logic: 'AND',
                  conditions: [
                    {
                      targetId: 'trigger',
                      operator: 'equals',
                      expected: 'enabled',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const ui = createUIStore();

    act(() => {
      ui.getState().setMode('preview');
      form.getState().setResponse('trigger', { answer: 'disabled' });
      form.getState().setResponse('q1', { answer: 'Ada' });
    });

    renderWithContexts(form, ui, <BuilderHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Dry run submit' }));

    await waitFor(() => {
      expect(
        screen.getAllByText('Dry Run Submit Passed').length
      ).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/"id": "trigger"/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/"id": "q1"/)).toBeNull();
  });
});
