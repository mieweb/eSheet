// Side-effect: inject compiled CSS (Tailwind utilities + touch-mode styles)
import './index.output.css';

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
  OpenChoiceField,
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
  FileField,
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

// Shared validation UI
export {
  ZodIssuesPanel,
  type ZodIssuesPanelProps,
  type ZodIssuesPanelVariant,
} from './lib/ZodIssuesPanel.js';

// Shared modal
export {
  FeedbackModal,
  type FeedbackModalProps,
  type FeedbackModalVariant,
} from './lib/FeedbackModal.js';

// Field component registry
export {
  getFieldComponent,
  getRegisteredComponentKeys,
  registerFieldComponents,
  registerCustomFieldTypes,
  // NOTE: resetComponentRegistry intentionally not exported - internal/test-only
} from './lib/component-registry.js';

// Touch mode
export * from './lib/touch-mode/index.js';

// Page navigation
export { PageNavigator } from './lib/PageNavigator.js';
export type { PageNavigatorProps } from './lib/PageNavigator.js';

// Field grid layout
export {
  FieldGrid,
  FieldGridItem,
  useFieldGridLayout,
} from './lib/FieldGrid.js';
export type { FieldGridItemProps, FieldGridProps } from './lib/FieldGrid.js';
