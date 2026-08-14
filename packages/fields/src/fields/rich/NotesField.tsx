import React from 'react';
import type {
  AttachmentAnswer,
  FieldComponentProps,
  NoteEntry,
  NotesFieldDefinition,
} from '@esheet/core';
import { PencilIcon, TrashIcon } from '../../icons.js';
import { renderMarkdownContent } from '../../lib/markdown.js';
import {
  formatFileSize,
  fileMatchesAccept,
  readFileAsAttachment,
} from '../../lib/file-utils.js';
import { NoteCardList, type NoteCardItem } from './NoteCardList.js';

// ---------------------------------------------------------------------------
// NotesField — journal-style list of rich (markdown) note entries, each
// optionally carrying attachments. Entries are GUID-keyed (see core
// mergeNotes); this component only appends / edits / removes by id.
// ---------------------------------------------------------------------------

/** Host-side edit policy hook — enforcement belongs server-side. */
type CanModify = (note: NoteEntry) => boolean;

type ComposerState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; noteId: string };

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const buttonClass =
  'ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm';
const primaryButtonClass =
  'ms:px-3 ms:py-1 ms:rounded ms:bg-msprimary ms:text-white ms:text-sm ms:disabled:opacity-50';

function AttachmentChips({
  attachments,
  onRemove,
}: {
  attachments: AttachmentAnswer[];
  onRemove?: (index: number) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <ul
      className="note-attachments ms:flex ms:flex-wrap ms:gap-2 ms:list-none"
      aria-label="Attachments"
    >
      {attachments.map((att, index) => (
        <li
          key={index}
          className="note-attachment ms:flex ms:items-center ms:gap-1 ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-msbg ms:text-xs ms:text-mstext"
        >
          <span className="ms:truncate ms:max-w-40">
            {att.title || 'Attachment'}
          </span>
          {att.size !== undefined && (
            <span className="ms:text-mstextmuted">
              ({formatFileSize(att.size)})
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove attachment ${att.title || index + 1}`}
              className="ms:text-mstextmuted ms:hover:text-msdanger"
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

interface ComposerProps {
  def: NotesFieldDefinition;
  instanceId: string;
  entryLabel: string;
  initialMarkdown: string;
  initialAttachments: AttachmentAnswer[];
  onSave: (markdown: string, attachments: AttachmentAnswer[]) => void;
  onCancel: () => void;
}

function NoteComposer({
  def,
  instanceId,
  entryLabel,
  initialMarkdown,
  initialAttachments,
  onSave,
  onCancel,
}: ComposerProps) {
  const [markdown, setMarkdown] = React.useState(initialMarkdown);
  const [attachments, setAttachments] =
    React.useState<AttachmentAnswer[]>(initialAttachments);
  const [tab, setTab] = React.useState<'write' | 'preview'>('write');
  const [errorMsg, setErrorMsg] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg('');
    const errors: string[] = [];
    const accepted: AttachmentAnswer[] = [];
    const maxAttachments = def.maxAttachments;
    let count = attachments.length;

    for (const file of Array.from(files)) {
      if (maxAttachments !== undefined && count >= maxAttachments) {
        errors.push(`Max ${maxAttachments} attachment(s) per ${entryLabel}`);
        break;
      }
      if (!fileMatchesAccept(file, def.accept)) {
        errors.push(`File type not accepted: ${file.name}`);
        continue;
      }
      if (def.maxFileSize && file.size > def.maxFileSize) {
        errors.push(
          `${file.name} exceeds max size of ${formatFileSize(def.maxFileSize)}`
        );
        continue;
      }
      accepted.push(await readFileAsAttachment(file));
      count += 1;
    }

    if (errors.length > 0) setErrorMsg(errors.join('; '));
    if (accepted.length > 0) setAttachments((prev) => [...prev, ...accepted]);
  };

  const fileInputId = `${instanceId}-note-attachment-${def.id}`;

  return (
    <div className="note-composer ms:border ms:border-msprimary/50 ms:rounded-lg ms:p-3 ms:space-y-2">
      <div
        className="note-composer-tabs ms:flex ms:gap-2"
        role="tablist"
        aria-label={`${entryLabel} composer mode`}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'write'}
          className={`${buttonClass} ${
            tab === 'write' ? 'ms:border-msprimary' : ''
          }`}
          onClick={() => setTab('write')}
        >
          Write
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className={`${buttonClass} ${
            tab === 'preview' ? 'ms:border-msprimary' : ''
          }`}
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={5}
          aria-label={`${entryLabel} text`}
          placeholder={`Write a ${entryLabel.toLowerCase()}... (markdown supported)`}
          className="note-composer-textarea ms:px-3 ms:py-2 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:text-sm ms:resize-y"
        />
      ) : (
        <div className="note-composer-preview ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-3 ms:text-sm ms:text-mstext">
          {markdown.trim() ? (
            renderMarkdownContent(markdown)
          ) : (
            <span className="ms:text-mstextmuted ms:italic">
              Nothing to preview
            </span>
          )}
        </div>
      )}

      {def.allowAttachments && (
        <div className="note-composer-attachments ms:space-y-2">
          <AttachmentChips
            attachments={attachments}
            onRemove={(index) =>
              setAttachments((prev) => prev.filter((_, i) => i !== index))
            }
          />
          <input
            id={fileInputId}
            type="file"
            multiple
            accept={def.accept}
            onClick={(e) => {
              (e.target as HTMLInputElement).value = '';
            }}
            onChange={(e) => void handleFiles(e.target.files)}
            className="ms:hidden"
          />
          <label
            htmlFor={fileInputId}
            className={`${buttonClass} ms:inline-block ms:cursor-pointer`}
          >
            Attach file
          </label>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="ms:p-2 ms:bg-msdanger/10 ms:border ms:border-msdanger ms:rounded ms:text-xs ms:text-msdanger"
        >
          {errorMsg}
        </div>
      )}

      <div className="note-composer-actions ms:flex ms:gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!markdown.trim()}
          onClick={() => onSave(markdown, attachments)}
        >
          Save
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export const NotesField = React.memo(function NotesField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  isSoftRequired,
  isReadOnly,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as NotesFieldDefinition & {
    canModify?: CanModify;
  };
  const instanceId = form.getState().instanceId;
  const entryLabel = def.entryLabel ?? 'Note';
  const readOnly = !(isPreview && isEnabled) || isReadOnly;
  // Renderer identity (when the host provides one) stamps `author`.
  const identity = form.getState().identity;

  const [composer, setComposer] = React.useState<ComposerState>({
    mode: 'closed',
  });
  const [confirmingDeleteId, setConfirmingDeleteId] = React.useState<
    string | null
  >(null);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  const notes = React.useMemo(() => response?.notes ?? [], [response?.notes]);
  const sortedNotes = React.useMemo(() => {
    const byCreated = [...notes].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    return (def.sortOrder ?? 'newest') === 'newest'
      ? byCreated.reverse()
      : byCreated;
  }, [notes, def.sortOrder]);

  const closeComposer = React.useCallback(() => {
    setComposer({ mode: 'closed' });
    addButtonRef.current?.focus();
  }, []);

  const commitNotes = React.useCallback(
    (next: NoteEntry[]) => {
      onResponse({ ...response, notes: next });
    },
    [onResponse, response]
  );

  const saveNote = React.useCallback(
    (markdown: string, attachments: AttachmentAnswer[]) => {
      const now = new Date().toISOString();
      if (composer.mode === 'edit') {
        commitNotes(
          notes.map((note) =>
            note.id === composer.noteId
              ? {
                  ...note,
                  markdown,
                  updatedAt: now,
                  attachments: attachments.length ? attachments : undefined,
                }
              : note
          )
        );
      } else {
        const entry: NoteEntry = {
          id: crypto.randomUUID(),
          createdAt: now,
          markdown,
          ...(identity?.name ? { author: identity.name } : {}),
          ...(attachments.length ? { attachments } : {}),
        };
        commitNotes([...notes, entry]);
      }
      closeComposer();
    },
    [composer, notes, identity?.name, commitNotes, closeComposer]
  );

  const deleteNote = React.useCallback(
    (noteId: string) => {
      commitNotes(notes.filter((note) => note.id !== noteId));
      setConfirmingDeleteId(null);
    },
    [notes, commitNotes]
  );

  const canModify = def.canModify ?? (() => true);
  const canAdd =
    !readOnly && (def.maxNotes === undefined || notes.length < def.maxNotes);
  const editingNote =
    composer.mode === 'edit'
      ? notes.find((note) => note.id === composer.noteId)
      : undefined;

  const items: NoteCardItem[] = sortedNotes.map((note) => {
    const modifiable = !readOnly && canModify(note);
    return {
      id: note.id,
      title: note.author,
      timestamp:
        formatTimestamp(note.createdAt) +
        (note.updatedAt
          ? ` (edited ${formatTimestamp(note.updatedAt)})`
          : ''),
      body: renderMarkdownContent(note.markdown),
      footer: note.attachments?.length ? (
        <AttachmentChips attachments={note.attachments} />
      ) : undefined,
      actions: modifiable ? (
        confirmingDeleteId === note.id ? (
          <>
            <span className="ms:text-xs ms:text-msdanger">Delete?</span>
            <button
              type="button"
              className={`${buttonClass} ms:text-msdanger`}
              onClick={() => deleteNote(note.id)}
            >
              Delete
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setConfirmingDeleteId(null)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label={`Edit ${entryLabel.toLowerCase()}`}
              className="ms:p-1 ms:text-mstextmuted ms:hover:text-msprimary"
              onClick={() => setComposer({ mode: 'edit', noteId: note.id })}
            >
              <PencilIcon className="ms:w-4 ms:h-4" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${entryLabel.toLowerCase()}`}
              className="ms:p-1 ms:text-mstextmuted ms:hover:text-msdanger"
              onClick={() => setConfirmingDeleteId(note.id)}
            >
              <TrashIcon />
            </button>
          </>
        )
      ) : undefined,
    };
  });

  if (isPreview) {
    return (
      <div className="notes-field-preview ms:flex ms:flex-col ms:gap-3 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words">
          {def.question || `${entryLabel}s`}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
          {def.maxNotes !== undefined && (
            <span className="ms:ml-2 ms:text-xs ms:text-mstextmuted">
              ({notes.length}/{def.maxNotes})
            </span>
          )}
        </div>

        {canAdd && composer.mode === 'closed' && (
          <div>
            <button
              ref={addButtonRef}
              type="button"
              className={primaryButtonClass}
              onClick={() => setComposer({ mode: 'new' })}
            >
              Add {entryLabel.toLowerCase()}
            </button>
          </div>
        )}

        {composer.mode !== 'closed' && (
          <NoteComposer
            def={def}
            instanceId={instanceId}
            entryLabel={entryLabel}
            initialMarkdown={editingNote?.markdown ?? ''}
            initialAttachments={editingNote?.attachments ?? []}
            onSave={saveNote}
            onCancel={closeComposer}
          />
        )}

        <NoteCardList
          items={items}
          emptyLabel={`No ${entryLabel.toLowerCase()}s yet`}
          ariaLabel={def.question || `${entryLabel} entries`}
        />
      </div>
    );
  }

  // Builder mode — property editing
  return (
    <div className="notes-field-edit ms:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
        />
      </div>

      <div className="ms:grid ms:grid-cols-2 ms:gap-3">
        <div>
          <label
            htmlFor={`${instanceId}-notes-entry-label-${def.id}`}
            className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Entry label
          </label>
          <input
            id={`${instanceId}-notes-entry-label-${def.id}`}
            type="text"
            value={def.entryLabel ?? 'Note'}
            onChange={(e) => onUpdate({ entryLabel: e.target.value })}
            className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
          />
        </div>
        <div>
          <label
            htmlFor={`${instanceId}-notes-sort-order-${def.id}`}
            className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Sort order
          </label>
          <select
            id={`${instanceId}-notes-sort-order-${def.id}`}
            value={def.sortOrder ?? 'newest'}
            onChange={(e) => onUpdate({ sortOrder: e.target.value })}
            className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div>
          <label
            htmlFor={`${instanceId}-notes-max-notes-${def.id}`}
            className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Max entries
          </label>
          <input
            id={`${instanceId}-notes-max-notes-${def.id}`}
            type="number"
            min={1}
            value={def.maxNotes ?? ''}
            onChange={(e) =>
              onUpdate({
                maxNotes: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="Unlimited"
            className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
          />
        </div>
        <div className="ms:flex ms:items-end ms:pb-2">
          <label className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext">
            <input
              type="checkbox"
              checked={def.allowAttachments ?? false}
              onChange={(e) => onUpdate({ allowAttachments: e.target.checked })}
            />
            Allow attachments
          </label>
        </div>
      </div>

      {def.allowAttachments && (
        <div className="ms:grid ms:grid-cols-3 ms:gap-3">
          <div>
            <label
              htmlFor={`${instanceId}-notes-accept-${def.id}`}
              className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
            >
              Accepted types
            </label>
            <input
              id={`${instanceId}-notes-accept-${def.id}`}
              type="text"
              value={def.accept ?? ''}
              onChange={(e) =>
                onUpdate({ accept: e.target.value || undefined })
              }
              placeholder="image/*,.pdf"
              className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor={`${instanceId}-notes-max-file-size-${def.id}`}
              className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
            >
              Max file size (bytes)
            </label>
            <input
              id={`${instanceId}-notes-max-file-size-${def.id}`}
              type="number"
              min={1}
              value={def.maxFileSize ?? ''}
              onChange={(e) =>
                onUpdate({
                  maxFileSize: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              placeholder="Unlimited"
              className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor={`${instanceId}-notes-max-attachments-${def.id}`}
              className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
            >
              Max attachments per entry
            </label>
            <input
              id={`${instanceId}-notes-max-attachments-${def.id}`}
              type="number"
              min={1}
              value={def.maxAttachments ?? ''}
              onChange={(e) =>
                onUpdate({
                  maxAttachments: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              placeholder="Unlimited"
              className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
});
