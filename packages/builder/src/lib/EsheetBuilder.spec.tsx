import {
  render,
  cleanup,
  act,
  fireEvent,
  waitFor,
  screen,
} from '@testing-library/react';
import {
  createFormStore,
  createUIStore,
  type FormDefinition,
  type FormStore,
  type UIState,
} from '@esheet/core';
import {
  EsheetBuilder,
  useFormStore,
  useUI,
  FormStoreContext,
  UIContext,
} from './EsheetBuilder.js';
import { registerCustomFieldTypes } from '@esheet/fields';
import { BuilderHeader } from './components/BuilderHeader.js';
import { EditPanel } from './components/edit-panel/EditPanel.js';
import { useFormApi } from './hooks/useFormApi.js';
import { createBuilderTools } from './builder-tools.js';
import type { StoreApi } from 'zustand';
import { vi } from 'vitest';

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
