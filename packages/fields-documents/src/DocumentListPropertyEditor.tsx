import { Button } from '@mieweb/ui';
import type { FieldPropertyEditorProps } from '@esheet/fields';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { DOCUMENT_LIST_COLUMNS } from './data.js';
import {
  DOCUMENT_LIST_WORKFLOWS,
  type DocumentListDefinition,
  type DocumentListDocTypeOption,
  type DocumentListWorkflow,
} from './types.js';

type FieldPatch = Parameters<FieldPropertyEditorProps['onUpdate']>[0];

const DEFAULT_COLUMN_NAMES = DOCUMENT_LIST_COLUMNS.map(
  (column) => column.field
);

function asPatch(values: Record<string, unknown>): FieldPatch {
  return values as FieldPatch;
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const moved = [...items];
  const [item] = moved.splice(from, 1);
  if (item !== undefined) moved.splice(to, 0, item);
  return moved;
}

function nextDocumentTypeId(
  docTypes: readonly DocumentListDocTypeOption[]
): string {
  const ids = new Set(docTypes.map((docType) => docType.id));
  let suffix = docTypes.length + 1;
  while (ids.has(`type-${suffix}`)) suffix += 1;
  return `type-${suffix}`;
}

function EditorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="document-list-property-editor__section ms:space-y-2">
      <h3 className="ms:text-xs ms:font-semibold ms:text-mstext">{title}</h3>
      {children}
    </section>
  );
}

