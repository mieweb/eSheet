import React from 'react';
import type { NotesComposerProps } from '@esheet/fields';
import { RichEditor } from '@mieweb/ui/kerebron';
import '@mieweb/ui/kerebron.css';

// ---------------------------------------------------------------------------
// KerebronNotesComposer — rich markdown composer for NotesField.
//
// Register once at app startup:
// ```ts
// import { registerNotesComposer } from '@esheet/fields';
// import { KerebronNotesComposer } from '@esheet/field-kerebron';
// registerNotesComposer(KerebronNotesComposer);
// ```
// Markdown stays the storage format: the editor loads/saves text/x-markdown,
// so notes composed here render identically in the read-only card list.
//
// The editor itself is @mieweb/ui's RichEditor; this only sizes it and keeps
// the form store from seeing every keystroke.
// ---------------------------------------------------------------------------

const COMPOSER_STYLES = `
  .notes-kerebron-composer .ProseMirror { outline: none; min-height: 96px; padding: 8px 12px; }
  .notes-kerebron-composer .kb-custom-menu__editor { max-height: 320px; overflow-y: auto; }
`;

if (
  typeof document !== 'undefined' &&
  !document.getElementById('notes-kerebron-composer-styles')
) {
  const style = document.createElement('style');
  style.id = 'notes-kerebron-composer-styles';
  style.textContent = COMPOSER_STYLES;
  document.head.appendChild(style);
}

/** Notes live in the form store, so coalesce a burst of typing into one write. */
const SAVE_DEBOUNCE_MS = 200;

export function KerebronNotesComposer({
  value,
  onChange,
  ariaLabel,
}: NotesComposerProps) {
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const handleChange = React.useCallback((next: string) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onChangeRef.current(next);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  return (
    <div
      className="notes-kerebron-composer"
      // isolation traps the Kerebron toolbar z-index inside the composer.
      style={{ isolation: 'isolate' } as React.CSSProperties}
    >
      <RichEditor
        value={value}
        onChange={handleChange}
        aria-label={ariaLabel}
      />
    </div>
  );
}
