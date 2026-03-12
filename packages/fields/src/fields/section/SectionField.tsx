import React from 'react';
import type { FieldComponentProps } from '@msheet/core';

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

  if (isPreview) {
    return (
      <section className="section-field-preview ms:pb-0">
        <div className="ms:bg-msprimary ms:text-mstextsecondary ms:text-xl ms:px-4 ms:py-2 ms:rounded-t-lg ms:break-words ms:overflow-hidden">
          {title}
          {isRequired && <span className="ms:text-mstextsecondary ms:ml-1">*</span>}
        </div>
      </section>
    );
  }

  return (
    <div className="section-field-edit ms:space-y-3">
      <div className="section-field-header ms:flex ms:justify-between ms:items-center ms:gap-2">
        <div className="ms:flex-1">
          <label
            htmlFor={`field-title-${def.id}`}
            className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Section Title
          </label>
          <input
            id={`field-title-${def.id}`}
            aria-label="Section Title"
            className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:min-w-0 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none"
            type="text"
            value={def.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Section title (e.g., Data Consent)"
          />
        </div>
      </div>

      {!hasChildren && (
        <div className="ms:flex ms:flex-col ms:items-center ms:justify-center ms:p-8 ms:bg-gradient-to-br ms:from-msbackground ms:to-msbackgroundsecondary ms:border-2 ms:border-dashed ms:border-msprimary/30 ms:rounded-lg ms:shadow-sm ms:text-center">
          <p className="ms:text-sm ms:font-semibold ms:text-mstext ms:mb-2">
            No fields in this section
          </p>
          <p className="ms:text-xs ms:text-mstextmuted ms:leading-relaxed">
            Use the Tool Panel on the left to add fields.
          </p>
        </div>
      )}

      {hasChildren && (
        <div className="section-edit-children ms:mt-2 ms:space-y-2">
          {nestedChildren}
        </div>
      )}
    </div>
  );
});