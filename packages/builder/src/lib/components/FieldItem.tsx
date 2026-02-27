import React from 'react';
import type { FieldWrapperRenderProps } from './FieldWrapper.js';
import { useInstanceId } from '../MsheetBuilder.js';

/**
 * FieldItem - Placeholder field component for the Canvas.
 *
 * This is a simple placeholder that displays the field type and question.
 * Real field rendering will be built later.
 */
export const FieldItem = React.memo(function FieldItem({
  field,
  onUpdate,
}: FieldWrapperRenderProps) {
  const def = field.definition;
  const instanceId = useInstanceId();

  return (
    <div className="field-item">
      {/* Question */}
      <div className="field-question ms:text-sm ms:text-mstext">
        <input
          id={`${instanceId}-editor-question-${def.id}`}
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.currentTarget.value })}
          placeholder="Enter question..."
          className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:bg-transparent ms:border ms:border-msborder ms:rounded ms:text-mstext placeholder:ms:text-mstextmuted focus:ms:outline-none focus:ms:ring-2 focus:ms:ring-msprimary focus:ms:border-msprimary"
        />
      </div>
    </div>
  );
});
