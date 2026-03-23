import React from 'react';
import type { FieldComponentProps } from '@esheet/core';

type SectionFieldProps = FieldComponentProps & {
  nestedChildren?: React.ReactNode;
};

/**
 * SectionField - Renders section header and empty state.
 * Canvas manages rendering nested children.
 */
export const SectionField = React.memo(function SectionField({
  field,
  isPreview,
  isRequired,
  onUpdate,
  nestedChildren,
}: SectionFieldProps) {
  const def = field.definition;
  const title = def.title || 'Section';
  const hasChildren = field.childIds ? field.childIds.length > 0 : false;
  const hasNestedContent =
    nestedChildren !== null && nestedChildren !== undefined;

  if (isPreview) {
    return (
      <section className="section-field-preview es:pb-0">
        <div className="es:bg-esprimary es:text-estextsecondary es:text-xl es:px-4 es:py-2 es:rounded-t-lg es:break-words es:overflow-hidden">
          {title}
          {isRequired && (
            <span className="es:text-estextsecondary es:ml-1">*</span>
          )}
        </div>
        {nestedChildren && (
          <div className="es:bg-essurface es:space-y-3">{nestedChildren}</div>
        )}
      </section>
    );
  }

  return (
    <div className="section-field-edit es:space-y-3">
      <div className="section-field-header es:flex es:justify-between es:items-center es:gap-2">
        <div className="es:flex-1">
          <label
            htmlFor={`field-title-${def.id}`}
            className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
          >
            Section Title
          </label>
          <input
            id={`field-title-${def.id}`}
            aria-label="Section Title"
            className="es:px-3 es:py-2 es:h-10 es:w-full es:min-w-0 es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary/30 es:outline-none"
            type="text"
            value={def.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Section title (e.g., Data Consent)"
          />
        </div>
      </div>

      {!hasChildren && !hasNestedContent && (
        <div className="es:flex es:flex-col es:items-center es:justify-center es:p-8 es:bg-gradient-to-br es:from-esbackground es:to-esbackgroundsecondary es:border-2 es:border-dashed es:border-esprimary/30 es:rounded-lg es:shadow-sm es:text-center">
          <p className="es:text-sm es:font-semibold es:text-estext es:mb-2">
            No fields in this section
          </p>
          <p className="es:text-xs es:text-estextmuted es:leading-relaxed">
            Use the Tool Panel on the left to add fields.
          </p>
        </div>
      )}

      {!hasChildren && hasNestedContent && (
        <div className="section-edit-empty-drop es:mt-2">{nestedChildren}</div>
      )}

      {hasChildren && (
        <div className="section-edit-children es:mt-2 es:space-y-2">
          {nestedChildren}
        </div>
      )}
    </div>
  );
});
