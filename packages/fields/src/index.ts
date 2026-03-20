// Controls
export { CustomRadio } from './controls/CustomRadio.js';
export { CustomCheckbox } from './controls/CustomCheckbox.js';
export { CustomDropdown } from './controls/CustomDropdown.js';

// Icons (shared with builder)
export {
  TrashIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  UpDownArrowIcon,
} from './icons.js';

// Field components
export {
  TextField,
  LongTextField,
  MultiTextField,
  RadioField,
  CheckField,
  BooleanField,
  DropdownField,
  MultiSelectDropdownField,
  RatingField,
  RankingField,
  SliderField,
  SingleMatrixField,
  MultiMatrixField,
  SectionField,
  // Rich content
  DrawingPad,
  DiagramField,
  DisplayField,
  HtmlField,
  ImageField,
  SignatureField,
} from './fields/index.js';
export type {
  DrawingData,
  DrawingPadConfig,
  DrawingPadPayload,
  NormalizedPoint,
  Stroke,
} from './fields/index.js';

// Shared React contexts and hooks
export {
  FormStoreContext,
  UIContext,
  useFormStore,
  useUI,
} from './lib/context.js';

// Field component registry
export {
  getFieldComponent,
  getRegisteredComponentKeys,
  registerFieldComponents,
  registerCustomFieldTypes,
  resetComponentRegistry,
} from './lib/component-registry.js';
