import type React from 'react';
import { registerFieldType, type FieldTypeMeta, type FieldComponentProps } from '@msheet/core';

// ---------------------------------------------------------------------------
// Field Component Registry
// ---------------------------------------------------------------------------
// Maps field type keys → React components for rendering fields.
// Shared between @msheet/builder (canvas) and @msheet/renderer (fill-out mode).
// ---------------------------------------------------------------------------

type FieldComponent = React.ComponentType<FieldComponentProps>;

const componentRegistry = new Map<string, FieldComponent>();

/** Look up the component for a field type. Returns undefined if none registered. */
export function getFieldComponent(key: string): FieldComponent | undefined {
  return componentRegistry.get(key);
}

/** Returns the field type keys that have a registered React component. */
export function getRegisteredComponentKeys(): string[] {
  return [...componentRegistry.keys()];
}

/** Register React components for field types. */
export function registerFieldComponents(components: Record<string, FieldComponent>): void {
  for (const [key, component] of Object.entries(components)) {
    componentRegistry.set(key, component);
  }
}

/** Reset the component registry (useful for testing). */
export function resetComponentRegistry(): void {
  componentRegistry.clear();
}

/**
 * Register one or more custom field types with both core metadata AND a React component.
 *
 * Works with both @msheet/builder (canvas) and @msheet/renderer (fill-out mode).
 *
 * @example
 * ```tsx
 * import { registerCustomFieldTypes } from '@msheet/fields';
 *
 * registerCustomFieldTypes({
 *   vitals: { label: 'Vitals', category: 'rich', answerType: 'object', hasOptions: false, hasMatrix: false, defaultProps: {}, component: VitalsField },
 * });
 * ```
 */
export function registerCustomFieldTypes(
  entries: Record<string, FieldTypeMeta & { component: FieldComponent }>
): void {
  const components: Record<string, FieldComponent> = {};
  for (const [key, meta] of Object.entries(entries)) {
    const { component, ...coreMeta } = meta;
    registerFieldType(key, coreMeta);
    components[key] = component;
  }
  registerFieldComponents(components);
}
