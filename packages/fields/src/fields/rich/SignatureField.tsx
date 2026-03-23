import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
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
      onResponse({
        signatureData: payload.strokes,
        signatureImage: payload.image,
      });
    },
    [onResponse]
  );

  if (isPreview) {
    return (
      <div className="signature-field-preview es:space-y-2 es:pb-4">
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Signature'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
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
    <div className="signature-field-edit es:space-y-3">
      {/* Question */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
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
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
      </div>

      {/* Canvas placeholder text */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-pad-placeholder-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
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
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
      </div>

      {/* Static preview of the empty pad */}
      <div className="es:rounded-lg es:border es:border-esborder es:bg-esbackground es:p-3">
        <p className="es:text-xs es:text-estextmuted es:mb-2">
          Signature pad preview
        </p>
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
