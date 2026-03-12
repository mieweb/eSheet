import type React from 'react';
import {
  registerFieldType,
  type FieldTypeMeta,
  type FieldComponentProps,
} from '@msheet/core';

// ---------------------------------------------------------------------------
// Builder Component Registry
// ---------------------------------------------------------------------------
// Maps field type keys → React components for rendering on the Canvas.
// Sits alongside core's FieldTypeMeta registry (which is framework-agnostic).
// ---------------------------------------------------------------------------

type FieldComponent = React.ComponentType<FieldComponentProps>;

const componentRegistry = new Map<string, FieldComponent>();

/** Look up the builder component for a field type. Returns undefined if none registered. */
export function getFieldComponent(key: string): FieldComponent | undefined {
  return componentRegistry.get(key);
}

/** Returns the field type keys that have a registered React component. */
export function getRegisteredComponentKeys(): string[] {
  return [...componentRegistry.keys()];
}

/**
 * Register one or more custom field types with both core metadata AND a builder React component.
 *
 * This is the single entry-point for users to add custom fields to the builder.
 * Internally calls core's `registerFieldType()` and stores the component for Canvas rendering.
 *
 * @example
 * ```tsx
 * import { registerBuilderFieldTypes } from '@msheet/builder';
 *
 * registerBuilderFieldTypes({
 *   vitals: { label: 'Vitals', category: 'rich', answerType: 'object', hasOptions: false, hasMatrix: false, defaultProps: {}, component: VitalsField },
 *   labs:   { label: 'Labs',   category: 'rich', answerType: 'object', hasOptions: false, hasMatrix: false, defaultProps: {}, component: LabsField },
 * });
 * ```
 */
export function registerBuilderFieldTypes(
  entries: Record<string, FieldTypeMeta & { component: FieldComponent }>
): void {
  for (const [key, meta] of Object.entries(entries)) {
    const { component, ...coreMeta } = meta;
    registerFieldType(key, coreMeta);
    componentRegistry.set(key, component);
  }
}

/**
 * Batch-register only components for existing core field types.
 * Use this when field types are already in core's registry and you just need to attach React components.
 *
 * @example
 * ```tsx
 * registerBuilderComponents({
 *   text: TextFieldItem,
 *   radio: RadioFieldItem,
 *   dropdown: DropdownFieldItem,
 * });
 * ```
 */
export function registerBuilderComponents(
  components: Record<string, FieldComponent>
): void {
  for (const [key, component] of Object.entries(components)) {
    componentRegistry.set(key, component);
  }
}

/** Reset the component registry (useful for testing). */
export function resetComponentRegistry(): void {
  componentRegistry.clear();
}
