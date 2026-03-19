import {
  render,
  cleanup,
  act,
  fireEvent,
  waitFor,
  screen,
} from '@testing-library/react';
import { createFormStore, createUIStore } from '@msheet/core';
import { MsheetBuilder, useFormStore, useUI } from './MsheetBuilder.js';
import { BuilderHeader } from './components/BuilderHeader.js';
import './register-defaults.js';

afterEach(cleanup);

describe('MsheetBuilder', () => {
  it('should render the 3-panel layout', () => {
    const { container } = render(<MsheetBuilder />);
    expect(container.querySelector('.ms-builder-root')).not.toBeNull();
    expect(container.querySelector('.panel-tools')).not.toBeNull();
    expect(container.querySelector('.panel-canvas')).not.toBeNull();
    expect(container.querySelector('.panel-editor')).not.toBeNull();
  });

  it('should load initial definition', () => {
    let engineFields: readonly string[] = [];

    function Inspector() {
      const form = useFormStore();
      engineFields = form.getState().normalized.rootIds;
      return null;
    }

    render(
      <MsheetBuilder
        definition={{
          schemaType: 'mieforms-v1.0',
          fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
        }}
      >
        <Inspector />
      </MsheetBuilder>
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
      <MsheetBuilder onChange={(def) => changes.push(def)}>
        <Capture />
      </MsheetBuilder>
    );

    act(() => {
      form!.getState().loadDefinition({
        schemaType: 'mieforms-v1.0',
        fields: [{ id: 'f1', fieldType: 'text' }],
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
      <MsheetBuilder>
        <Inspector />
      </MsheetBuilder>
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

    render(<BuilderHeader form={form} ui={ui} />);

    const input = screen.getByLabelText('Import form (JSON or YAML)') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['x'], 'bad.json', { type: 'application/json' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Import Failed')).toBeTruthy();
      expect(screen.getByText('Invalid JSON file format.')).toBeTruthy();
    });

    expect(form.getState().normalized.rootIds.length).toBe(0);
  });

  it('shows error modal for schema-invalid import', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockFileContent = JSON.stringify({
      schemaType: 'mieforms-v2',
      fields: [{ fieldType: 'text' }],
    });

    render(<BuilderHeader form={form} ui={ui} />);

    const input = screen.getByLabelText('Import form (JSON or YAML)') as HTMLInputElement;
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

    expect(form.getState().normalized.rootIds.length).toBe(0);
  });

  it('imports with warning modal when runtime-quality issues are detected', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockFileContent = JSON.stringify({
      schemaType: 'mieforms-v1.0',
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
    });

    render(<BuilderHeader form={form} ui={ui} />);

    const input = screen.getByLabelText('Import form (JSON or YAML)') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['x'], 'with-warnings.json', { type: 'application/json' }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Imported With Warnings')).toBeTruthy();
      expect(screen.getByText(/found 2 issue\(s\)/)).toBeTruthy();
      expect(screen.getByText(/is missing targetId/)).toBeTruthy();
    });

    expect(form.getState().normalized.rootIds).toContain('a');
    expect(form.getState().normalized.rootIds).toContain('b');
  });

  it('shows success modal for clean import', async () => {
    const form = createFormStore();
    const ui = createUIStore();
    mockFileContent = JSON.stringify({
      schemaType: 'mieforms-v1.0',
      fields: [{ id: 'ok', fieldType: 'text', question: 'OK' }],
    });

    render(<BuilderHeader form={form} ui={ui} />);

    const input = screen.getByLabelText('Import form (JSON or YAML)') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['x'], 'good.json', { type: 'application/json' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Import Successful')).toBeTruthy();
      expect(screen.getByText('Loaded 1 field(s).')).toBeTruthy();
    });

    expect(form.getState().normalized.rootIds).toContain('ok');
  });
});
