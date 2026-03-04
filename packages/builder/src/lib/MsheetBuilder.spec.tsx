import { render, cleanup, act } from '@testing-library/react';
import { MsheetBuilder, useFormStore, useUI } from './MsheetBuilder.js';

afterEach(cleanup);

describe('MsheetBuilder', () => {
  it('should render the 3-panel layout', () => {
    const { container } = render(<MsheetBuilder />);
    expect(container.querySelector('.ms-builder-root')).not.toBeNull();
    expect(container.textContent).toContain('Tool Panel');
    expect(container.textContent).toContain('Canvas');
    expect(container.textContent).toContain('Edit Panel');
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
