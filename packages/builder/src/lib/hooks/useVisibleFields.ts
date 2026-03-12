import { useRef, useSyncExternalStore } from 'react';
import type { FormStore, UIStore } from '@msheet/core';

/**
 * Hook that subscribes to the root field IDs from the FormStore.
 * In build/code mode returns all root IDs; in preview mode filters
 * by conditional visibility rules so hidden fields are excluded.
 *
 * @param form - The FormStore instance
 * @param ui   - The UIStore instance (to check current mode)
 * @returns Array of visible root field IDs
 */
export function useVisibleFields(
  form: FormStore,
  ui: UIStore
): readonly string[] {
  const cacheRef = useRef<readonly string[]>([]);

  return useSyncExternalStore(
    (callback) => {
      const unsub1 = form.subscribe(callback);
      const unsub2 = ui.subscribe(callback);
      return () => {
        unsub1();
        unsub2();
      };
    },
    () => {
      const mode = ui.getState().mode;
      const { normalized } = form.getState();

      // Build / code mode — show every field
      if (mode !== 'preview') return normalized.rootIds;

      // Preview mode — hide fields whose visibility rules evaluate to false
      const filtered = normalized.rootIds.filter((id) =>
        form.getState().isVisible(id)
      );

      // Return a stable reference when the filtered content hasn't changed
      const prev = cacheRef.current;
      if (
        prev.length === filtered.length &&
        prev.every((v, i) => v === filtered[i])
      ) {
        return prev;
      }
      cacheRef.current = filtered;
      return filtered;
    },
    () => form.getState().normalized.rootIds
  );
}
