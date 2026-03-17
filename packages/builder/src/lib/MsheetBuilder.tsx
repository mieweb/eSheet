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
import { PlusIcon } from './icons.js';

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
  /** Optional content rendered below the header (e.g. custom status/debug panels). */
  children?: React.ReactNode;
}

interface MobileBottomDrawerProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function MobileBottomDrawer({
  title,
  open,
  onClose,
  children,
}: MobileBottomDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="ms:lg:hidden ms:fixed ms:inset-0 ms:z-40 ms:bg-msoverlay ms:border-0"
        onClick={onClose}
        aria-label={`Close ${title} drawer`}
      />
      <div className="ms:lg:hidden ms:fixed ms:left-0 ms:right-0 ms:bottom-0 ms:z-50 ms:h-[50dvh] ms:bg-mssurface ms:border-t ms:border-msborder ms:rounded-t-2xl ms:shadow-2xl ms:overflow-hidden">
        <div className="ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-2 ms:border-b ms:border-msborder">
          <span className="ms:text-sm ms:font-medium ms:text-mstext">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="ms:px-2 ms:py-1 ms:bg-transparent ms:text-mstextmuted ms:border-0 ms:outline-none ms:focus:outline-none"
            aria-label={`Close ${title} drawer`}
          >
            Close
          </button>
        </div>
        <div className="ms:h-[calc(50dvh-45px)] ms:overflow-y-auto">{children}</div>
      </div>
    </>
  );
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
  const selectedFieldId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId
  );
  const editModalOpen = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().editModalOpen,
    () => ui.getState().editModalOpen
  );
  const [toolsModalOpen, setToolsModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (mode !== 'build') {
      setToolsModalOpen(false);
      ui.getState().setEditModalOpen(false);
    }
  }, [mode, ui]);

  React.useEffect(() => {
    if (!selectedFieldId && editModalOpen) {
      ui.getState().setEditModalOpen(false);
    }
  }, [selectedFieldId, editModalOpen, ui]);

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
            <div className="ms:sticky ms:top-0 ms:z-50 ms:bg-msbackground">
              <BuilderHeader form={form} ui={ui} />
            </div>
            {children}
            {mode === 'build' && (
              <div className="builder-layout ms:grid ms:flex-1 ms:min-h-0 ms:min-w-0 ms:grid-cols-1 ms:lg:grid-cols-[18rem_minmax(0,1fr)_340px] ms:gap-3 ms:overflow-hidden">
                <aside className="panel-tools-wrap panel-tools ms:hidden ms:lg:flex ms:self-start ms:min-h-0 ms:max-h-[calc(100dvh-12.5rem)] ms:overflow-y-auto ms:flex-col ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                  <ToolPanel form={form} ui={ui} />
                </aside>
                <main className="panel-canvas ms:self-start ms:min-w-0 ms:max-h-[calc(100dvh-12.5rem)] ms:overflow-y-auto ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-4">
                  <Canvas form={form} ui={ui} dragEnabled={dragEnabled} />
                  <div className="ms:lg:hidden ms:sticky ms:bottom-0 ms:z-20 ms:pt-2 ms:pb-3 ms:flex ms:justify-center ms:pointer-events-none">
                    <button
                      type="button"
                      onClick={() => setToolsModalOpen(true)}
                      className="ms:pointer-events-auto ms:inline-flex ms:items-center ms:gap-1.5 ms:px-3.5 ms:py-2 ms:rounded-full ms:bg-mssurface/95 ms:backdrop-blur-sm ms:text-mstext ms:text-sm ms:font-semibold ms:border ms:border-msprimary/35 ms:shadow-lg ms:shadow-msprimary/10 ms:outline-none ms:focus:outline-none ms:hover:bg-mssurface ms:hover:border-msprimary/50 ms:hover:shadow-xl ms:hover:shadow-msprimary/15 ms:transition-all"
                      aria-label="Open add field tools"
                    >
                      <PlusIcon className="ms:w-3.5 ms:h-3.5 ms:text-msprimary" />
                      <span>Add field</span>
                    </button>
                  </div>
                </main>
                <aside className="panel-editor-wrap panel-editor ms:hidden ms:lg:flex ms:self-start ms:min-h-0 ms:max-h-[calc(100dvh-12.5rem)] ms:overflow-y-auto ms:flex-col ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                  <EditPanel form={form} ui={ui} />
                </aside>

                <MobileBottomDrawer
                  title="Add Field"
                  open={toolsModalOpen}
                  onClose={() => setToolsModalOpen(false)}
                >
                  <ToolPanel form={form} ui={ui} />
                </MobileBottomDrawer>

                <MobileBottomDrawer
                  title="Edit Field"
                  open={editModalOpen && !!selectedFieldId}
                  onClose={() => ui.getState().setEditModalOpen(false)}
                >
                  <EditPanel form={form} ui={ui} />
                </MobileBottomDrawer>
              </div>
            )}
            {mode === 'code' && (
              <div className="code-layout ms:flex ms:h-[calc(100dvh-12.5rem)] ms:min-h-0 ms:min-w-0 ms:overflow-hidden ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                <CodeView form={form} ui={ui} />
              </div>
            )}
            {mode === 'preview' && (
              <div className="preview-layout ms:flex-1 ms:min-h-0 ms:min-w-0 ms:w-full ms:max-w-2xl ms:mx-auto ms:p-4 ms:max-h-[calc(100dvh-12.5rem)] ms:overflow-y-auto">
                <Canvas form={form} ui={ui} dragEnabled={false} />
              </div>
            )}
          </div>
        </InstanceIdContext.Provider>
      </UIContext.Provider>
    </FormStoreContext.Provider>
  );
}
