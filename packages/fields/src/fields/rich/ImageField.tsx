import React from 'react';
import type { FieldComponentProps } from '@esheet/core';

export const ImageField = React.memo(function ImageField({
  field,
  form,
  isPreview,
  onUpdate,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // --- File upload handler ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdate({ imageUri: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // --- Clipboard paste (edit mode only) ---
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

  // --- Preview (display) mode ---
  if (isPreview) {
    return (
      <div className="image-field-preview es:pb-4">
        {def.question && (
          <div className="es:font-light es:text-estext es:break-words es:overflow-hidden es:mb-2">
            {def.question}
          </div>
        )}
        {def.imageUri ? (
          <>
            <div className="es:flex es:justify-center">
              <img
                src={def.imageUri}
                alt={def.altText || ''}
                className="es:w-full es:h-auto es:object-contain es:rounded"
              />
            </div>
            {def.caption && (
              <p className="es:text-sm es:text-estextmuted es:text-center es:mt-2">
                {def.caption}
              </p>
            )}
          </>
        ) : (
          <div className="es:flex es:items-center es:justify-center es:h-24 es:rounded es:border es:border-dashed es:border-esborder es:bg-esbackground es:text-estextmuted es:text-sm">
            No image
          </div>
        )}
      </div>
    );
  }

  // --- Edit (canvas) mode ---
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="image-field-edit es:space-y-3"
    >
      {/* Optional title / question */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
        >
          Title (optional)
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          aria-label="Image title"
          type="text"
          value={def.question ?? ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="e.g., Figure 1"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
      </div>

      {/* Alt text */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-alttext-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
        >
          Alt text (accessibility)
        </label>
        <input
          id={`${instanceId}-canvas-alttext-${def.id}`}
          aria-label="Alt text"
          type="text"
          value={def.altText ?? ''}
          onChange={(e) => onUpdate({ altText: e.target.value })}
          placeholder="Describe the image for screen readers"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
      </div>

      {/* Caption */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-caption-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
        >
          Caption (optional)
        </label>
        <input
          id={`${instanceId}-canvas-caption-${def.id}`}
          aria-label="Caption"
          type="text"
          value={def.caption ?? ''}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder="Optional caption shown below the image"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none es:transition-colors"
        />
      </div>

      {/* Image upload area */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="es:hidden"
      />

      {def.imageUri ? (
        <div className="es:relative es:rounded-lg es:border es:border-esborder es:bg-esbackground es:p-4">
          <button
            type="button"
            onClick={() => onUpdate({ imageUri: '' })}
            title="Remove image"
            aria-label="Remove image"
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
          <p className="es:text-xs es:font-medium es:text-estextmuted es:mb-2">
            Preview
          </p>
          <div className="es:flex es:justify-center">
            <img
              src={def.imageUri}
              alt={def.altText || 'Preview'}
              className="es:max-w-full es:h-auto es:object-contain es:rounded"
            />
          </div>
          {def.caption && (
            <p className="es:text-sm es:text-estextmuted es:text-center es:mt-2">
              {def.caption}
            </p>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="es:mt-3 es:text-xs es:text-esprimary es:underline es:bg-transparent es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer"
          >
            Replace image
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="image-upload-zone es:w-full es:flex es:flex-col es:items-center es:justify-center es:gap-2 es:py-10 es:border-2 es:border-dashed es:border-esborder es:rounded-lg es:bg-esbackground es:hover:border-esprimary es:hover:bg-esprimary/5 es:transition-colors es:cursor-pointer es:outline-none es:focus:outline-none"
        >
          <svg
            className="es:w-10 es:h-10 es:text-estextmuted"
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
            Click to upload or paste (Ctrl+V) an image
          </p>
        </button>
      )}
    </div>
  );
});
