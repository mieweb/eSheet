// Re-export UIStore from core for backward compat
export {
  createUIStore,
  type UIState,
  type UIStore,
  type BuilderMode,
  type EditTab,
  type FieldComponentProps,
} from '@esheet/core';

export {
  EsheetBuilder,
  FormStoreContext,
  UIContext,
  InstanceIdContext,
  useFormStore,
  useUI,
  useInstanceId,
  type EsheetBuilderProps,
  type BuilderTools,
  type FieldSummary,
} from './lib/EsheetBuilder.js';
export type { FieldProvider } from '@esheet/fields';

export {
  FieldWrapper,
  type FieldWrapperProps,
  type FieldWrapperRenderProps,
} from './lib/components/FieldWrapper.js';

export {
  registerCustomFieldTypes,
  getFieldComponent,
  getRegisteredComponentKeys,
} from '@esheet/fields';

export {
  BuilderHeader,
  type BuilderHeaderProps,
} from './lib/components/BuilderHeader.js';

export { CodeView, type CodeViewProps } from './lib/components/CodeView.js';

export {
  useFormApi,
  type FormApi,
  type FieldResponseMap,
} from './lib/hooks/useFormApi.js';
export { useUiApi, type UiApi } from './lib/hooks/useUiApi.js';
export { useVisibleRootIds } from './lib/hooks/useVisibleRootIds.js';

export {
  executeToolCall,
  BUILDER_TOOL_DEFINITIONS,
  BUILDER_SYSTEM_PROMPT,
  useBuilderMcpToolHandler,
  type ToolDefinition,
  type UseBuilderMcpToolHandlerOptions,
} from './lib/mcp/index.js';

// Re-export core schema types for consumer convenience
export type { FormDefinition, FieldDefinition } from '@esheet/core';
