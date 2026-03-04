import { useSyncExternalStore } from 'react';
import type { FormStore } from '@msheet/core';

/**
 * Hook that subscribes to the root field IDs from the FormStore.
 * Returns an array of field IDs representing the top-level visible fields.
 *
 * @param form - The FormStore instance
 * @returns Array of root field IDs
 */
export function useVisibleFields(form: FormStore): readonly string[] {
  return useSyncExternalStore(
    (callback) => form.subscribe(callback),
    () => form.getState().normalized.rootIds,
    () => form.getState().normalized.rootIds
  );
}
