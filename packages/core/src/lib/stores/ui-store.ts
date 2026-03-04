import { createStore } from 'zustand/vanilla';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Editor mode — which panel layout is active. */
export type BuilderMode = 'build' | 'code' | 'preview';

/** Active tab inside the edit panel. */
export type EditTab = 'edit' | 'logic';

/** Full state + actions for the builder's UI chrome. */
export interface UIState {
  // --- Data ---
  /** Currently selected field ID (blue dashed border in canvas). */
  selectedFieldId: string | null;
  /** Editor mode. */
  mode: BuilderMode;
  /** Active tab in the edit panel (only relevant when mode === 'build'). */
  editTab: EditTab;
  /** Whether the mobile edit bottom-sheet is open. */
  editModalOpen: boolean;
  /** True when the code editor has a parse/validation error — blocks mode switch. */
  codeEditorHasError: boolean;

  // --- Actions ---
  selectField: (fieldId: string | null) => void;
  setMode: (mode: BuilderMode) => void;
  setEditTab: (tab: EditTab) => void;
  setEditModalOpen: (open: boolean) => void;
  setCodeEditorHasError: (hasError: boolean) => void;
}

/** Store handle returned by `createUIStore`. */
export type UIStore = ReturnType<typeof createUIStore>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createUIStore() {
  return createStore<UIState>((set) => ({
    selectedFieldId: null,
    mode: 'build',
    editTab: 'edit',
    editModalOpen: false,
    codeEditorHasError: false,

    selectField: (fieldId) =>
      set({ selectedFieldId: fieldId, editTab: 'edit' }),

    setMode: (mode) => set({ mode }),

    setEditTab: (tab) => set({ editTab: tab }),

    setEditModalOpen: (open) => set({ editModalOpen: open }),

    setCodeEditorHasError: (hasError) => set({ codeEditorHasError: hasError }),
  }));
}
