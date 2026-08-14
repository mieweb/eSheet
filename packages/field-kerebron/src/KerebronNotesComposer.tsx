import React from 'react';
import type { NotesComposerProps } from '@esheet/fields';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
import { getAssetLoad } from './asset-load.js';
import '@kerebron/editor/assets/index-light.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

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
// ---------------------------------------------------------------------------

const COMPOSER_STYLES = `
  .notes-kerebron-composer .ProseMirror { outline: none; min-height: 96px; padding: 8px 12px; }
  .notes-kerebron-composer .kb-custom-menu__editor { max-height: 320px; overflow-y: auto; }
  /* Same upstream .kb-icon touch-target fix as RichTextEditorField. */
  .notes-kerebron-composer .kb-custom-menu__overflow-menu .kb-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-width: 0 !important;
    min-height: 0 !important;
    line-height: 1;
  }
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

// Initial document loads are serialized across editor instances: the
// markdown converter's tree-sitter WASM init is not concurrency-safe
// (same pattern as echart-sim's DocumentComposeEditor).
let initialLoadQueue: Promise<unknown> = Promise.resolve();

export function KerebronNotesComposer({
  value,
  onChange,
  ariaLabel,
}: NotesComposerProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Fresh mount node: Kerebron's destroy() replaces its own mount element.
    const mount = document.createElement('div');
    host.replaceChildren(mount);

    const editor = CoreEditor.create({
      element: mount,
      uri: 'file:///note.md',
      assetLoad: getAssetLoad(),
      editorKits: [
        new AdvancedEditorKit(),
        { getExtensions: () => [new ExtensionHistory()] },
      ],
    });

    let disposed = false;
    let loading = true;
    let saveTimer: number | null = null;

    const flush = async () => {
      if (disposed) return;
      try {
        const bytes = await editor.saveDocument('text/x-markdown');
        onChangeRef.current(new TextDecoder().decode(bytes));
      } catch {
        // editor gone mid-save
      }
    };

    const onChanged = () => {
      if (disposed || loading) return;
      if (saveTimer != null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => void flush(), 200);
    };
    editor.addEventListener('changed', onChanged);

    void (async () => {
      // Always load, even when empty — the editor needs an initial document
      // before it will accept edits. Queued so parallel mounts (React
      // StrictMode, several notes fields) don't race the WASM init.
      const load = initialLoadQueue
        .catch(() => undefined)
        .then(async () => {
          if (disposed) return;
          await editor.loadDocumentText('text/x-markdown', valueRef.current);
        });
      initialLoadQueue = load;
      try {
        await load;
      } catch (err) {
        console.error('[KerebronNotesComposer] loadDocument failed:', err);
      }
      loading = false;
    })();

    return () => {
      // Best-effort final save for a keystroke inside the debounce window.
      if (saveTimer != null) {
        window.clearTimeout(saveTimer);
        void flush();
      }
      disposed = true;
      editor.removeEventListener('changed', onChanged);
      editor.destroy();
      host.replaceChildren();
    };
  }, []);

  return (
    <div
      className="notes-kerebron-composer"
      aria-label={ariaLabel}
      // isolation traps the Kerebron toolbar z-index inside the composer.
      style={{ isolation: 'isolate' } as React.CSSProperties}
    >
      <div ref={hostRef} className="kb-component" />
    </div>
  );
}
