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
  .kerebron-markdown-editor {
    --kb-font-family: var(--mieweb-font-sans, sans-serif);
    --kb-color-primary: var(--mieweb-primary-500, #3b82f6);
    --kb-color-primary-hover: var(--mieweb-primary-600, #2563eb);
    --kb-color-primary-active: var(--mieweb-primary-700, #1d4ed8);
    --kb-color-focus: color-mix(in srgb, var(--mieweb-ring, #3b82f6) 20%, transparent);
    --kb-color-text: var(--mieweb-foreground, #1f2937);
    --kb-color-text-muted: var(--mieweb-muted-foreground, #6b7280);
    --kb-color-icon: var(--mieweb-muted-foreground, #5f6368);
    --kb-color-surface: var(--mieweb-background, #ffffff);
    --kb-color-surface-elevated: var(--mieweb-muted, #f9fafb);
    --kb-color-surface-hover: var(--mieweb-muted, rgba(60, 64, 67, 0.08));
    --kb-color-hover: var(--mieweb-muted, rgba(59, 130, 246, 0.05));
    --kb-color-active: color-mix(in srgb, var(--mieweb-primary-500, #3b82f6) 10%, transparent);
    --kb-color-border: var(--mieweb-border, #e5e7eb);
    --kb-color-border-strong: var(--mieweb-input, #d1d5db);
    --kb-menu-dropdown-bg: var(--mieweb-card, #ffffff);
    --kb-menu-dropdown-border: var(--mieweb-border, #dadce0);
    --kb-menu-dropdown-text: var(--mieweb-card-foreground, #3c4043);
    --kb-menu-dropdown-hover: var(--mieweb-muted, rgba(60, 64, 67, 0.08));
    --kb-menu-info-bg: var(--mieweb-muted, #e8f0fe);
    --kb-menu-info-text: var(--mieweb-foreground, #1967d2);
    --kb-radius-sm: var(--mieweb-radius-sm, 4px);
    --kb-radius-md: var(--mieweb-radius-md, 6px);
    --kb-radius-lg: var(--mieweb-radius-lg, 8px);
  }
  .kerebron-markdown-editor .kb-editor::selection,
  .kerebron-markdown-editor .kb-editor::-moz-selection {
    background: color-mix(in srgb, var(--mieweb-primary-500, #3b82f6) 30%, transparent);
  }
  .kerebron-markdown-editor .ProseMirror { outline: none; min-height: var(--kerebron-editor-min-height, 96px); padding: 8px 12px; }
  .kerebron-markdown-editor .ProseMirror h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
  .kerebron-markdown-editor .ProseMirror h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
  .kerebron-markdown-editor .ProseMirror h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
  .kerebron-markdown-editor .ProseMirror ul { list-style: disc; padding-left: 1.5em; }
  .kerebron-markdown-editor .ProseMirror ol { list-style: decimal; padding-left: 1.5em; }
  .kerebron-markdown-editor .ProseMirror blockquote { border-left: 3px solid var(--kb-color-border); color: var(--kb-color-text-muted); margin-left: 0; padding-left: 1em; }
  .kerebron-markdown-editor .kb-custom-menu__editor { max-height: 320px; overflow-y: auto; }
  .kerebron-markdown-editor .kb-menu__button[aria-pressed='true'],
  .kerebron-markdown-editor .kb-menu__button--active {
    background: var(--kb-color-primary);
    border-color: var(--kb-color-primary);
    color: white;
  }
  .kerebron-markdown-editor .kb-custom-menu__overflow-menu .kb-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-width: 0 !important;
    min-height: 0 !important;
    line-height: 1;
  }
  .kerebron-markdown-editor .kb-custom-menu__overflow-menu .kb-icon svg {
    width: 16px !important;
    height: 16px !important;
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

let initialLoadQueue: Promise<unknown> = Promise.resolve();

export interface KerebronMarkdownEditorHandle {
  readonly focus: () => void;
  readonly getContent: () => Promise<string>;
}

export interface KerebronMarkdownEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly id?: string;
  readonly labelledBy?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly minHeight?: number;
}

export const KerebronMarkdownEditor = React.forwardRef<
  KerebronMarkdownEditorHandle,
  KerebronMarkdownEditorProps
>(function KerebronMarkdownEditor(
  {
    value,
    onChange,
    ariaLabel,
    id,
    labelledBy,
    className,
    disabled = false,
    minHeight = 96,
  },
  ref
) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<CoreEditor | null>(null);
  const valueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const loadingRef = React.useRef(false);
  const readyRef = React.useRef<Promise<void> | null>(null);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (value === valueRef.current) return;
    valueRef.current = value;
    if (!editor) return;
    loadingRef.current = true;
    void editor.loadDocumentText('text/x-markdown', value).finally(() => {
      if (editorRef.current === editor) loadingRef.current = false;
    });
  }, [value]);

  React.useEffect(() => {
    editorRef.current?.view.setProps({ editable: () => !disabled });
  }, [disabled]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

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
      readOnly: disabled,
    });
    editorRef.current = editor;
    editor.view.setProps({
      editable: () => !disabled,
      attributes: { 'aria-label': ariaLabel },
    });

    let disposed = false;
    let saveTimer: number | null = null;

    const getContent = async (): Promise<string> => {
      await readyRef.current;
      const bytes = await editor.saveDocument('text/x-markdown');
      const nextValue = new TextDecoder().decode(bytes);
      valueRef.current = nextValue;
      return nextValue;
    };

    const flush = async (): Promise<void> => {
      if (disposed) return;
      onChangeRef.current(await getContent());
    };

    const onChanged = () => {
      if (disposed || loadingRef.current) return;
      if (saveTimer != null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => void flush(), 200);
    };
    editor.addEventListener('changed', onChanged);

    readyRef.current = (async () => {
      loadingRef.current = true;
      const load = initialLoadQueue
        .catch(() => undefined)
        .then(async () => {
          if (disposed) return;
          await editor.loadDocumentText('text/x-markdown', valueRef.current);
        });
      initialLoadQueue = load;
      try {
        await load;
      } catch (error) {
        console.error('[KerebronMarkdownEditor] loadDocument failed:', error);
      } finally {
        loadingRef.current = false;
      }
    })();

    return () => {
      if (saveTimer != null) {
        window.clearTimeout(saveTimer);
        void flush();
      }
      disposed = true;
      editor.removeEventListener('changed', onChanged);
      editor.destroy();
      editorRef.current = null;
      readyRef.current = null;
      host.replaceChildren();
    };
    // Editor instances are intentionally stable; controlled props sync above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => editorRef.current?.view.focus(),
      getContent: async () => {
        await readyRef.current;
        const editor = editorRef.current;
        if (!editor) return valueRef.current;
        const bytes = await editor.saveDocument('text/x-markdown');
        const nextValue = new TextDecoder().decode(bytes);
        valueRef.current = nextValue;
        return nextValue;
      },
    }),
    []
  );

  return (
    <div
      ref={hostRef}
      id={id}
      className={`kb-component kerebron-markdown-editor${
        className ? ` ${className}` : ''
      }`}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      style={
        {
          '--kerebron-editor-min-height': `${minHeight}px`,
          isolation: 'isolate',
          opacity: disabled ? 0.65 : undefined,
          pointerEvents: disabled ? 'none' : undefined,
        } as React.CSSProperties
      }
    />
  );
});

export function KerebronNotesComposer(props: NotesComposerProps) {
  return <KerebronMarkdownEditor {...props} />;
}
