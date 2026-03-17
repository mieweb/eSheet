import React from 'react';
import type { FieldComponentProps } from '@msheet/core';
import { DrawingPad } from './DrawingPad.js';

export const SignatureField = React.memo(function SignatureField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;

  const handleChange = React.useCallback(
    (payload: { strokes: string; image: string }) => {
      onResponse({ signatureData: payload.strokes, signatureImage: payload.image });
    },
    [onResponse],
  );

  if (isPreview) {
    return (
      <div className="signature-field-preview ms:space-y-2 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Signature'}
          {isRequired && <span className="ms:text-msdanger ms:ml-0.5">*</span>}
        </div>
        <DrawingPad
          config={{
            baseWidth: 600,
            baseHeight: 200,
            strokeColor: '#000000',
            strokeWidth: 2,
            hasEraser: false,
            backgroundColor: '#ffffff',
          }}
          placeholder={def.padPlaceholder || 'Sign here'}
          existingData={response?.signatureData}
          onChange={handleChange}
          disabled={!isEnabled}
        />
      </div>
    );
  }

  return (
    <div className="signature-field-edit ms:space-y-3">
      {/* Question */}
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
          value={def.question ?? ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      {/* Canvas placeholder text */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-pad-placeholder-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Canvas Placeholder
        </label>
        <input
          id={`${instanceId}-canvas-pad-placeholder-${def.id}`}
          aria-label="Canvas placeholder text"
          type="text"
          value={def.padPlaceholder ?? ''}
          onChange={(e) => onUpdate({ padPlaceholder: e.target.value })}
          placeholder="Sign here"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      {/* Static preview of the empty pad */}
      <div className="ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-3">
        <p className="ms:text-xs ms:text-mstextmuted ms:mb-2">Signature pad preview</p>
        <DrawingPad
          config={{
            baseWidth: 600,
            baseHeight: 200,
            strokeColor: '#000000',
            strokeWidth: 2,
            hasEraser: false,
            backgroundColor: '#ffffff',
          }}
          placeholder={def.padPlaceholder || 'Sign here'}
          disabled
        />
      </div>
    </div>
  );
});
