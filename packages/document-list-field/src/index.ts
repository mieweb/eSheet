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
  DocumentListFieldProvider,
  DocumentListGrid,
  createDocumentListFieldProvider,
  useDocumentListFieldHost,
} from './DocumentListGrid.js';
export {
  createLocalSourcePayload,
  documentListValueFromRows,
  DOCUMENT_LIST_ACTIONS_COLUMN,
  DOCUMENT_LIST_COLUMNS,
  DOCUMENT_LIST_TYPE_INFO,
  normalizeDocumentRow,
  normalizeDocumentRows,
  parseDocumentListAnswer,
} from './data.js';
export type {
  DocumentListActionsRenderer,
  DocumentListColumn,
  DocumentListFieldHost,
  DocumentListGridProps,
  DocumentListRowCapabilities,
  DocumentListToolbarProps,
} from './DocumentListGrid.js';
export type {
  DocumentListAction,
  DocumentListDefinition,
  DocumentListDocument,
  DocumentListInput,
  DocumentListValue,
} from './types.js';
export { DOCUMENT_LIST_ACTIONS } from './types.js';
