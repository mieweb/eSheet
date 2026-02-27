import { useSyncExternalStore } from 'react';
import type { UIStore } from '../ui-store.js';

/**
 * Hook that subscribes to the selected field ID from the UIStore.
 * Re-renders when the selected field changes.
 *
 * @param ui - The UIStore instance
 * @returns The currently selected field ID, or null
 */
export function useSelectedFieldId(ui: UIStore): string | null {
  return useSyncExternalStore(
    (callback) => ui.subscribe(callback),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId
  );
}
