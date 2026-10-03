import type React from 'react';
import {
  registerFieldType,
  type FieldDefinition,
  type FieldTypeMeta,
  type FieldComponentProps,
} from '@esheet/core';

// ---------------------------------------------------------------------------
// Field Component Registry
// ---------------------------------------------------------------------------
// Maps field type keys → React components for rendering fields.
// Shared between @esheet/builder (canvas) and @esheet/renderer (fill-out mode).
// ---------------------------------------------------------------------------

type FieldComponent = React.ComponentType<FieldComponentProps>;

export interface FieldPropertyEditorProps {
  readonly fieldId: string;
  readonly instanceId: string;
  readonly def: Omit<FieldDefinition, 'fields'>;
  readonly onUpdate: (patch: Partial<Omit<FieldDefinition, 'fields'>>) => void;
}

type FieldPropertyEditor = React.ComponentType<FieldPropertyEditorProps>;

const componentRegistry = new Map<string, FieldComponent>();
const propertyEditorRegistry = new Map<string, FieldPropertyEditor>();

/** Look up the component for a field type. Returns undefined if none registered. */
export function getFieldComponent(key: string): FieldComponent | undefined {
  return componentRegistry.get(key);
}

/** Returns the field type keys that have a registered React component. */
export function getRegisteredComponentKeys(): string[] {
  return [...componentRegistry.keys()];
}

/** Look up the Edit-mode property editor registered for a field type. */
export function getFieldPropertyEditor(
  key: string
): FieldPropertyEditor | undefined {
  return propertyEditorRegistry.get(key);
}

/** Register React components for field types. */
export function registerFieldComponents(
  components: Record<string, FieldComponent>
): void {
  for (const [key, component] of Object.entries(components)) {
    componentRegistry.set(key, component);
  }
}

/** Reset the component registry (useful for testing). */
export function resetComponentRegistry(): void {
  componentRegistry.clear();
  propertyEditorRegistry.clear();
}

/**
 * Register one or more custom field types with both core metadata AND a React component.
 *
 * Works with both @esheet/builder (canvas) and @esheet/renderer (fill-out mode).
 *
 * @example
 * ```tsx
 * import { registerCustomFieldTypes } from '@esheet/fields';
 *
 * registerCustomFieldTypes({
 *   vitals: { label: 'Vitals', category: 'rich', answerType: 'object', hasOptions: false, hasMatrix: false, defaultProps: {}, component: VitalsField },
 * });
 * ```
 */
export function registerCustomFieldTypes(
  entries: Record<
    string,
    FieldTypeMeta & {
      component: FieldComponent;
      propertyEditor?: FieldPropertyEditor;
    }
  >
): void {
  const components: Record<string, FieldComponent> = {};
  for (const [key, meta] of Object.entries(entries)) {
    const { component, propertyEditor, ...coreMeta } = meta;
    registerFieldType(key, coreMeta);
    components[key] = component;
    if (propertyEditor) propertyEditorRegistry.set(key, propertyEditor);
    else propertyEditorRegistry.delete(key);
  }
  registerFieldComponents(components);
}
