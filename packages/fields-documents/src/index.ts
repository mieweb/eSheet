import './index.css';
import { registerCustomFieldTypes } from '@esheet/fields';
import { DocumentListField } from './DocumentListField.js';

export function registerDocumentListFieldType(): void {
  registerCustomFieldTypes({
    documentList: {
      label: 'Document List',
      category: 'rich',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {
        question: 'Documents',
        width: 'full',
      },
      component: DocumentListField,
    },
  });
}

export { DocumentListField } from './DocumentListField.js';
export {
  ComposerSessionOverlay,
  ComposerSessionProvider,
  useComposerSession,
  useComposerSessionValue,
} from './ComposerSession.js';
export type {
  ComposerSession,
  ComposerSessionConfig,
  ComposerSessionValue,
} from './ComposerSession.js';
export {
  composeDefaultDocType,
  configureDocumentListComposeEditor,
  DocumentListComposePanel,
  DocumentListDetailRow,
  DocumentListUploadPanel,
  DocumentListWorkflowPanel,
  emptyComposeDraft,
  isComposeDraftDirty,
} from './DocumentListWorkflows.js';
export type { DocumentListWorkflowShellProps } from './DocumentListWorkflows.js';
export {
  DocumentListDefinitionForm,
  answerText,
} from './DocumentListDefinitionForm.js';
export type {
  DocumentListDefinitionDraft,
  DocumentListDefinitionFormHandle,
  DocumentListDefinitionFormProps,
} from './DocumentListDefinitionForm.js';
export {
  DocumentListFieldProvider,
  DocumentListGrid,
  createDocumentListFieldProvider,
  useDocumentListFieldHost,
  useDocumentListFieldRuntime,
} from './DocumentListGrid.js';
export {
  createMdy,
  mdyBody,
  parseMdy,
  serializeMdy,
  withMdyBody,
  withMdyFrontMatter,
} from './mdy.js';
export type { MdyFile, MdyFrontMatter } from './mdy.js';
export {
  createDocumentListRuntimeExtension,
  getDocumentListRuntimeState,
  DOCUMENT_LIST_EXTENSION_NAMESPACE,
} from './document-list-runtime.js';
export {
  createLocalSourcePayload,
  docTypeSerialization,
  documentListValueFromRows,
  priorRevisionOf,
  DOCUMENT_LIST_ACTIONS_COLUMN,
  DOCUMENT_LIST_COLUMNS,
  DOCUMENT_LIST_DEFAULT_NOUN,
  DOCUMENT_LIST_MARKDOWN_TYPE,
  DOCUMENT_LIST_MDY_TYPE,
  DOCUMENT_LIST_TYPE_INFO,
  normalizeDocumentRow,
  normalizeDocumentRows,
  parseDocumentListAnswer,
} from './data.js';
export type {
  DocumentListActionsRenderer,
  DocumentListColumn,
  DocumentListFieldAction,
  DocumentListFieldHost,
  DocumentListFieldProviderProps,
  DocumentListFieldRuntimeOptions,
  DocumentListGridProps,
  DocumentListRowCapabilities,
  DocumentListToolbarProps,
} from './DocumentListGrid.js';
export type {
  DocumentListAction,
  DocumentListAuthor,
  DocumentListCapabilities,
  DocumentListComposeDraft,
  DocumentListDefinition,
  DocumentListDocTypeOption,
  DocumentListDocument,
  DocumentListInput,
  DocumentListLink,
  DocumentListRemoval,
  DocumentListValue,
  DocumentListWorkflow,
  DocumentListWorkflowMode,
  DocumentRevision,
  DocumentRevisionAction,
} from './types.js';
export type {
  DocumentDraft,
  DocumentDraftChannel,
  DraftBodyRoom,
  DraftMeta,
  DraftPresence,
} from './draftChannel.js';
export { bindDraftAnswers } from './draftBinding.js';
export {
  createInlineDocumentStore,
  unsupportedColumns,
} from './documentStore.js';
export type {
  DocumentRowRegistry,
  DocumentSave,
  DocumentStore,
} from './documentStore.js';
export { runDocumentStoreConformance } from './documentStoreConformance.js';
export type { DocumentStorePolicies } from './documentStoreConformance.js';
export type {
  CreateDocumentListRuntimeExtensionOptions,
  DocumentListContent,
  DocumentListContentState,
  DocumentListContentStatus,
  DocumentListPendingOperation,
  DocumentListRepository,
  DocumentListRepositoryContext,
  DocumentListSnapshot,
  DocumentListRuntimeState,
  DocumentListSyncStatus,
} from './document-list-runtime.js';
export {
  DOCUMENT_LIST_ACTIONS,
  DOCUMENT_REVISION_ACTIONS,
  permissiveDocumentListCapabilities,
  readOnlyDocumentListCapabilities,
} from './types.js';
