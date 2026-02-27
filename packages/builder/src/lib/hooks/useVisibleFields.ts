import { useSyncExternalStore } from 'react';
import type { FormEngine } from '@msheet/core';

/**
 * Hook that subscribes to the root field IDs from the FormEngine.
 * Returns an array of field IDs representing the top-level visible fields.
 *
 * @param engine - The FormEngine instance
 * @returns Array of root field IDs
 */
export function useVisibleFields(engine: FormEngine): readonly string[] {
  return useSyncExternalStore(
    (callback) => engine.subscribe(callback),
    () => engine.getState().normalized.rootIds,
    () => engine.getState().normalized.rootIds
  );
}
