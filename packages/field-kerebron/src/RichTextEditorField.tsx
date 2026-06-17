import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { ExtensionHistory } from '@kerebron/extension-basic-editor/ExtensionHistory';
// Core editor styles (--kb-* variables + base/ProseMirror styles).
// index-light.css pins the light theme so the editor matches the host app
// regardless of OS dark-mode preference.
import '@kerebron/editor/assets/index-light.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

// Base content styles for the ProseMirror editable area (headings, lists, etc.)
const CONTENT_STYLES = `
  .richtext-field .ProseMirror { outline: none; min-height: 80px; padding: 8px 12px; }
  .richtext-field .ProseMirror h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
  .richtext-field .ProseMirror h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
  .richtext-field .ProseMirror h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
  .richtext-field .ProseMirror ul { list-style: disc; padding-left: 1.5em; }
  .richtext-field .ProseMirror ol { list-style: decimal; padding-left: 1.5em; }
  .richtext-field .ProseMirror blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #666; }
  .richtext-field .ProseMirror strong { font-weight: bold; }
  .richtext-field .ProseMirror em { font-style: italic; }
  .richtext-field .ProseMirror code { font-family: monospace; background: #f4f4f4; padding: 0.1em 0.3em; border-radius: 3px; }

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
  response,
  isPreview,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as unknown as RichTextFieldDefinition;
  const initialContent = response?.answer ?? def.defaultContent ?? '';

  const editorRef = React.useRef<HTMLDivElement>(null);
  const editorInstance = React.useRef<CoreEditor | null>(null);
  // Keep a stable ref to onResponse so the transaction handler never goes stale
  const onResponseRef = React.useRef(onResponse);
  React.useEffect(() => {
    onResponseRef.current = onResponse;
  }, [onResponse]);

  React.useEffect(() => {
    const host = editorRef.current;
    if (!isPreview || !host) return;

    // Kerebron's destroy() replaces its mount element with an inert DOM clone,
    // which breaks React refs under StrictMode remounts. Mount into a fresh
    // child node each run and clear the host on cleanup instead.
    const mount = document.createElement('div');
    host.appendChild(mount);

    const editor = CoreEditor.create({
      element: mount,
      uri: 'file:///untitled.md',
      editorKits: [
        new AdvancedEditorKit(),
        { getExtensions: () => [new ExtensionHistory()] },
      ],
    });

    editorInstance.current = editor;

    const handler = async () => {
      if (!editorInstance.current) return;
      try {
        const buf = await editorInstance.current.saveDocument(
          'text/x-markdown'
        );
        onResponseRef.current({ answer: new TextDecoder().decode(buf) });
      } catch {
        // ignore
      }
    };

    // Attach the listener only after initial content is loaded, so mounting
    // never emits a phantom response for an untouched field.
    const ready = initialContent
      ? editor
          .loadDocument(
            'text/x-markdown',
            new TextEncoder().encode(initialContent)
          )
          .catch(() => {
            // ignore load errors
          })
      : Promise.resolve();

    let listening = false;
    ready.then(() => {
      if (editorInstance.current !== editor) return; // unmounted during load
      editor.addEventListener('transaction', handler);
      listening = true;
    });

    return () => {
      if (listening) editor.removeEventListener('transaction', handler);
      editor.destroy();
      editorInstance.current = null;
      // Remove the (now-cloned/inert) mount node left behind by destroy()
      host.replaceChildren();
    };
    // initialContent is intentionally read once at mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview]);

  // Builder canvas: static placeholder, no editor instance
  if (!isPreview) {
    return (
      <div className="richtext-field richtext-field--builder">
        {def.question && (
          <div className="richtext-field-question">{def.question}</div>
        )}
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
        <div className="richtext-field-question">{def.question}</div>
      )}
      <div ref={editorRef} className="kb-component" />
    </div>
  );
}
