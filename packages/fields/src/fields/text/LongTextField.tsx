import React from 'react';
import type {
  FieldComponentProps,
  LongtextFieldDefinition,
} from '@esheet/core';
import { Textarea } from '@mieweb/ui';

export const LongTextField = React.memo(function LongTextField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  isSoftRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as LongtextFieldDefinition;
  const instanceId = form.getState().instanceId;
  const sizingKey = `${def.rows ?? 1}-${def.maxRows ?? ''}`;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    const root = textarea?.closest('.esheet-renderer-root, .ms-builder-root');
    if (!textarea || !root) return;

    const touchState = () =>
      `${root.classList.contains(
        'esheet-touch-active'
      )}-${root.classList.contains('touch-mode-disabled')}`;
    let previous = touchState();
    const observer = new MutationObserver(() => {
      const current = touchState();
      if (current === previous) return;
      previous = current;
      textarea.style.height = 'auto';
      const borders = textarea.offsetHeight - textarea.clientHeight;
      textarea.style.height = `${textarea.scrollHeight + borders}px`;
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [sizingKey, isPreview]);

  const textareaStyle: React.CSSProperties = {
    maxHeight:
      def.maxRows === undefined
        ? undefined
        : `calc(${def.maxRows}lh + 2 * var(--esheet-textarea-padding-y, 7px) + 2px)`,
    overflowY: def.maxRows === undefined ? undefined : 'auto',
  };

  if (isPreview) {
    return (
      <div className="longtext-field-preview ms:space-y-1.5">
        <div className="ms:text-sm ms:font-medium ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
        </div>
        <Textarea
          key={sizingKey}
          ref={textareaRef}
          id={`${instanceId}-longtext-answer-${def.id}`}
          aria-label={def.question || 'Question'}
          disabled={!isEnabled}
          aria-required={isRequired || undefined}
          value={response?.answer || ''}
          onChange={(e) => onResponse({ answer: e.target.value })}
          placeholder="Type your answer"
          rows={def.rows}
          style={textareaStyle}
        />
      </div>
    );
  }

  return (
    <div className="longtext-field-edit ms:space-y-2">
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
      <Textarea
        key={sizingKey}
        ref={textareaRef}
        id={`${instanceId}-canvas-preview-${def.id}`}
        aria-label="Answer preview"
        value=""
        placeholder="Type your answer"
        rows={def.rows}
        style={textareaStyle}
        disabled
      />
    </div>
  );
});
