import React from 'react';
import type { FormStore, UIStore } from '@msheet/core';
import { FieldNode } from './FieldNode.js';

export interface RendererBodyProps {
  form: FormStore;
  ui: UIStore;
}

/**
 * RendererBody - Iterates over visible root fields and renders them
 *
 * Respects conditional visibility logic from form store.
 * Only renders fields where isVisible() returns true.
 * Sections recursively render their visible children.
 */
export function RendererBody({ form, ui }: RendererBodyProps) {
  // Subscribe to form state for visibility updates and responses
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

  // Compute visible root fields
  const visibleRootIds = React.useMemo(() => {
    const cache = new Map<string, boolean>();

    const isFieldRenderable = (fieldId: string): boolean => {
      const cached = cache.get(fieldId);
      if (cached !== undefined) return cached;

      const isVisible = form.getState().isVisible(fieldId);
      if (!isVisible) {
        cache.set(fieldId, false);
        return false;
      }

      const node = normalized.byId[fieldId];
      if (!node) {
        cache.set(fieldId, false);
        return false;
      }

      // Non-section fields are renderable if visible
      if (node.definition.fieldType !== 'section') {
        cache.set(fieldId, true);
        return true;
      }

      // Sections are renderable only if they have at least one renderable child
      const hasRenderableChild = node.childIds.some((childId) => isFieldRenderable(childId));
      cache.set(fieldId, hasRenderableChild);
      return hasRenderableChild;
    };

    return normalized.rootIds.filter((id) => isFieldRenderable(id));
  }, [form, normalized, responses]);

  return (
    <div className="canvas-fields renderer-body ms:space-y-0">
      {visibleRootIds.map((id) => (
        <FieldNode key={id} id={id} form={form} ui={ui} />
      ))}
    </div>
  );
}
