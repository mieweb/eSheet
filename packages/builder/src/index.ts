// @ts-ignore — generated CSS asset, no type declarations needed
import './index.output.css';

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
} from './lib/EsheetBuilder.js';

export {
  FieldWrapper,
  type FieldWrapperProps,
  type FieldWrapperRenderProps,
} from './lib/components/FieldWrapper.js';

export {
  registerCustomFieldTypes,
  getFieldComponent,
  getRegisteredComponentKeys,
  resetComponentRegistry,
} from '@esheet/fields';

export {
  BuilderHeader,
  type BuilderHeaderProps,
} from './lib/components/BuilderHeader.js';

export { CodeView, type CodeViewProps } from './lib/components/CodeView.js';

export { useFormApi } from './lib/hooks/useFormApi.js';
export type { FormApi, FieldResponseMap } from './lib/hooks/useFormApi.js';
export { useUiApi } from './lib/hooks/useUiApi.js';
export type { UiApi } from './lib/hooks/useUiApi.js';
export { useVisibleRootIds } from './lib/hooks/useVisibleRootIds.js';

export {
  executeToolCall,
  BUILDER_TOOL_DEFINITIONS,
  useBuilderMcpToolHandler,
} from './lib/mcp/index.js';
export type {
  ToolDefinition,
  UseBuilderMcpToolHandlerOptions,
} from './lib/mcp/index.js';
