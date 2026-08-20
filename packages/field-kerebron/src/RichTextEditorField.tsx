import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { getAssetLoad } from './asset-load.js';
// Core editor styles (--kb-* variables + base/ProseMirror styles).
import '@kerebron/editor/assets/index.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

// Base content styles for the ProseMirror editable area (headings, lists, etc.)
const CONTENT_STYLES = `
  [data-theme='light'],
  [data-theme='light'] .kb-component {
    --kb-color-primary: var(--mieweb-primary-500, #27aae1);
    --kb-color-text: var(--mieweb-foreground, #1f2937);
    --kb-color-text-muted: var(--mieweb-muted-foreground, #6b7280);
    --kb-color-icon: var(--mieweb-muted-foreground, #5f6368);
    --kb-color-surface: var(--mieweb-background, #ffffff);
    --kb-color-surface-elevated: var(--mieweb-muted, #f9fafb);
    --kb-color-surface-hover: rgba(60, 64, 67, 0.08);
    --kb-color-border: var(--mieweb-border, #e5e7eb);
    --kb-color-border-strong: var(--mieweb-border, #d1d5db);
    --kb-color-hover: rgba(60, 64, 67, 0.08);
    --kb-color-active: rgba(60, 64, 67, 0.1);
    --kb-menu-dropdown-bg: var(--mieweb-card, #ffffff);
    --kb-menu-dropdown-border: var(--mieweb-border, #dadce0);
    --kb-menu-dropdown-text: var(--mieweb-card-foreground, #3c4043);
    --kb-menu-dropdown-hover: rgba(60, 64, 67, 0.08);
  }

  [data-theme='dark'],
  [data-theme='dark'] .kb-component,
  .dark,
  .dark .kb-component {
    --kb-color-primary: var(--mieweb-primary-500, #27aae1);
    --kb-color-text: var(--mieweb-foreground, #fafafa);
    --kb-color-text-muted: var(--mieweb-muted-foreground, #a1a1aa);
    --kb-color-icon: var(--mieweb-muted-foreground, #a1a1aa);
    --kb-color-surface: var(--mieweb-background, #171717);
    --kb-color-surface-elevated: var(--mieweb-muted, #404040);
    --kb-color-surface-hover: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 8%, transparent);
    --kb-color-border: var(--mieweb-border, #404040);
    --kb-color-border-strong: var(--mieweb-border, #404040);
    --kb-color-hover: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 8%, transparent);
    --kb-color-active: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 14%, transparent);
    --kb-menu-dropdown-bg: var(--mieweb-card, #262626);
    --kb-menu-dropdown-border: var(--mieweb-border, #404040);
    --kb-menu-dropdown-text: var(--mieweb-card-foreground, #fafafa);
    --kb-menu-dropdown-hover: color-mix(in srgb, var(--mieweb-foreground, #fafafa) 8%, transparent);
  }

  [data-theme='light'] .kb-custom-menu,
  [data-theme='dark'] .kb-custom-menu,
  .dark .kb-custom-menu {
    background: var(--kb-color-surface-elevated);
    border-bottom-color: var(--kb-color-border-strong);
    color: var(--kb-color-text);
  }

  [data-theme='light'] .kb-custom-menu .kb-menu__button,
  [data-theme='light'] .kb-custom-menu .kb-dropdown__label,
  [data-theme='dark'] .kb-custom-menu .kb-menu__button,
  [data-theme='dark'] .kb-custom-menu .kb-dropdown__label,
  .dark .kb-custom-menu .kb-menu__button,
  .dark .kb-custom-menu .kb-dropdown__label {
    color: var(--kb-color-icon);
  }

  [data-theme='light'] .kb-dropdown__menu,
  [data-theme='light'] .kb-submenu__content,
  [data-theme='light'] .kb-custom-menu__overflow-menu,
  [data-theme='dark'] .kb-dropdown__menu,
  [data-theme='dark'] .kb-submenu__content,
  [data-theme='dark'] .kb-custom-menu__overflow-menu,
  .dark .kb-dropdown__menu,
  .dark .kb-submenu__content,
  .dark .kb-custom-menu__overflow-menu {
    background: var(--kb-menu-dropdown-bg) !important;
    border-color: var(--kb-menu-dropdown-border) !important;
    color: var(--kb-menu-dropdown-text) !important;
  }

  [data-theme='light'] .kb-custom-menu .kb-dropdown__item .kb-menu__button:hover,
  [data-theme='light'] .kb-custom-menu .kb-submenu__label:hover,
  [data-theme='light'] .kb-custom-menu__overflow-item:hover,
  [data-theme='dark'] .kb-custom-menu .kb-dropdown__item .kb-menu__button:hover,
  [data-theme='dark'] .kb-custom-menu .kb-submenu__label:hover,
  [data-theme='dark'] .kb-custom-menu__overflow-item:hover,
  .dark .kb-custom-menu .kb-dropdown__item .kb-menu__button:hover,
  .dark .kb-custom-menu .kb-submenu__label:hover,
  .dark .kb-custom-menu__overflow-item:hover {
    background: var(--kb-menu-dropdown-hover) !important;
    color: var(--kb-menu-dropdown-text) !important;
  }

  .richtext-field .ProseMirror { outline: none; min-height: 80px; padding: 8px 12px; }
  .richtext-field .kb-editor,
  .richtext-field .ProseMirror { color: var(--kb-color-text); }
  .richtext-field .ProseMirror h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
  .richtext-field .ProseMirror h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
  .richtext-field .ProseMirror h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
  .richtext-field .ProseMirror ul { list-style: disc; padding-left: 1.5em; }
  .richtext-field .ProseMirror ol { list-style: decimal; padding-left: 1.5em; }
  .richtext-field .ProseMirror blockquote { border-left: 3px solid var(--kb-color-border); margin-left: 0; padding-left: 1em; color: var(--kb-color-text-muted); }
  .richtext-field .ProseMirror strong { font-weight: bold; }
  .richtext-field .ProseMirror em { font-style: italic; }
  .richtext-field .ProseMirror code { font-family: monospace; background: var(--kb-color-surface-elevated); padding: 0.1em 0.3em; border-radius: 3px; }

  /* Upstream fix: base .kb-icon keeps 48px touch-target min sizing, which
     overflows the 32px overflow-menu buttons and misaligns icons from their
     hit areas. Center the icon within the button instead. */
  .richtext-field .kb-custom-menu__overflow-menu .kb-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-width: 0 !important;
    min-height: 0 !important;
    line-height: 1;
  }

  /* Cap the editor body height; toolbar stays put, body scrolls. */
  .richtext-field .kb-custom-menu__editor {
    max-height: 300px;
    overflow-y: auto;
  }
`;

