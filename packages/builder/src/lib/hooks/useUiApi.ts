import React from 'react';
import { useStore } from 'zustand';
import type { BuilderMode, EditTab, UIStore } from '@esheet/core';
import { useUI } from '@esheet/fields';

export interface UiApi {
  mode: BuilderMode;
  selectedFieldId: string | null;
  selectedFieldChildId: string | null;
  editTab: EditTab;
  codeEditorHasError: boolean;
  selectField: (id: string | null) => void;
  selectFieldChild: (parentId: string, childId: string | null) => void;
  setMode: (m: BuilderMode) => void;
  setEditTab: (tab: EditTab) => void;
  setEditModalOpen: (open: boolean) => void;
  clearDragState: () => void;
  _ui: UIStore;
}

/**
 * useUiApi — lightweight hook for components that only need UI state/actions.
 *
 * Useful when you don't need field-scoped state. Requires UIContext provider.
 */
export function useUiApi(): UiApi {
  const ui = useUI();

  const mode = useStore(ui, (s) => s.mode);
  const selectedFieldId = useStore(ui, (s) => s.selectedFieldId);
  const selectedFieldChildId = useStore(ui, (s) => s.selectedFieldChildId);
  const editTab = useStore(ui, (s) => s.editTab);
  const codeEditorHasError = useStore(ui, (s) => s.codeEditorHasError);

  return React.useMemo(
    () => ({
      mode,
      selectedFieldId,
      selectedFieldChildId,
      editTab,
      codeEditorHasError,
      selectField: (id) => ui.getState().selectField(id),
      selectFieldChild: (parentId, childId) =>
        ui.getState().selectFieldChild(parentId, childId as string),
      setMode: (m) => ui.getState().setMode(m),
      setEditTab: (tab) => ui.getState().setEditTab(tab),
      setEditModalOpen: (open) => ui.getState().setEditModalOpen(open),
      clearDragState: () => ui.getState().clearDragState(),
      _ui: ui,
    }),
    [mode, selectedFieldId, selectedFieldChildId, editTab, codeEditorHasError, ui],
  );
}
