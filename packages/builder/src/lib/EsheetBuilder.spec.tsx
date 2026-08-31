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
import { BuilderHeader } from './components/BuilderHeader.js';
import { useFormApi } from './hooks/useFormApi.js';
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

afterEach(cleanup);

describe('EsheetBuilder', () => {
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
