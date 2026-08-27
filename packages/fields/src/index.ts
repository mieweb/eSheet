// Controls
export { CustomRadio } from './controls/CustomRadio.js';
export { CustomCheckbox } from './controls/CustomCheckbox.js';
export { CustomDropdown } from './fields-controls/CustomDropdown.js';
export { CustomRadioButton } from './fields-controls/CustomRadioButton.js';
export { CustomCheckboxButton } from './fields-controls/CustomCheckboxButton.js';

// Icons (shared with builder)
export {
  TrashIcon,
  PlusIcon,
  MinusIcon,
  PencilIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  UpDownArrowIcon,
  FolderIcon,
  InfoIcon,
  ClipboardIcon,
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
  AutocompleteField,
  registerAutocompleteFieldType,
  parseAutocompleteItems,
  WIKIPEDIA_OPENSEARCH_URL,
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
  ActivityField,
  NoteCardList,
} from './fields/index.js';
export type {
  AutocompleteFieldDefinition,
  DrawingData,
  DrawingPadConfig,
  DrawingPadPayload,
  NormalizedPoint,
  NoteCardItem,
  NoteCardListProps,
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

// Optional field extension providers
export {
  FieldProviderStack,
  type FieldProvider,
  type FieldProviderStackProps,
} from './lib/FieldProviders.js';

// Optional host-supplied attachment byte storage
export {
  AttachmentManagerProvider,
  createAttachmentManagerProvider,
  useAttachmentManager,
  storeAttachments,
  removeUnreferenced,
  type AttachmentManagerProviderProps,
} from './lib/AttachmentManagerProvider.js';

// Shared markdown-lite rendering
export { renderMarkdownContent, renderMarkdownInline } from './lib/markdown.js';

// Shared file/attachment helpers
export {
  formatFileSize,
  fileMatchesAccept,
  readFileAsAttachment,
} from './lib/file-utils.js';

