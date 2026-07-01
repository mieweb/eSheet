import React from 'react';
import type { FieldComponentProps, SectionFieldDefinition } from '@esheet/core';

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
  isSoftRequired,
  onUpdate,
  nestedChildren,
}: SectionFieldProps) {
  const def = field.definition as SectionFieldDefinition;
  const title = def.title || 'Section';

  if (isPreview) {
    return (
      <section className="section-field-preview ms:pb-0">
        <h3 className="ms:text-base ms:font-semibold ms:text-mstext ms:bg-msprimary/10 ms:px-4 ms:py-2 ms:break-words ms:overflow-hidden">
          {title}
          {(isRequired || isSoftRequired) && (
            <span className="ms:text-msdanger ms:ml-1">*</span>
          )}
        </h3>
        {nestedChildren && (
          <div className="ms:bg-mssurface ms:space-y-3">{nestedChildren}</div>
        )}
      </section>
    );
  }

  return (
    <div className="section-field-edit ms:flex ms:flex-col ms:gap-3">
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

      <div className="section-edit-children ms:flex-1">{nestedChildren}</div>
    </div>
  );
});
