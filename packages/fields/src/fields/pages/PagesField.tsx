import React from 'react';
import type { FieldComponentProps, PagesFieldDefinition } from '@esheet/core';

type PagesFieldProps = FieldComponentProps & {
  nestedChildren?: React.ReactNode;
};

/**
 * PagesField — renders a single page of a multi-page form.
 *
 * Behaves like SectionField: shows a header and nested children.
 * Navigation between pages (when a form has multiple Pages fields) is
 * handled externally by RendererBody in preview/render mode.
 * The builder shows all pages stacked without navigation.
 */
export const PagesField = React.memo(function PagesField({
  field,
  isPreview,
  onUpdate,
  nestedChildren,
}: PagesFieldProps) {
  const def = field.definition as PagesFieldDefinition;

  if (isPreview) {
    return <>{nestedChildren}</>;
  }

  return (
    <div className="pages-field-edit ms:flex ms:flex-col ms:gap-3">
      <div className="ms:flex-1">
        <label
          htmlFor={`field-pages-title-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Page Title
        </label>
        <input
          id={`field-pages-title-${def.id}`}
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:min-w-0 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none"
          type="text"
          value={def.title || ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Page title (e.g., Personal Information)"
        />
      </div>
      <div className="pages-edit-children ms:flex-1">{nestedChildren}</div>
    </div>
  );
});
