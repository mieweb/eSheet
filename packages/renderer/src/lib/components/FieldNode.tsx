import React from 'react';
import type { FieldComponentProps, FormStore, UIStore } from '@msheet/core';
import { getFieldComponent } from '@msheet/fields';

export interface FieldNodeProps {
  id: string;
  form: FormStore;
  ui: UIStore;
  /** Nesting depth for visual styling (default: 0) */
  depth?: number;
}

/**
 * FieldNode - Renders a single field or section with recursive children
 *
 * Looks up the field component from the registry and passes field props.
 * For sections, recursively renders visible children.
 */
export const FieldNode = React.memo(function FieldNode({
  id,
  form,
  ui,
  depth = 1,
}: FieldNodeProps) {
  // Subscribe to field data
  const field = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().getField(id),
    () => form.getState().getField(id)
  );

  const normalized = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().normalized,
    () => form.getState().normalized
  );

  const responses = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().responses,
    () => form.getState().responses
  );

  // Get visible children for sections
  const visibleChildIds = React.useMemo(() => {
    if (!field || field.definition.fieldType !== 'section') return [];

    const node = normalized.byId[id];
    if (!node || node.childIds.length === 0) return [];

    const cache = new Map<string, boolean>();

    const isFieldRenderable = (fieldId: string): boolean => {
      const cached = cache.get(fieldId);
      if (cached !== undefined) return cached;

      const isVisible = form.getState().isVisible(fieldId);
      if (!isVisible) {
        cache.set(fieldId, false);
        return false;
      }

      const childNode = normalized.byId[fieldId];
      if (!childNode) {
        cache.set(fieldId, false);
        return false;
      }

      if (childNode.definition.fieldType !== 'section') {
        cache.set(fieldId, true);
        return true;
      }

      const hasRenderableChild = childNode.childIds.some((cid) =>
        isFieldRenderable(cid)
      );
      cache.set(fieldId, hasRenderableChild);
      return hasRenderableChild;
    };

    return node.childIds.filter((childId) => isFieldRenderable(childId));
  }, [field, id, form, normalized, responses]);

  // Render nested children for sections
  const nestedChildren = React.useMemo(() => {
    if (
      !field ||
      field.definition.fieldType !== 'section' ||
      visibleChildIds.length === 0
    ) {
      return null;
    }

    const containerClass =
      depth === 1
        ? 'section-children ms:space-y-2'
        : 'section-children ms:space-y-2 ms:border-l ms:border-msborder ms:pl-3';

    return (
      <div className={containerClass} data-depth={depth}>
        {visibleChildIds.map((childId) => (
          <FieldNode
            key={childId}
            id={childId}
            form={form}
            ui={ui}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }, [field, visibleChildIds, id, form, ui, depth]);

  if (!field) return null;

  const Component = getFieldComponent(field.definition.fieldType)!;

  // Check if field is enabled/required via conditional logic
  const isVisible = form.getState().isVisible(field.definition.id);
  const isEnabled = form.getState().isEnabled(field.definition.id);
  const isRequired = form.getState().isRequired(field.definition.id);
  const response = form.getState().getResponse(field.definition.id);

  if (!isVisible) return null;

  const props: FieldComponentProps = {
    field,
    form,
    ui,
    isSelected: false,
    isPreview: true,
    isEnabled,
    isRequired,
    response,
    onRemove: () => undefined, // No-op in renderer
    onUpdate: () => undefined, // No-op in renderer
    onResponse: (value) =>
      form.getState().setResponse(field.definition.id, value),
  };

  const isSection = field.definition.fieldType === 'section';
  const parentNode = field.parentId
    ? form.getState().getField(field.parentId)
    : null;
  const isChildOfSection = parentNode?.definition.fieldType === 'section';

  const wrapperClass = `field-wrapper ms:bg-mssurface${
    isSection ? ' ms:mb-2 ms:border ms:border-msborder ms:rounded' : ''
  }${
    !isSection && !isChildOfSection
      ? ' ms:mb-2 ms:p-6 ms:border ms:border-msborder ms:rounded'
      : ''
  }${
    isChildOfSection
      ? ' ms:p-6 ms:border-b ms:border-msborder ms:last:border-b-0'
      : ''
  }${!isEnabled ? ' ms:opacity-50 ms:pointer-events-none' : ''}${
    isRequired && !isSection && !isChildOfSection
      ? ' ms:border-l-2 ms:border-l-msdanger'
      : ''
  }`;

  return (
    <div
      className={wrapperClass}
      data-field-type={field.definition.fieldType}
      data-field-id={field.definition.id}
      aria-disabled={!isEnabled || undefined}
    >
      {field.definition.fieldType === 'section' ? (
        (() => {
          const SectionComponent = Component as React.ComponentType<
            FieldComponentProps & { nestedChildren?: React.ReactNode }
          >;
          return (
            <SectionComponent {...props} nestedChildren={nestedChildren} />
          );
        })()
      ) : (
        <Component {...props} />
      )}
    </div>
  );
});
