import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { KerebronEditor } from './KerebronEditor.js';

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

  const externalContent =
    (response?.answer as string | undefined) ?? def.defaultContent ?? '';

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
      <KerebronEditor
        id={`${instanceId}-richtext-answer-${def.id}`}
        ariaLabel={def.question || 'Rich text'}
        labelledBy={def.question ? questionId : undefined}
        minHeight={80}
        value={externalContent}
        onChange={(answer) => onResponse({ answer })}
      />
    </div>
  );
}
