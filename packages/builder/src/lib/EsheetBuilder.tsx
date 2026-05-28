import React from 'react';
import { useSyncExternalStore } from 'react';
import {
  createFormStore,
  createUIStore,
  type FormDefinition,
  type FormStore,
  type UIStore,
} from '@esheet/core';
import {
  createBuilderTools,
  type BuilderTools,
  type FieldSummary,
} from './builder-tools.js';
import { FormStoreContext, UIContext } from '@esheet/fields';
import {
  convertSurveyJS,
  isSurveyJSSchema,
  importFromMcp,
  isMcpElicitationRequest,
  type McpElicitationRequest,
  type McpElicitationSchema,
} from '@esheet/adapters';
import { Canvas } from './components/Canvas.js';
import { ToolPanel } from './components/ToolPanel.js';
import { EditPanel } from './components/edit-panel/EditPanel.js';
import { BuilderHeader } from './components/BuilderHeader.js';
import { CodeView } from './components/CodeView.js';
import { PlusIcon } from './icons.js';
import { ensureDefaultFieldComponentsRegistered } from './register-defaults.js';
import { MobileBottomDrawer } from './components/MobileBottomDrawer.js';
import { Switch } from '@mieweb/ui';

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

// Re-export for public API
export type { BuilderTools, FieldSummary };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EsheetBuilderProps {
  /** Initial form definition to load. Also accepts SurveyJS or MCP elicitation schemas, which are auto-converted. */
  definition?: FormDefinition | Record<string, unknown>;
  /** Callback fired when the form definition changes. */
  onChange?: (definition: FormDefinition) => void;
  /**
   * Called once after the builder mounts, providing a narrow `BuilderTools`
   * facade for MCP / AI tool integrations. Not intended for general developer use —
   * everything a developer needs is available through the builder's own UI and props.
   */
  onBuilderToolsReady?: (tools: BuilderTools) => void;
  /** Whether drag-and-drop reordering is enabled (default: true). Disable for better performance on slow devices. */
  dragEnabled?: boolean;
  /** Additional CSS class name. */
  className?: string;
  /** Optional content rendered below the header (e.g. custom status/debug panels). */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EsheetBuilder({
  definition,
  onChange,
  onBuilderToolsReady,
  dragEnabled = true,
  className = '',
  children,
}: EsheetBuilderProps) {
  ensureDefaultFieldComponentsRegistered();

  const formRef = React.useRef<FormStore | null>(null);
  const uiRef = React.useRef<UIStore | null>(null);

  if (!formRef.current) {
    let resolved: FormDefinition | undefined;
    if (isSurveyJSSchema(definition)) {
      resolved = convertSurveyJS(
        definition as Parameters<typeof convertSurveyJS>[0]
      );
    } else if (isMcpElicitationRequest(definition)) {
      const mcpReq = definition as McpElicitationRequest;
      if (mcpReq.params.mode !== 'url') {
        resolved = importFromMcp(
          mcpReq.params.requestedSchema as McpElicitationSchema,
          { mcpId: mcpReq.id, mcpMessage: mcpReq.params.message }
        );
      }
    } else {
      resolved = definition as FormDefinition | undefined;
    }
    formRef.current = createFormStore(resolved);
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
  const [touchMode, setTouchMode] = React.useState(false);

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

  // Expose a narrow BuilderTools facade to MCP / AI tool callers once on mount.
  React.useEffect(() => {
    if (onBuilderToolsReady) onBuilderToolsReady(createBuilderTools(form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  return (
    <FormStoreContext.Provider value={form}>
      <UIContext.Provider value={ui}>
        <InstanceIdContext.Provider value={instanceId}>
          <div
            className={`ms-builder-root ms:flex ms:h-full ms:flex-1 ms:min-h-0 ms:max-h-full ms:w-full ms:min-w-0 ms:max-w-[1440px] ms:mx-auto ms:flex-col ms:gap-2 
                        ms:overflow-x-hidden ms:bg-msbackground ms:text-mstext ${className}`.trim()}
          >
            <div className="ms:sticky ms:top-0 ms:z-40 ms:bg-msbackground">
              <BuilderHeader />
            </div>
            {children}
            {mode === 'build' && (
              <div className="builder-layout ms:grid ms:min-w-0 ms:grid-cols-1 ms:lg:grid-cols-[18rem_minmax(0,1fr)_340px] ms:gap-3">
                <aside className="panel-tools-wrap panel-tools ms:hidden ms:lg:flex ms:self-start ms:min-h-0 ms:max-h-[calc(100dvh-12.5rem)] ms:overflow-y-auto ms:flex-col ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                  <ToolPanel />
                </aside>
                <main className="panel-canvas ms:min-w-0 ms:self-start ms:max-h-[calc(100dvh-12.5rem)] ms:overflow-hidden ms:flex ms:flex-col ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
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
                  <EditPanel />
                </aside>

                <MobileBottomDrawer
                  title="Add Field"
                  open={toolsModalOpen}
                  onClose={() => setToolsModalOpen(false)}
                >
                  <ToolPanel />
                </MobileBottomDrawer>

                <MobileBottomDrawer
                  title="Edit Field"
                  open={editModalOpen && !!selectedFieldId}
                  onClose={() => ui.getState().setEditModalOpen(false)}
                >
                  <EditPanel />
                </MobileBottomDrawer>
              </div>
            )}
            {mode === 'code' && (
              <div className="code-layout ms:flex ms:h-[calc(100dvh-12.5rem)] ms:min-h-0 ms:min-w-0 ms:overflow-hidden ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
                <CodeView form={form} ui={ui} />
              </div>
            )}
            {mode === 'preview' && (
              <div className={`preview-layout ms:flex-1 ms:min-h-0 ms:min-w-0 ms:w-full ms:max-w-2xl ms:mx-auto ms:p-4 ms:max-h-[calc(100dvh-12.5rem)] ms:overflow-y-auto${touchMode ? ' mobile-touch-enabled' : ''}`}>
                <div className="ms:flex ms:items-center ms:justify-end ms:mb-3">
                  <Switch
                    size="sm"
                    checked={touchMode}
                    onCheckedChange={setTouchMode}
                    label="Touch Mode"
                  />
                </div>
                <Canvas form={form} ui={ui} dragEnabled={false} />
              </div>
            )}
          </div>
        </InstanceIdContext.Provider>
      </UIContext.Provider>
    </FormStoreContext.Provider>
  );
}
