import React from 'react';
import { useSyncExternalStore } from 'react';
import {
  createFormStore,
  createUIStore,
  type FormDefinition,
  type FormStore,
  type UIStore,
} from '@esheet/core';
import { FormStoreContext, UIContext } from '@esheet/fields';
import { Canvas } from './components/Canvas.js';
import { ToolPanel } from './components/ToolPanel.js';
import { EditPanel } from './components/edit-panel/EditPanel.js';
import { BuilderHeader } from './components/BuilderHeader.js';
import { CodeView } from './components/CodeView.js';
import { PlusIcon } from './icons.js';

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export {
  FormStoreContext,
  UIContext,
  useFormStore,
  useUI,
} from '@esheet/fields';
export const InstanceIdContext = React.createContext<string>('');

/** Hook to access the per-instance ID for unique DOM element IDs. */
export function useInstanceId(): string {
  return React.useContext(InstanceIdContext);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EsheetBuilderProps {
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
        className="es:lg:hidden es:fixed es:inset-0 es:z-40 es:bg-esoverlay es:border-0"
        onClick={onClose}
        aria-label={`Close ${title} drawer`}
      />
      <div className="es:lg:hidden es:fixed es:left-0 es:right-0 es:bottom-0 es:z-50 es:h-[50dvh] es:bg-essurface es:border-t es:border-esborder es:rounded-t-2xl es:shadow-2xl es:overflow-hidden">
        <div className="es:flex es:items-center es:justify-between es:px-4 es:py-2 es:border-b es:border-esborder">
          <span className="es:text-sm es:font-medium es:text-estext">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="es:px-2 es:py-1 es:bg-transparent es:text-estextmuted es:border-0 es:outline-none es:focus:outline-none"
            aria-label={`Close ${title} drawer`}
          >
            Close
          </button>
        </div>
        <div className="es:h-[calc(50dvh-45px)] es:overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EsheetBuilder({
  definition,
  onChange,
  dragEnabled = true,
  className = '',
  children,
}: EsheetBuilderProps) {
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
            className={`es-builder-root es:flex es:h-full es:flex-1 es:min-h-0 es:max-h-full es:w-full es:min-w-0 es:max-w-full es:flex-col es:gap-2 
                        es:overflow-x-hidden es:bg-esbackground es:text-estext ${className}`.trim()}
          >
            <div className="es:sticky es:top-0 es:z-50 es:bg-esbackground">
              <BuilderHeader form={form} ui={ui} />
            </div>
            {children}
            {mode === 'build' && (
              <div className="builder-layout es:grid es:flex-1 es:min-h-0 es:min-w-0 es:grid-cols-1 es:lg:grid-cols-[18rem_minmax(0,1fr)_340px] es:gap-3 es:overflow-hidden">
                <aside className="panel-tools-wrap panel-tools es:hidden es:lg:flex es:self-start es:min-h-0 es:max-h-[calc(100dvh-12.5rem)] es:overflow-y-auto es:flex-col es:rounded-lg es:border es:border-esborder es:bg-essurface">
                  <ToolPanel form={form} ui={ui} />
                </aside>
                <main className="panel-canvas es:self-start es:min-w-0 es:max-h-[calc(100dvh-12.5rem)] es:overflow-y-auto es:rounded-lg es:border es:border-esborder es:bg-essurface es:p-4">
                  <Canvas form={form} ui={ui} dragEnabled={dragEnabled} />
                  <div className="es:lg:hidden es:sticky es:bottom-0 es:z-20 es:pt-2 es:pb-3 es:flex es:justify-center es:pointer-events-none">
                    <button
                      type="button"
                      onClick={() => setToolsModalOpen(true)}
                      className="es:pointer-events-auto es:inline-flex es:items-center es:gap-1.5 es:px-3.5 es:py-2 es:rounded-full es:bg-essurface/95 es:backdrop-blur-sm es:text-estext es:text-sm es:font-semibold es:border es:border-esprimary/35 es:shadow-lg es:shadow-esprimary/10 es:outline-none es:focus:outline-none es:hover:bg-essurface es:hover:border-esprimary/50 es:hover:shadow-xl es:hover:shadow-esprimary/15 es:transition-all"
                      aria-label="Open add field tools"
                    >
                      <PlusIcon className="es:w-3.5 es:h-3.5 es:text-esprimary" />
                      <span>Add field</span>
                    </button>
                  </div>
                </main>
                <aside className="panel-editor-wrap panel-editor es:hidden es:lg:flex es:self-start es:min-h-0 es:max-h-[calc(100dvh-12.5rem)] es:overflow-y-auto es:flex-col es:rounded-lg es:border es:border-esborder es:bg-essurface">
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
              <div className="code-layout es:flex es:h-[calc(100dvh-12.5rem)] es:min-h-0 es:min-w-0 es:overflow-hidden es:rounded-lg es:border es:border-esborder es:bg-essurface">
                <CodeView form={form} ui={ui} />
              </div>
            )}
            {mode === 'preview' && (
              <div className="preview-layout es:flex-1 es:min-h-0 es:min-w-0 es:w-full es:max-w-2xl es:mx-auto es:p-4 es:max-h-[calc(100dvh-12.5rem)] es:overflow-y-auto">
                <Canvas form={form} ui={ui} dragEnabled={false} />
              </div>
            )}
          </div>
        </InstanceIdContext.Provider>
      </UIContext.Provider>
    </FormStoreContext.Provider>
  );
}
