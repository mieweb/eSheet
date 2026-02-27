import { render, cleanup, act } from '@testing-library/react';
import { MsheetBuilder, useEngine, useUI } from './MsheetBuilder.js';

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
      const engine = useEngine();
      engineFields = engine.getState().normalized.rootIds;
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

  it('should fire onChange when engine updates', () => {
    const changes: unknown[] = [];
    let engine: ReturnType<typeof useEngine> | null = null;

    function Capture() {
      engine = useEngine();
      return null;
    }

    render(
      <MsheetBuilder onChange={(def) => changes.push(def)}>
        <Capture />
      </MsheetBuilder>
    );

    act(() => {
      engine!.getState().loadDefinition({
        schemaType: 'mieforms-v1.0',
        fields: [{ id: 'f1', fieldType: 'text' }],
      });
    });

    expect(changes.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide engine and ui via context hooks', () => {
    let hasEngine = false;
    let hasUI = false;

    function Inspector() {
      const engine = useEngine();
      const ui = useUI();
      hasEngine = !!engine;
      hasUI = !!ui;
      return null;
    }

    render(
      <MsheetBuilder>
        <Inspector />
      </MsheetBuilder>
    );

    expect(hasEngine).toBe(true);
    expect(hasUI).toBe(true);
  });
});
