import React from 'react';
import { useSyncExternalStore } from 'react';
import {
  createFormStore,
  createUIStore,
  type FormDefinition,
  type FormStore,
  type UIStore,
} from '@msheet/core';
import { Canvas } from './components/Canvas.js';
import { ToolPanel } from './components/ToolPanel.js';
import { EditPanel } from './components/edit-panel/EditPanel.js';
import { BuilderHeader } from './components/BuilderHeader.js';
import { CodeView } from './components/CodeView.js';

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export const FormStoreContext = React.createContext<FormStore | null>(null);
export const UIContext = React.createContext<UIStore | null>(null);
export const InstanceIdContext = React.createContext<string>('');

/** Hook to access the FormStore from context. */
export function useFormStore(): FormStore {
  const ctx = React.useContext(FormStoreContext);
  if (!ctx) throw new Error('useFormStore must be used inside <MsheetBuilder>');
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
  const formRef = React.useRef<FormStore | null>(null);
  const uiRef = React.useRef<UIStore | null>(null);

  if (!formRef.current) {
    formRef.current = createFormStore(definition);
  }
  if (!uiRef.current) {
    uiRef.current = createUIStore();
  }

  const form = formRef.current;
  const ui = uiRef.current;

  // Stable per-instance ID for unique DOM element IDs
  const instanceId = React.useId();

  // Subscribe to mode for conditional rendering
  const mode = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().mode,
    () => ui.getState().mode
  );

  // Subscribe to form changes and forward to onChange.
  React.useEffect(() => {
    if (!onChange) return;
    return form.subscribe(() => {
      onChange(form.getState().hydrateDefinition());
    });
  }, [form, onChange]);

  return (
    <FormStoreContext.Provider value={form}>
      <UIContext.Provider value={ui}>
        <InstanceIdContext.Provider value={instanceId}>
          <div
            className={`ms-builder-root ms:flex ms:h-full ms:flex-1 ms:min-h-0 ms:max-h-full ms:w-full ms:min-w-0 ms:max-w-full ms:flex-col ms:gap-2 
                        ms:overflow-x-hidden ms:bg-msbackground ms:text-mstext ${className}`.trim()}
          >
            <div className="ms:sticky ms:top-0 ms:z-999 ms:bg-msbackground">
              <BuilderHeader form={form} ui={ui} />
            </div>
            {children}
            {mode === 'build' && (
              <div className="builder-layout ms:grid ms:flex-1 ms:min-h-0 ms:min-w-0 ms:grid-cols-[18rem_minmax(0,1fr)_340px] ms:gap-3 ms:overflow-hidden">
                <aside className="panel-tools-wrap panel-tools ms:flex ms:self-start ms:min-h-0 ms:max-h-[calc(100dvh-11.4rem)] ms:overflow-y-auto ms:flex-col ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                  <ToolPanel form={form} ui={ui} />
                </aside>
                <main className="panel-canvas ms:min-w-0 ms:min-h-0 ms:overflow-y-auto ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-4">
                  <Canvas form={form} ui={ui} dragEnabled={dragEnabled} />
                </main>
                <aside className="panel-editor-wrap panel-editor ms:flex ms:self-start ms:min-h-0 ms:max-h-[calc(100dvh-11.4rem)] ms:overflow-y-auto ms:flex-col ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                  <EditPanel form={form} ui={ui} />
                </aside>
              </div>
            )}
            {mode === 'code' && (
              <div className="code-layout ms:flex ms:flex-1 ms:min-h-0 ms:min-w-0 ms:max-h-full ms:overflow-hidden ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                <CodeView form={form} ui={ui} />
              </div>
            )}
            {mode === 'preview' && (
              <div className="preview-layout ms:flex-1 ms:min-h-0 ms:min-w-0 ms:w-full ms:max-w-2xl ms:mx-auto ms:p-4">
                <Canvas form={form} ui={ui} dragEnabled={false} />
              </div>
            )}
          </div>
        </InstanceIdContext.Provider>
      </UIContext.Provider>
    </FormStoreContext.Provider>
  );
}
