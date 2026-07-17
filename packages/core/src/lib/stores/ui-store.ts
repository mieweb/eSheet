import { createStore } from 'zustand/vanilla';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Editor mode — which panel layout is active. */
export type BuilderMode = 'build' | 'code' | 'preview' | 'pdf';

/** Active tab inside the edit panel. */
export type EditTab = 'edit' | 'logic';

/** Full state + actions for the builder's UI chrome. */
export interface UIState {
  // --- Data ---
  /** Currently selected field ID (blue dashed border in canvas). */
  selectedFieldId: string | null;
  /** Selected child field ID within the selected parent field editor. */
  selectedFieldChildId: string | null;
  /** Editor mode. */
  mode: BuilderMode;
  /** Active tab in the edit panel (only relevant when mode === 'build'). */
  editTab: EditTab;
  /** Whether the mobile edit bottom-sheet is open. */
  editModalOpen: boolean;
  /** True when the code editor has a parse/validation error — blocks mode switch. */
  codeEditorHasError: boolean;
  /** Field being dragged (source opacity feedback). */
  dragSourceId: string | null;
  /** Source drag state for opacity feedback. */
  dragSourceState: 'pressed' | 'dragging' | null;
  /** Field highlighted as combine/drop target. */
  dragTargetId: string | null;
  /** Section ancestor highlighted when dragging over a child. */
  dragHighlightedSectionId: string | null;
  /** The pages field id that is currently active in the canvas (set by Canvas). */
  activePagesId: string | null;

  // --- Actions ---
  selectField: (fieldId: string | null) => void;
  selectFieldChild: (parentId: string | null, childId: string | null) => void;
  setMode: (mode: BuilderMode) => void;
  setEditTab: (tab: EditTab) => void;
  setEditModalOpen: (open: boolean) => void;
  setCodeEditorHasError: (hasError: boolean) => void;
  setDragSource: (sourceId: string, state: 'pressed' | 'dragging') => void;
  setDragTarget: (targetId: string | null) => void;
  setDragHighlightedSection: (sectionId: string | null) => void;
  clearDragState: () => void;
  setActivePagesId: (id: string | null) => void;
}

/** Store handle returned by `createUIStore`. */
export type UIStore = ReturnType<typeof createUIStore>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createUIStore() {
  return createStore<UIState>((set) => ({
    selectedFieldId: null,
    selectedFieldChildId: null,
    mode: 'build',
    editTab: 'edit',
    editModalOpen: false,
    codeEditorHasError: false,
    dragSourceId: null,
    dragSourceState: null,
    dragTargetId: null,
    dragHighlightedSectionId: null,
    activePagesId: null,

    selectField: (fieldId) =>
      set((state) => ({
        selectedFieldId: fieldId,
        selectedFieldChildId: null,
        editTab: state.editTab,
      })),

    selectFieldChild: (parentId, childId) =>
      set((state) => ({
        selectedFieldId: parentId,
        selectedFieldChildId: childId,
        editTab: state.editTab,
      })),

    setMode: (mode) => set({ mode }),

    setEditTab: (tab) => set({ editTab: tab }),

    setEditModalOpen: (open) => set({ editModalOpen: open }),

    setCodeEditorHasError: (hasError) => set({ codeEditorHasError: hasError }),

    setDragSource: (sourceId, state) =>
      set({ dragSourceId: sourceId, dragSourceState: state }),

    setDragTarget: (targetId) => set({ dragTargetId: targetId }),

    setDragHighlightedSection: (sectionId) =>
      set({ dragHighlightedSectionId: sectionId }),

    clearDragState: () =>
      set({
        dragSourceId: null,
        dragSourceState: null,
        dragTargetId: null,
        dragHighlightedSectionId: null,
      }),

    setActivePagesId: (id) => set({ activePagesId: id }),
  }));
}
