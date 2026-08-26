import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { CoreEditor } from '@kerebron/editor';
import { AdvancedEditorKit } from '@kerebron/editor-kits/AdvancedEditorKit';
import { getAssetLoad } from './asset-load.js';
import '@kerebron/editor/assets/index-light.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';

const CONTENT_STYLES = `
  .richtext-field .kb-component {
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
  .richtext-field .kb-editor::selection,
  .richtext-field .kb-editor::-moz-selection {
    background: color-mix(in srgb, var(--mieweb-primary-500, #3b82f6) 30%, transparent);
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

  .richtext-field .kb-menu__button[aria-pressed='true'],
  .richtext-field .kb-menu__button--active {
    background: var(--kb-color-primary);
    border-color: var(--kb-color-primary);
    color: white;
  }
  .richtext-field .kb-custom-menu__overflow-menu .kb-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-width: 0 !important;
    min-height: 0 !important;
    line-height: 1;
  }
  .richtext-field .kb-custom-menu__overflow-menu .kb-icon svg {
    width: 16px !important;
    height: 16px !important;
  }

  /* Cap the editor body height; toolbar stays put, body scrolls. */
  .richtext-field .kb-custom-menu__editor {
    height: 300px;
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

  const externalContent =
    (response?.answer as string | undefined) ?? def.defaultContent ?? '';
  const isLoadingRef = React.useRef(false);
  const pendingResponsesRef = React.useRef(new WeakSet<object>());

  React.useEffect(() => {
    const host = hostRef.current;
    if (!isPreview || !host) return;

    const mount = document.createElement('div');
    host.replaceChildren(mount);

    const editor = CoreEditor.create({
      element: mount,
      uri: 'file:///untitled.md',
      assetLoad: getAssetLoad(),
      editorKits: [new AdvancedEditorKit()],
    });
    editorRef.current = editor;

    const handleChanged = async () => {
      if (isLoadingRef.current) return;
      try {
        const buffer = await editor.saveDocument('text/x-markdown');
        const nextResponse = { answer: new TextDecoder().decode(buffer) };
        pendingResponsesRef.current.add(nextResponse);
        onResponseRef.current(nextResponse);
      } catch {
        // The editor may be destroyed while a save is pending.
      }
    };

    let listening = false;
    let destroyed = false;
    const loadInitial = async () => {
      isLoadingRef.current = true;
      try {
        await editor.loadDocumentText('text/x-markdown', externalContent);
      } catch (error) {
        console.error('[RichTextEditorField] loadDocument failed:', error);
      } finally {
        isLoadingRef.current = false;
      }
      if (destroyed) return;
      editor.addEventListener('changed', handleChanged);
      listening = true;
    };
    void loadInitial();

    return () => {
      destroyed = true;
      if (listening) editor.removeEventListener('changed', handleChanged);
      editor.destroy();
      editorRef.current = null;
      host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview]);

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
    editor.loadDocumentText('text/x-markdown', externalContent).finally(() => {
      isLoadingRef.current = false;
    });
  }, [externalContent, response]);

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

  const questionId = `${instanceId}-question-${def.id}`;

  return (
    <div
      className="richtext-field"
      // isolation:isolate creates a stacking context that traps the Kerebron
      // toolbar z-index so it doesn't overlap modals rendered above this field.
      style={{ isolation: 'isolate' } as React.CSSProperties}
    >
      {def.question && (
        <div
          id={questionId}
          className="richtext-field-question"
          style={{ marginBottom: 8 }}
        >
          {def.question}
        </div>
      )}
      <div
        ref={hostRef}
        className="kb-component"
        aria-label={def.question ? undefined : 'Rich text'}
        aria-labelledby={def.question ? questionId : undefined}
      />
    </div>
  );
}
