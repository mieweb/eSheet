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
import { registerCustomFieldTypes } from '@esheet/fields';
import { BuilderHeader } from './components/BuilderHeader.js';
import { PdfView, type ImportedPdfSession } from './components/PdfView.js';
import { EditPanel } from './components/edit-panel/EditPanel.js';
import { useFormApi } from './hooks/useFormApi.js';
import { createBuilderTools } from './builder-tools.js';
import { executeToolCall } from './mcp/tool-executor.js';
import type { StoreApi } from 'zustand';
import { vi } from 'vitest';

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

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

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

  it('edits diagram attachments for root and section child fields in the Edit panel', () => {
    const form = createFormStore({
      id: 'diagram-attachments',
      pages: [
        {
          id: 'page',
          fields: [
            { id: 'diagram', fieldType: 'diagram' },
            { id: 'text', fieldType: 'text' },
            {
              id: 'section',
              fieldType: 'section',
              fields: [
                {
                  id: 'child',
                  fieldType: 'diagram',
                  allowImageAttachments: false,
                },
              ],
            },
          ],
        },
      ],
    });
    const ui = createUIStore();
    ui.getState().selectField('diagram');
    renderWithContexts(form, ui, <EditPanel />);
    const label = 'Allow image attachments in renderer';
    const toggle = screen.getByLabelText(label) as HTMLInputElement;

    expect(toggle.checked).toBe(true);
    expect(toggle.id).toContain('-editor-allow-image-attachments-diagram');
    fireEvent.click(toggle);
    expect(form.getState().getField('diagram')?.definition).toMatchObject({
      allowImageAttachments: false,
    });

    act(() => ui.getState().selectFieldChild('section', 'child'));
    const childToggle = screen.getByLabelText(label) as HTMLInputElement;
    expect(childToggle.checked).toBe(false);
    expect(childToggle.id).toContain('-editor-allow-image-attachments-child');
    fireEvent.click(childToggle);
    expect(form.getState().getField('child')?.definition).toMatchObject({
      allowImageAttachments: true,
    });
    expect(form.getState().getField('diagram')?.definition).toMatchObject({
      allowImageAttachments: false,
    });

    act(() => ui.getState().selectField('diagram'));
    expect((screen.getByLabelText(label) as HTMLInputElement).checked).toBe(
      false
    );
    act(() =>
      form.getState().updateField('diagram', { allowImageAttachments: true })
    );
    expect((screen.getByLabelText(label) as HTMLInputElement).checked).toBe(
      true
    );
    act(() => ui.getState().selectField('text'));
    expect(screen.queryByLabelText(label)).toBeNull();
  });

  it('updates longtext row limits through tools without allowing invalid limits or matrix arrays', () => {
    const form = createFormStore({
      id: 'tool-row-limits',
      pages: [
        {
          id: 'page',
          fields: [
            { id: 'notes', fieldType: 'longtext', rows: 2, maxRows: 8 },
            { id: 'matrix', fieldType: 'singlematrix', rows: [], columns: [] },
          ],
        },
      ],
    });
    const tools = createBuilderTools(form);
    expect(
      executeToolCall(
        'update_field',
        { fieldId: 'notes', updates: { rows: 5 } },
        tools
      )
    ).toBe('Updated field notes');
    const saved = tools.getField('notes')?.definition;
    expect(saved).toMatchObject({ rows: 5, maxRows: 8 });
    for (const updates of [
      { rows: 0 },
      { rows: 1.5 },
      { rows: '5' },
      { rows: [] },
      { rows: 9 },
      { maxRows: 4 },
      { question: 'Must not persist', rows: -1 },
    ]) {
      expect(
        executeToolCall('update_field', { fieldId: 'notes', updates }, tools)
      ).toContain('Invalid longtext row limits');
      expect(tools.getField('notes')?.definition).toEqual(saved);
    }
    for (const fieldId of ['notes', 'matrix']) {
      expect(
        executeToolCall(
          'update_field',
          { fieldId, updates: { columns: [] } },
          tools
        )
      ).toContain('Cannot set rows/columns');
    }
    expect(
      executeToolCall(
        'update_field',
        { fieldId: 'matrix', updates: { rows: [] } },
        tools
      )
    ).toContain('Cannot set rows/columns');
    expect(
      executeToolCall(
        'update_field',
        { fieldId: 'notes', updates: { rows: 10, maxRows: 12 } },
        tools
      )
    ).toBe('Updated field notes');
  });

  it('keeps summary rows as arrays for longtext and matrix fields', () => {
    const rows = [{ id: 'row-1', value: 'First row' }];
    const form = createFormStore({
      id: 'summary-rows',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'notes', fieldType: 'longtext', rows: 5 },
            { id: 'single', fieldType: 'singlematrix', rows, columns: [] },
            { id: 'multi', fieldType: 'multimatrix', rows, columns: [] },
          ],
        },
      ],
    });

    const { fields } = createBuilderTools(form).getFormSummary();
    expect(fields.map((field) => field.rows)).toEqual([[], rows, rows]);
    expect(fields[0].rows.map((row) => row.id)).toEqual([]);
  });

  it('edits and clears the longtext row limits', () => {
    const form = createFormStore({
      id: 'longtext-rows',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'notes', fieldType: 'longtext' },
            { id: 'name', fieldType: 'text' },
          ],
        },
      ],
    });
    const ui = createUIStore();
    ui.getState().selectField('notes');
    renderWithContexts(form, ui, <EditPanel />);

    const input = screen.getByLabelText('Minimum rows') as HTMLInputElement;
    const maximum = screen.getByLabelText('Maximum rows') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(maximum.value).toBe('');
    expect(input.id).toContain('-editor-rows-notes');
    expect(maximum.id).toContain('-editor-maxrows-notes');

    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ rows: 5 })
    );

    for (const value of ['0', '-1', '1.5']) {
      fireEvent.change(input, { target: { value } });
      expect(input.value).toBe(value);
      fireEvent.blur(input);
      expect(input.value).toBe('5');
      expect(form.getState().normalized.byId.notes?.definition).toEqual(
        expect.objectContaining({ rows: 5 })
      );
    }

    fireEvent.change(maximum, { target: { value: '8' } });
    fireEvent.blur(maximum);
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ rows: 5, maxRows: 8 })
    );

    for (const value of ['0', '-1', '1.5', '4']) {
      fireEvent.change(maximum, { target: { value } });
      fireEvent.blur(maximum);
      expect(maximum.value).toBe('8');
      expect(form.getState().normalized.byId.notes?.definition).toEqual(
        expect.objectContaining({ rows: 5, maxRows: 8 })
      );
    }

    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ rows: 5, maxRows: 8 })
    );

    fireEvent.change(maximum, { target: { value: '' } });
    fireEvent.blur(maximum);
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ maxRows: undefined })
    );

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ rows: undefined })
    );

    act(() => ui.getState().selectField('name'));
    expect(screen.queryByLabelText('Minimum rows')).toBeNull();
    expect(screen.queryByLabelText('Maximum rows')).toBeNull();
  });

  it('preserves intermediate row-limit digits until blur or Enter', () => {
    const form = createFormStore({
      id: 'row-limit-drafts',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'notes', fieldType: 'longtext', rows: 5 },
            { id: 'other', fieldType: 'longtext', rows: 3 },
          ],
        },
      ],
    });
    const ui = createUIStore();
    ui.getState().selectField('notes');
    renderWithContexts(form, ui, <EditPanel />);

    const minimum = screen.getByLabelText('Minimum rows') as HTMLInputElement;
    const maximum = screen.getByLabelText('Maximum rows') as HTMLInputElement;
    fireEvent.change(maximum, { target: { value: '1' } });
    expect(maximum.value).toBe('1');
    expect(
      form.getState().normalized.byId.notes?.definition
    ).not.toHaveProperty('maxRows');
    fireEvent.change(maximum, { target: { value: `${maximum.value}2` } });
    expect(maximum.value).toBe('12');
    expect(
      form.getState().normalized.byId.notes?.definition
    ).not.toHaveProperty('maxRows');
    fireEvent.blur(maximum);
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ maxRows: 12 })
    );

    act(() => minimum.focus());
    fireEvent.change(minimum, { target: { value: '' } });
    fireEvent.change(minimum, { target: { value: '1' } });
    fireEvent.change(minimum, { target: { value: `${minimum.value}0` } });
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ rows: 5 })
    );
    fireEvent.keyDown(minimum, { key: 'Enter' });
    expect(form.getState().normalized.byId.notes?.definition).toEqual(
      expect.objectContaining({ rows: 10 })
    );

    act(() => form.getState().updateField('notes', { rows: 6 }));
    expect(minimum.value).toBe('6');

    fireEvent.change(maximum, { target: { value: '2' } });
    act(() => ui.getState().selectField('other'));
    expect(
      (screen.getByLabelText('Minimum rows') as HTMLInputElement).value
    ).toBe('3');
    expect(
      (screen.getByLabelText('Maximum rows') as HTMLInputElement).value
    ).toBe('');
  });

  it('edits default options and text answers through core store actions', () => {
    const form = createFormStore({
      id: 'defaults',
      pages: [
        {
          id: 'main',
          fields: [
            {
              id: 'choice',
              fieldType: 'dropdown',
              options: [
                { id: 'a', value: 'First', defaultOption: true },
                { id: 'b', value: 'Second' },
              ],
            },
            { id: 'text', fieldType: 'text' },
          ],
        },
      ],
    });
    const ui = createUIStore();
    ui.getState().selectField('choice');
    renderWithContexts(form, ui, <EditPanel />);
    expect(
      (screen.getByLabelText('Default option 1') as HTMLInputElement).checked
    ).toBe(true);
    fireEvent.click(screen.getByLabelText('Default option 2'));
    expect(
      (screen.getByLabelText('Default option 1') as HTMLInputElement).checked
    ).toBe(false);
    expect(
      (screen.getByLabelText('Default option 2') as HTMLInputElement).checked
    ).toBe(true);
    fireEvent.change(screen.getByLabelText('Option 2'), {
      target: { value: 'Renamed second' },
    });
    expect(
      (screen.getByLabelText('Default option 2') as HTMLInputElement).checked
    ).toBe(true);
    fireEvent.click(screen.getByLabelText('Remove option 2'));
    expect(screen.queryByLabelText('Default option 2')).toBeNull();
    act(() => ui.getState().selectField('text'));
    fireEvent.change(screen.getByLabelText('Default answer'), {
      target: { value: 'Initial text' },
    });
    expect(form.getState().getField('text')?.definition).toMatchObject({
      defaultAnswer: 'Initial text',
    });
  });

  it('renders registered property editors for root and section child fields', () => {
    function PropertyEditor({
      fieldId,
      instanceId,
      onUpdate,
    }: import('@esheet/fields').FieldPropertyEditorProps) {
      return (
        <button
          type="button"
          id={`${instanceId}-property-${fieldId}`}
          onClick={() => onUpdate({ question: `edited-${fieldId}` })}
        >
          Edit {fieldId} property
        </button>
      );
    }

    registerCustomFieldTypes({
      propertyEditorTest: {
        label: 'Property editor test',
        category: 'rich',
        answerType: 'text',
        hasOptions: false,
        hasMatrix: false,
        defaultProps: {},
        component: () => null,
        propertyEditor: PropertyEditor,
      },
    });
    const form = createFormStore({
      id: 'property-editor-routing',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'root-1', fieldType: 'propertyEditorTest' },
            {
              id: 'section-1',
              fieldType: 'section',
              fields: [{ id: 'child-1', fieldType: 'propertyEditorTest' }],
            },
          ],
        },
      ],
    } as unknown as FormDefinition);
    const ui = createUIStore();

    ui.getState().selectField('root-1');
    const view = renderWithContexts(form, ui, <EditPanel />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit root-1 property' })
    );
    expect(form.getState().normalized.byId['root-1']?.definition.question).toBe(
      'edited-root-1'
    );
    fireEvent.change(screen.getByLabelText('Default answer'), {
      target: { value: 'Root default' },
    });
    expect(form.getState().getField('root-1')?.definition).toMatchObject({
      defaultAnswer: 'Root default',
    });

    act(() => ui.getState().selectFieldChild('section-1', 'child-1'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit child-1 property' })
    );
    expect(
      form.getState().normalized.byId['child-1']?.definition.question
    ).toBe('edited-child-1');
    fireEvent.change(screen.getByLabelText('Default answer'), {
      target: { value: 'Child default' },
    });
    expect(form.getState().getField('child-1')?.definition).toMatchObject({
      defaultAnswer: 'Child default',
    });
    view.unmount();
  });

  it.each(['text', 'longtext'] as const)(
    'sets and clears defaults for root and section child %s fields',
    (fieldType) => {
      const form = createFormStore({
        id: 'nested-defaults',
        pages: [
          {
            id: 'main',
            fields: [
              { id: 'root', fieldType },
              {
                id: 'section',
                fieldType: 'section',
                fields: [{ id: 'child', fieldType }],
              },
            ],
          },
        ],
      });
      const ui = createUIStore();
      ui.getState().selectField('root');
      renderWithContexts(form, ui, <EditPanel />);

      for (const id of ['root', 'child']) {
        if (id === 'child') {
          act(() => ui.getState().selectFieldChild('section', id));
        }
        fireEvent.change(screen.getByLabelText('Default answer'), {
          target: { value: 'Initial answer' },
        });
        expect(form.getState().getField(id)?.definition).toMatchObject({
          defaultAnswer: 'Initial answer',
        });
        fireEvent.change(screen.getByLabelText('Default answer'), {
          target: { value: '' },
        });
        expect(
          form.getState().getField(id)?.definition.defaultAnswer
        ).toBeUndefined();
      }
    }
  );

  it('updates Required on the Logic Editor target', () => {
    const form = createFormStore({
      id: 'logic-required-target',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'section-1',
              fieldType: 'section',
              fields: [{ id: 'child-1', fieldType: 'text' }],
            },
            { id: 'root-1', fieldType: 'text' },
          ],
        },
      ],
    });
    const ui = createUIStore();
    ui.getState().selectFieldChild('section-1', 'child-1');
    ui.getState().setEditTab('logic');

    renderWithContexts(form, ui, <EditPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Required' }));

    expect(
      form.getState().normalized.byId['child-1']?.definition.required
    ).toBe(true);
    expect(
      form.getState().normalized.byId['section-1']?.definition.required
    ).toBeUndefined();

    act(() => ui.getState().selectField('root-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Required' }));

    expect(form.getState().normalized.byId['root-1']?.definition.required).toBe(
      true
    );
  });

  it('does not rerender a field consumer for another field response', () => {
    const form = createFormStore({
      id: 'response-isolation',
      pages: [
        {
          id: 'page-1',
          fields: [
            { id: 'name', fieldType: 'text' },
            { id: 'documents', fieldType: 'text' },
          ],
        },
      ],
    });
    const ui = createUIStore();
    let renders = 0;

    function DocumentsFieldConsumer() {
      useFormApi('documents');
      renders += 1;
      return null;
    }

    renderWithContexts(form, ui, <DocumentsFieldConsumer />);
    const initialRenders = renders;

    act(() => form.getState().setResponse('name', { answer: 'typed' }));

    expect(renders).toBe(initialRenders);
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

describe('BuilderHeader export', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let createdBlobs: Blob[] = [];
  let downloadedFilename = '';

  beforeEach(() => {
    createdBlobs = [];
    downloadedFilename = '';
    URL.createObjectURL = ((blob: Blob) => {
      createdBlobs.push(blob);
      return 'blob:esheet-test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadedFilename = this.download;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('exports YAML by default with the canonical filename', async () => {
    const form = createFormStore({
      id: 'export-form',
      pages: [{ id: 'page-1', fields: [] }],
    });
    const ui = createUIStore();

    renderWithContexts(form, ui, <BuilderHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(
      (
        screen.getByRole('radio', {
          name: 'eSheet YAML (default)',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);

    fireEvent.click(
      screen.getByRole('button', { name: 'Use This ID & Export YAML' })
    );

    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0]?.type).toBe('application/yaml');
    expect(await createdBlobs[0]?.text()).toContain('id: export-form');
    expect(downloadedFilename).toBe('export-form.esheet.yaml');
  });

  it('exports JSON when explicitly selected', async () => {
    const form = createFormStore({
      id: 'export-form',
      pages: [{ id: 'page-1', fields: [] }],
    });
    const ui = createUIStore();

    renderWithContexts(form, ui, <BuilderHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('radio', { name: 'eSheet JSON' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Use This ID & Export JSON' })
    );

    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0]?.type).toBe('application/json');
    expect(JSON.parse(await createdBlobs[0]?.text())).toMatchObject({
      id: 'export-form',
    });
    expect(downloadedFilename).toBe('export-form.esheet.json');
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
