import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { RichEditor } from '@mieweb/ui/kerebron';
// Kerebron base styles plus the mieweb theme bridge.
import '@mieweb/ui/kerebron.css';

// Typography for the editable area. The --kb-* palette is themed by
// @mieweb/ui/kerebron.css, so only content styles live here.
const CONTENT_STYLES = `
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
 * A thin adapter over @mieweb/ui's `RichEditor`: the answer is the editor's
 * markdown, so external changes (AI fill, clear) flow in through `value` and
 * edits flow out through `onChange`.
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

  const onResponseRef = React.useRef(onResponse);
  onResponseRef.current = onResponse;

  // Response takes priority, then defaultContent (DrawingPad's pattern).
  const answer =
    (response?.answer as string | undefined) ?? def.defaultContent ?? '';

  const handleChange = React.useCallback((markdown: string) => {
    onResponseRef.current({ answer: markdown });
  }, []);

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
      <RichEditor
        value={answer}
        onChange={handleChange}
        aria-label={def.question ? undefined : 'Rich text'}
        aria-labelledby={def.question ? questionId : undefined}
      />
    </div>
  );
}
