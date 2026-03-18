import React from 'react';
import type { FieldComponentProps } from '@msheet/core';

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
      <div className="image-field-preview ms:pb-4">
        {def.question && (
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden ms:mb-2">
            {def.question}
          </div>
        )}
        {def.imageUri ? (
          <>
            <div className="ms:flex ms:justify-center">
              <img
                src={def.imageUri}
                alt={def.altText || ''}
                className="ms:w-full ms:h-auto ms:object-contain ms:rounded"
              />
            </div>
            {def.caption && (
              <p className="ms:text-sm ms:text-mstextmuted ms:text-center ms:mt-2">
                {def.caption}
              </p>
            )}
          </>
        ) : (
          <div className="ms:flex ms:items-center ms:justify-center ms:h-24 ms:rounded ms:border ms:border-dashed ms:border-msborder ms:bg-msbackground ms:text-mstextmuted ms:text-sm">
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
      className="image-field-edit ms:space-y-3"
    >
      {/* Optional title / question */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      {/* Alt text */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-alttext-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      {/* Caption */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-caption-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      {/* Image upload area */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="ms:hidden"
      />

      {def.imageUri ? (
        <div className="ms:relative ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-4">
          <button
            type="button"
            onClick={() => onUpdate({ imageUri: '' })}
            title="Remove image"
            aria-label="Remove image"
            className="ms:absolute ms:top-2 ms:right-2 ms:w-6 ms:h-6 ms:flex ms:items-center ms:justify-center ms:rounded ms:bg-msdanger/10 ms:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:hover:bg-msdanger/20"
          >
            <svg
              className="ms:w-3.5 ms:h-3.5"
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
          <p className="ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-2">
            Preview
          </p>
          <div className="ms:flex ms:justify-center">
            <img
              src={def.imageUri}
              alt={def.altText || 'Preview'}
              className="ms:max-w-full ms:h-auto ms:object-contain ms:rounded"
            />
          </div>
          {def.caption && (
            <p className="ms:text-sm ms:text-mstextmuted ms:text-center ms:mt-2">
              {def.caption}
            </p>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ms:mt-3 ms:text-xs ms:text-msprimary ms:underline ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer"
          >
            Replace image
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="image-upload-zone ms:w-full ms:flex ms:flex-col ms:items-center ms:justify-center ms:gap-2 ms:py-10 ms:border-2 ms:border-dashed ms:border-msborder ms:rounded-lg ms:bg-msbackground ms:hover:border-msprimary ms:hover:bg-msprimary/5 ms:transition-colors ms:cursor-pointer ms:outline-none ms:focus:outline-none"
        >
          <svg
            className="ms:w-10 ms:h-10 ms:text-mstextmuted"
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
          <p className="ms:text-sm ms:font-medium ms:text-mstextmuted">
            Click to upload or paste (Ctrl+V) an image
          </p>
        </button>
      )}
    </div>
  );
});
