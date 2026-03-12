import './index.output.css';
import './lib/register-defaults.js';

// Re-export UIStore from core for backward compat
export {
  createUIStore,
  type UIState,
  type UIStore,
  type BuilderMode,
  type EditTab,
  type FieldComponentProps,
} from '@msheet/core';

export {
  MsheetBuilder,
  FormStoreContext,
  UIContext,
  InstanceIdContext,
  useFormStore,
  useUI,
  useInstanceId,
  type MsheetBuilderProps,
} from './lib/MsheetBuilder.js';

export {
  FieldWrapper,
  type FieldWrapperProps,
  type FieldWrapperRenderProps,
} from './lib/components/FieldWrapper.js';

export {
  registerBuilderFieldTypes,
  registerBuilderComponents,
  getFieldComponent,
  getRegisteredComponentKeys,
  resetComponentRegistry,
} from './lib/component-registry.js';

export {
  BuilderHeader,
  type BuilderHeaderProps,
} from './lib/components/BuilderHeader.js';

export { CodeView, type CodeViewProps } from './lib/components/CodeView.js';
