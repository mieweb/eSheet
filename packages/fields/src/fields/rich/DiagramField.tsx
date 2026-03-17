import React from 'react';
import type { FieldComponentProps } from '@msheet/core';
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
    [onResponse],
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
    [onUpdate],
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || isPreview) return;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [handlePaste, isPreview]);

  if (isPreview) {
    return (
      <div className="diagram-field-preview ms:space-y-2 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Diagram'}
          {isRequired && <span className="ms:text-msdanger ms:ml-0.5">*</span>}
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
      className="diagram-field-edit ms:space-y-3"
    >
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
          placeholder="Draw on the diagram"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      {/* Background image */}
      <div>
        <p className="ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Background Image
        </p>

        {def.imageUri ? (
          <div className="ms:relative ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-3">
            <button
              type="button"
              onClick={() => onUpdate({ imageUri: '' })}
              title="Remove image"
              aria-label="Remove background image"
              className="ms:absolute ms:top-2 ms:right-2 ms:w-6 ms:h-6 ms:flex ms:items-center ms:justify-center ms:rounded ms:bg-msdanger/10 ms:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:hover:bg-msdanger/20"
            >
              <svg className="ms:w-3.5 ms:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={def.imageUri}
              alt="Diagram background"
              className="ms:w-full ms:h-auto ms:max-h-48 ms:object-contain"
            />
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="ms:hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="diagram-upload-zone ms:w-full ms:flex ms:flex-col ms:items-center ms:justify-center ms:gap-1.5 ms:py-6 ms:border-2 ms:border-dashed ms:border-msborder ms:rounded-lg ms:bg-msbackground ms:hover:border-msprimary ms:hover:bg-msprimary/5 ms:transition-colors ms:cursor-pointer ms:outline-none ms:focus:outline-none"
            >
              <svg className="ms:w-8 ms:h-8 ms:text-mstextmuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="ms:text-sm ms:font-medium ms:text-mstextmuted">
                Upload or paste (Ctrl+V) a background image
              </p>
              <p className="ms:text-xs ms:text-mstextmuted ms:opacity-70">
                Optional — leave blank to draw on a plain canvas
              </p>
            </button>
          </>
        )}
      </div>

      {/* Static preview of the pad */}
      <div className="ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-3">
        <p className="ms:text-xs ms:text-mstextmuted ms:mb-2">Diagram pad preview</p>
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