// Inject content styles once
if (
  typeof document !== 'undefined' &&
  !document.getElementById('richtext-field-styles')
) {
  const style = document.createElement('style');
  style.id = 'richtext-field-styles';
  style.textContent = CONTENT_STYLES;
  document.head.appendChild(style);
}

export interface RichTextFieldDefinition {
  fieldType: 'richtext';
  id: string;
  question?: string;
  required?: boolean;
  /** Markdown content used as the default/initial value. */
  defaultContent?: string;
}

/**
 * RichTextEditorField — a Kerebron/ProseMirror-based rich text editor field.
 *
 * Register in your app before use:
 * ```ts
 * import { registerFieldComponents } from '@esheet/fields';
 * import { RichTextEditorField } from '@esheet/field-kerebron';
 * registerFieldComponents({ richtext: RichTextEditorField });
 * ```
 */
export function RichTextEditorField({
  field,
  form,
  response,
  isPreview,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as unknown as RichTextFieldDefinition;
  const instanceId = form.getState().instanceId;

  const hostRef = React.useRef<HTMLDivElement>(null);
  const editorRef = React.useRef<CoreEditor | null>(null);
  const onResponseRef = React.useRef(onResponse);
  React.useEffect(() => {
    onResponseRef.current = onResponse;
  }, [onResponse]);

  // The content we want the editor to display. Matches DrawingPad's existingData pattern:
  // response takes priority, then defaultContent.
  const externalContent =
    (response?.answer as string | undefined) ?? def.defaultContent ?? '';

  // Suppress the transaction handler while we are programmatically loading
  // content so the load doesn't echo back into the response store.
  const isLoadingRef = React.useRef(false);
  const pendingResponsesRef = React.useRef(new WeakSet<object>());

  // --- Mount / unmount the Kerebron editor (runs once in preview mode) ---
  React.useEffect(() => {
    const host = hostRef.current;
    if (!isPreview || !host) return;

    // Mount into a fresh child node so Kerebron's destroy() can't corrupt the
    // host ref (destroy() replaces its own mount node with an inert clone).
    const mount = document.createElement('div');
    host.appendChild(mount);

    const editor = CoreEditor.create({
      element: mount,
      uri: 'file:///untitled.md',
      assetLoad: getAssetLoad(),
      editorKits: [new AdvancedEditorKit()],
    });
    editorRef.current = editor;

    const handler = async () => {
      // Ignore transactions fired by our own programmatic loads
      if (isLoadingRef.current) return;
      try {
        const buf = await editor.saveDocument('text/x-markdown');
        const answer = new TextDecoder().decode(buf);
        const nextResponse = { answer };
        pendingResponsesRef.current.add(nextResponse);
        onResponseRef.current(nextResponse);
      } catch {
        // ignore
      }
    };

    // Load initial content then attach the transaction listener so the load
    // itself never emits a phantom response for an untouched field.
    let listening = false;
    let destroyed = false;

    const loadInitial = async () => {
      if (externalContent) {
        isLoadingRef.current = true;
        try {
          await editor.loadDocument(
            'text/x-markdown',
            new TextEncoder().encode(externalContent)
          );
        } catch (err) {
          console.error('[RichTextEditorField] loadDocument failed:', err);
        } finally {
          isLoadingRef.current = false;
        }
      }
      if (destroyed) return;
      editor.addEventListener('changed', handler);
      listening = true;
    };

    loadInitial();

    return () => {
      destroyed = true;
      if (listening) editor.removeEventListener('changed', handler);
      editor.destroy();
      editorRef.current = null;
      host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview]);

  // --- React to external response changes (AI fill, clear, etc.) ---
  // Skip the first run — the mount effect handles initial content.
  // Subsequent runs mean an external caller changed the response (e.g. AI fill).
  const skipFirstExternalRef = React.useRef(true);
  React.useEffect(() => {
    if (skipFirstExternalRef.current) {
      skipFirstExternalRef.current = false;
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    if (response && pendingResponsesRef.current.delete(response)) return;
    isLoadingRef.current = true;
    editor
      .loadDocument(
        'text/x-markdown',
        new TextEncoder().encode(externalContent)
      )
      .then(() => {
        isLoadingRef.current = false;
      })
      .catch(() => {
        isLoadingRef.current = false;
      });
  }, [externalContent]); // fires whenever the response store value changes

  // Builder canvas: editable question input + static placeholder
  if (!isPreview) {
    return (
      <div className="richtext-field richtext-field--builder ms:space-y-2">
        <div>
          <label
            htmlFor={`${instanceId}-canvas-question-${def.id}`}
            className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Question
          </label>
          <input
            id={`${instanceId}-canvas-question-${def.id}`}
            aria-label="Question"
            type="text"
            value={def.question || ''}
            onChange={(e) => onUpdate({ question: e.target.value })}
            placeholder="Enter question"
            className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
          />
        </div>
        <div
          className="richtext-field-placeholder"
          style={{
            border: '1px dashed #ccc',
            borderRadius: 4,
            padding: '8px 12px',
            color: '#999',
            fontSize: 14,
            minHeight: 80,
          }}
        >
          Rich Text Editor
        </div>
      </div>
    );
  }

  return (
    <div
      className="richtext-field"
      // isolation:isolate creates a stacking context that traps the Kerebron
      // toolbar z-index so it doesn't overlap modals rendered above this field.
      style={{ isolation: 'isolate' } as React.CSSProperties}
    >
      {def.question && (
        <div className="richtext-field-question" style={{ marginBottom: 8 }}>
          {def.question}
        </div>
      )}
      <div ref={hostRef} className="kb-component" />
    </div>
  );
}
