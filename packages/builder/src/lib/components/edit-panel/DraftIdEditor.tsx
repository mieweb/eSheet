import React from 'react';
import { useInstanceId } from '../../MsheetBuilder.js';

export interface DraftIdEditorProps {
  /** Current persisted ID. */
  id: string;
  /** Parent field ID for prefixing the DOM id attribute. */
  fieldId: string;
  /** Called with the new ID when the user commits (blur / Enter). Returns false if invalid. */
  onCommit: (newId: string) => boolean;
}

/**
 * DraftIdEditor — edits a field ID with commit-on-blur/Enter.
 *
 * Keeps a local draft so keystrokes don't immediately rename the field.
 * Reverts to the persisted `id` if the commit callback rejects.
 */
export function DraftIdEditor({ id, fieldId, onCommit }: DraftIdEditorProps) {
  const instanceId = useInstanceId();
  const [draft, setDraft] = React.useState(id);

  // Sync draft when the external id changes (e.g. another editor renamed it).
  React.useEffect(() => {
    setDraft(id);
  }, [id]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === id) return;             // no change
    if (!trimmed || !onCommit(trimmed)) {
      setDraft(id);                         // revert on rejection  
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      id={`${instanceId}-editor-id-${fieldId}`}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-transparent ms:border ms:border-msborder ms:rounded ms:text-mstext ms:font-mono placeholder:ms:text-mstextmuted focus:ms:outline-none focus:ms:ring-2 focus:ms:ring-msprimary focus:ms:border-msprimary"
    />
  );
}