export function DocumentListPropertyEditor({
  fieldId,
  instanceId,
  def,
  onUpdate,
}: FieldPropertyEditorProps): React.JSX.Element {
  const definition = def as unknown as DocumentListDefinition;
  const workflows =
    definition.workflows ??
    (DOCUMENT_LIST_WORKFLOWS as readonly DocumentListWorkflow[]);
  const columns = definition.columns ?? DEFAULT_COLUMN_NAMES;
  const docTypes = definition.docTypes ?? [];
  const composeEnabled = workflows.includes('compose');
  const uploadEnabled = workflows.includes('upload');
  const id = (purpose: string): string =>
    `${instanceId}-document-list-${purpose}-${fieldId}`;

  const update = (values: Record<string, unknown>): void => {
    onUpdate(asPatch(values));
  };

  const toggleWorkflow = (workflow: DocumentListWorkflow): void => {
    update({
      workflows: DOCUMENT_LIST_WORKFLOWS.filter((candidate) =>
        candidate === workflow
          ? !workflows.includes(candidate)
          : workflows.includes(candidate)
      ),
    });
  };

  const toggleColumn = (columnName: string): void => {
    update({
      columns: columns.includes(columnName)
        ? columns.filter((name) => name !== columnName)
        : [...columns, columnName],
    });
  };

  const setDocTypes = (
    nextDocTypes: readonly DocumentListDocTypeOption[]
  ): void => {
    update({ docTypes: nextDocTypes.length ? nextDocTypes : undefined });
  };

  const updateDocType = (
    index: number,
    values: Partial<DocumentListDocTypeOption>
  ): void => {
    setDocTypes(
      docTypes.map((docType, candidate) =>
        candidate === index ? { ...docType, ...values } : docType
      )
    );
  };

  const updateDocTypeStorage = (index: number, value: string): void => {
    const docType = docTypes[index];
    if (!docType) return;
    const withoutInline = { ...docType };
    Reflect.deleteProperty(withoutInline, 'inline');
    const next =
      value === 'inherit'
        ? withoutInline
        : { ...withoutInline, inline: value === 'inline' };
    setDocTypes(
      docTypes.map((candidate, candidateIndex) =>
        candidateIndex === index ? next : candidate
      )
    );
  };

  const pdfEnabled = definition.actions?.includes('downloadPdf') ?? false;

  return (
    <div className="document-list-property-editor ms:space-y-4">
      <EditorSection title="List behavior">
        <label
          htmlFor={id('noun')}
          className="ms:block ms:text-xs ms:font-medium ms:text-mstextmuted"
        >
          Singular name
        </label>
        <input
          id={id('noun')}
          type="text"
          value={definition.noun ?? ''}
          placeholder="document"
          onChange={(event) =>
            update({ noun: event.currentTarget.value || undefined })
          }
          className="ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary"
        />
        <div className="ms:grid ms:grid-cols-2 ms:gap-2">
          {DOCUMENT_LIST_WORKFLOWS.map((workflow) => (
            <label
              key={workflow}
              htmlFor={id(`workflow-${workflow}`)}
              className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext"
            >
              <input
                id={id(`workflow-${workflow}`)}
                type="checkbox"
                checked={workflows.includes(workflow)}
                onChange={() => toggleWorkflow(workflow)}
                className="ms:h-4 ms:w-4 ms:accent-msprimary"
              />
              {workflow === 'compose' ? 'Compose' : 'Upload'}
            </label>
          ))}
        </div>
        <label
          htmlFor={id('expand-details')}
          className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext"
        >
          <input
            id={id('expand-details')}
            type="checkbox"
            checked={definition.expandDetails ?? false}
            onChange={(event) =>
              update({
                expandDetails: event.currentTarget.checked || undefined,
              })
            }
            className="ms:h-4 ms:w-4 ms:accent-msprimary"
          />
          Expand row details initially
        </label>
        <label
          htmlFor={id('download-pdf')}
          className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext"
        >
          <input
            id={id('download-pdf')}
            type="checkbox"
            checked={pdfEnabled}
            onChange={(event) => {
              const actions = definition.actions ?? [];
              update({
                actions: event.currentTarget.checked
                  ? [...actions, 'downloadPdf']
                  : actions.filter((action) => action !== 'downloadPdf'),
              });
            }}
            className="ms:h-4 ms:w-4 ms:accent-msprimary"
          />
          Preview and download PDF
        </label>
      </EditorSection>

      {composeEnabled && (
        <EditorSection title="Composed documents">
          <label
            htmlFor={id('inline')}
            className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext"
          >
            <input
              id={id('inline')}
              type="checkbox"
              checked={definition.inline ?? false}
              onChange={(event) =>
                update({ inline: event.currentTarget.checked || undefined })
              }
              className="ms:h-4 ms:w-4 ms:accent-msprimary"
            />
            Store composed content inline
          </label>
          <div className="ms:space-y-2">
            {docTypes.map((docType, index) => (
              <div
                key={`${docType.id}-${index}`}
                className="document-list-property-editor__type ms:grid ms:grid-cols-[1fr_auto] ms:gap-2 ms:border ms:border-msborder ms:rounded ms:p-2"
              >
                <div className="ms:space-y-2 ms:min-w-0">
                  <label
                    htmlFor={id(`type-id-${index}`)}
                    className="ms:block ms:text-xs ms:text-mstextmuted"
                  >
                    Type ID
                  </label>
                  <input
                    id={id(`type-id-${index}`)}
                    type="text"
                    required
                    value={docType.id}
                    onChange={(event) =>
                      updateDocType(index, { id: event.currentTarget.value })
                    }
                    className="ms:w-full ms:px-2 ms:py-1.5 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext"
                  />
                  <label
                    htmlFor={id(`type-label-${index}`)}
                    className="ms:block ms:text-xs ms:text-mstextmuted"
                  >
                    Display label
                  </label>
                  <input
                    id={id(`type-label-${index}`)}
                    type="text"
                    value={docType.label ?? ''}
                    onChange={(event) =>
                      updateDocType(index, {
                        label: event.currentTarget.value || undefined,
                      })
                    }
                    className="ms:w-full ms:px-2 ms:py-1.5 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext"
                  />
                  <label
                    htmlFor={id(`type-storage-${index}`)}
                    className="ms:block ms:text-xs ms:text-mstextmuted"
                  >
                    Storage
                  </label>
                  <select
                    id={id(`type-storage-${index}`)}
                    value={
                      docType.inline === undefined
                        ? 'inherit'
                        : docType.inline
                        ? 'inline'
                        : 'repository'
                    }
                    onChange={(event) =>
                      updateDocTypeStorage(index, event.currentTarget.value)
                    }
                    className="ms:w-full ms:px-2 ms:py-1.5 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext"
                  >
                    <option value="inherit">Inherit list setting</option>
                    <option value="inline">Inline</option>
                    <option value="repository">Repository</option>
                  </select>
                </div>
                <div className="ms:flex ms:flex-col ms:gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${docType.label || docType.id} up`}
                    title="Move up"
                    disabled={index === 0}
                    onClick={() =>
                      setDocTypes(moveItem(docTypes, index, index - 1))
                    }
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${docType.label || docType.id} down`}
                    title="Move down"
                    disabled={index === docTypes.length - 1}
                    onClick={() =>
                      setDocTypes(moveItem(docTypes, index, index + 1))
                    }
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${docType.label || docType.id}`}
                    title="Remove type"
                    onClick={() =>
                      setDocTypes(
                        docTypes.filter((_, candidate) => candidate !== index)
                      )
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Plus size={16} aria-hidden="true" />}
              onClick={() =>
                setDocTypes([
                  ...docTypes,
                  { id: nextDocumentTypeId(docTypes), label: 'New type' },
                ])
              }
            >
              Add document type
            </Button>
          </div>
        </EditorSection>
      )}

      {uploadEnabled && (
        <EditorSection title="Uploads">
          <label
            htmlFor={id('accept')}
            className="ms:block ms:text-xs ms:font-medium ms:text-mstextmuted"
          >
            Accepted file types
          </label>
          <input
            id={id('accept')}
            type="text"
            value={definition.accept ?? ''}
            placeholder="image/*,application/pdf,.docx"
            onChange={(event) =>
              update({ accept: event.currentTarget.value || undefined })
            }
            className="ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted"
          />
          <label
            htmlFor={id('max-file-size')}
            className="ms:block ms:text-xs ms:font-medium ms:text-mstextmuted"
          >
            Maximum file size (bytes)
          </label>
          <input
            id={id('max-file-size')}
            type="number"
            min="0"
            step="1"
            value={definition.maxFileSize ?? ''}
            onChange={(event) =>
              update({
                maxFileSize: event.currentTarget.value
                  ? Number(event.currentTarget.value)
                  : undefined,
              })
            }
            className="ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext"
          />
        </EditorSection>
      )}

      <EditorSection title="Columns">
        <div className="ms:flex ms:items-center ms:justify-between ms:gap-2">
          <p className="ms:text-xs ms:text-mstextmuted">
            {definition.columns === undefined
              ? 'Using the default order'
              : `${columns.length} shown`}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw size={14} aria-hidden="true" />}
            disabled={definition.columns === undefined}
            onClick={() => update({ columns: undefined })}
          >
            Default
          </Button>
        </div>
        <div className="ms:space-y-1">
          {DOCUMENT_LIST_COLUMNS.map((column) => {
            const position = columns.indexOf(column.field);
            const shown = position !== -1;
            return (
              <div
                key={column.field}
                className="ms:grid ms:grid-cols-[1fr_auto] ms:items-center ms:gap-2 ms:min-h-9"
              >
                <label
                  htmlFor={id(`column-${column.field}`)}
                  className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext"
                >
                  <input
                    id={id(`column-${column.field}`)}
                    type="checkbox"
                    checked={shown}
                    onChange={() => toggleColumn(column.field)}
                    className="ms:h-4 ms:w-4 ms:accent-msprimary"
                  />
                  {column.header}
                </label>
                {shown && (
                  <div className="ms:flex ms:gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${column.header} column up`}
                      title="Move up"
                      disabled={position === 0}
                      onClick={() =>
                        update({
                          columns: moveItem(columns, position, position - 1),
                        })
                      }
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${column.header} column down`}
                      title="Move down"
                      disabled={position === columns.length - 1}
                      onClick={() =>
                        update({
                          columns: moveItem(columns, position, position + 1),
                        })
                      }
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </EditorSection>
    </div>
  );
}
