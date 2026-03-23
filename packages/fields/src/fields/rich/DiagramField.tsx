import React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { DrawingPad } from './DrawingPad.js';

export const DiagramField = React.memo(function DiagramField({
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleChange = React.useCallback(
    (payload: { strokes: string; image: string }) => {
      onResponse({ markupData: payload.strokes, markupImage: payload.image });
    },
    [onResponse]
  );

  // --- Image upload via file picker ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdate({ imageUri: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected after removal
    e.target.value = '';
  };

  // --- Paste image from clipboard (only active in edit mode) ---
  const handlePaste = React.useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            onUpdate({ imageUri: ev.target?.result as string });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    },
    [onUpdate]
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || isPreview) return;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [handlePaste, isPreview]);

  if (isPreview) {
    return (
      <div className="diagram-field-preview es:space-y-2 es:pb-4">
        <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Diagram'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>
        <DrawingPad
          config={{
            baseWidth: 640,
            baseHeight: 400,
            strokeColor: '#ef4444',
            strokeWidth: 3,
            eraserWidth: 20,
            hasEraser: true,
            backgroundColor: '#ffffff',
          }}
          backgroundImage={def.imageUri}
          placeholder={def.padPlaceholder || 'Draw on the diagram'}
          existingData={response?.markupData}
          onChange={handleChange}
          disabled={!isEnabled}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="diagram-field-edit es:space-y-3"
    >
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
          placeholder="Draw on the diagram"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
      </div>

      {/* Background image */}
      <div>
        <p className="es:text-sm es:font-medium es:text-estextmuted es:mb-2">
          Background Image
        </p>

        {def.imageUri ? (
          <div className="es:relative es:rounded-lg es:border es:border-esborder es:bg-esbackground es:p-3">
            <button
              type="button"
              onClick={() => onUpdate({ imageUri: '' })}
              title="Remove image"
              aria-label="Remove background image"
              className="es:absolute es:top-2 es:right-2 es:w-6 es:h-6 es:flex es:items-center es:justify-center es:rounded es:bg-esdanger/10 es:text-esdanger es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer es:hover:bg-esdanger/20"
            >
              <svg
                className="es:w-3.5 es:h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={def.imageUri}
              alt="Diagram background"
              className="es:w-full es:h-auto es:max-h-48 es:object-contain"
            />
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="es:hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="diagram-upload-zone es:w-full es:flex es:flex-col es:items-center es:justify-center es:gap-1.5 es:py-6 es:border-2 es:border-dashed es:border-esborder es:rounded-lg es:bg-esbackground es:hover:border-esprimary es:hover:bg-esprimary/5 es:transition-colors es:cursor-pointer es:outline-none es:focus:outline-none"
            >
              <svg
                className="es:w-8 es:h-8 es:text-estextmuted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="es:text-sm es:font-medium es:text-estextmuted">
                Upload or paste (Ctrl+V) a background image
              </p>
              <p className="es:text-xs es:text-estextmuted es:opacity-70">
                Optional — leave blank to draw on a plain canvas
              </p>
            </button>
          </>
        )}
      </div>

      {/* Static preview of the pad */}
      <div className="es:rounded-lg es:border es:border-esborder es:bg-esbackground es:p-3">
        <p className="es:text-xs es:text-estextmuted es:mb-2">
          Diagram pad preview
        </p>
        <DrawingPad
          config={{
            baseWidth: 640,
            baseHeight: 400,
            strokeColor: '#ef4444',
            strokeWidth: 3,
            eraserWidth: 20,
            hasEraser: true,
            backgroundColor: '#ffffff',
          }}
          backgroundImage={def.imageUri}
          placeholder={def.padPlaceholder || 'Draw on the diagram'}
          disabled
        />
      </div>
    </div>
  );
});
