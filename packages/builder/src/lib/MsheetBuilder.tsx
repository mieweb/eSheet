import React from 'react';
import {
  createFormEngine,
  type FormDefinition,
  type FormEngine,
} from '@msheet/core';
import { createUIStore, type UIStore } from './ui-store.js';
import { Canvas } from './components/Canvas.js';
import { ToolPanel } from './components/ToolPanel.js';

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export const EngineContext = React.createContext<FormEngine | null>(null);
export const UIContext = React.createContext<UIStore | null>(null);
export const InstanceIdContext = React.createContext<string>('');

/** Hook to access the FormEngine from context. */
export function useEngine(): FormEngine {
  const ctx = React.useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used inside <MsheetBuilder>');
  return ctx;
}

/** Hook to access the builder UIStore from context. */
export function useUI(): UIStore {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <MsheetBuilder>');
  return ctx;
}

/** Hook to access the per-instance ID for unique DOM element IDs. */
export function useInstanceId(): string {
  return React.useContext(InstanceIdContext);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MsheetBuilderProps {
  /** Initial form definition to load. */
  definition?: FormDefinition;
  /** Callback fired when the form definition changes. */
  onChange?: (definition: FormDefinition) => void;
  /** Whether drag-and-drop reordering is enabled (default: true). Disable for better performance on slow devices. */
  dragEnabled?: boolean;
  /** Additional CSS class name. */
  className?: string;
  /** Child components (panels will replace these placeholders later). */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MsheetBuilder({
  definition,
  onChange,
  dragEnabled = true,
  className = '',
  children,
}: MsheetBuilderProps) {
  const engineRef = React.useRef<FormEngine | null>(null);
  const uiRef = React.useRef<UIStore | null>(null);

  if (!engineRef.current) {
    engineRef.current = createFormEngine(definition);
  }
  if (!uiRef.current) {
    uiRef.current = createUIStore();
  }

  const engine = engineRef.current;
  const ui = uiRef.current;

  // Stable per-instance ID for unique DOM element IDs
  const instanceId = React.useId();

  // Subscribe to engine changes and forward to onChange.
  React.useEffect(() => {
    if (!onChange) return;
    return engine.subscribe(() => {
      onChange(engine.getState().hydrateDefinition());
    });
  }, [engine, onChange]);

  return (
    <EngineContext.Provider value={engine}>
      <UIContext.Provider value={ui}>
        <InstanceIdContext.Provider value={instanceId}>
        <div className={`ms-builder-root ms:bg-msbackground ms:font-sans ms:text-mstext ${className}`.trim()}>
          {children}
          <div className="builder-layout ms:flex ms:gap-3">
            <aside className="panel-tools ms:w-72 ms:shrink-0 ms:bg-mssurface ms:rounded-lg ms:border ms:border-msborder ms:overflow-y-auto">
              <ToolPanel engine={engine} ui={ui} />
            </aside>
            <main className="panel-canvas ms:flex-1 ms:min-w-0 ms:bg-mssurface ms:rounded-lg ms:border ms:border-msborder ms:overflow-y-auto">
              <div className="ms:p-4">
                <Canvas engine={engine} ui={ui} dragEnabled={dragEnabled} />
              </div>
            </main>
            <aside className="panel-editor ms:w-[340px] ms:shrink-0 ms:bg-mssurface ms:rounded-lg ms:border ms:border-msborder ms:overflow-y-auto">
              <div className="ms:p-4 ms:text-mstextmuted ms:text-sm">Edit Panel</div>
            </aside>
          </div>
        </div>
        </InstanceIdContext.Provider>
      </UIContext.Provider>
    </EngineContext.Provider>
  );
}
