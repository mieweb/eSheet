import React from 'react';
import { useStore } from 'zustand';
import type {
  AddFieldOptions,
  FieldDefinition,
  FieldNode,
  FieldResponse,
  FieldType,
  FormStore,
  NormalizedDefinition,
} from '@esheet/core';
import { useFormStore } from '@esheet/fields';

export type FieldResponseMap = Record<string, FieldResponse>;

export interface FormApi {
  field: FieldNode | undefined;
  response: FieldResponse | undefined;
  isVisible: boolean;
  isEnabled: boolean;
  isRequired: boolean;
  isReadOnly: boolean;
  isSoftRequired: boolean;
  normalized: NormalizedDefinition;
  responses: FieldResponseMap;
  instanceId: string;
  form: {
    addField: (type: FieldType, opts?: AddFieldOptions) => string | null;
    loadDefinition: FormStore['getState'] extends () => infer S
      ? S extends { loadDefinition: infer F }
        ? F
        : never
      : never;
    setFormId: (id: string) => void;
    hydrateDefinition: () => ReturnType<
      ReturnType<FormStore['getState']>['hydrateDefinition']
    >;
    hydrateResponse: () => ReturnType<
      ReturnType<FormStore['getState']>['hydrateResponse']
    >;
    resetResponses: () => void;
  };
  field_: {
    update: (patch: Partial<Omit<FieldDefinition, 'fields'>>) => boolean;
    remove: () => boolean;
    move: (toIndex: number, toParentId?: string | null) => boolean;
    setResponse: (resp: FieldResponse) => void;
    clearResponse: () => void;
  };
  option: {
    add: (value?: string) => string | null;
    update: (optId: string, value: string) => boolean;
    setScore: (optId: string, score: number | undefined) => boolean;
    remove: (optId: string) => boolean;
  };
  row: {
    add: (value?: string) => string | null;
    update: (rowId: string, value: string) => boolean;
    remove: (rowId: string) => boolean;
  };
  column: {
    add: (value?: string) => string | null;
    update: (colId: string, value: string) => boolean;
    setScore: (colId: string, score: number | undefined) => boolean;
    remove: (colId: string) => boolean;
  };
  _form: FormStore;
}

/**
 * useFormApi — reactive field state + form store actions.
 *
 * Touches only the FormStore. For UI state (mode, selection, tabs) use
 * useUiApi(). For the computed visible root IDs use useVisibleRootIds().
 *
 * @param fieldId - The field to bind to. Pass undefined for form-level ops only.
 */
export function useFormApi(fieldId?: string): FormApi {
  const form = useFormStore();

  // --- Reactive field state ---
  const field = useStore(form, (s) =>
    fieldId ? s.getField(fieldId) : undefined
  );
  const response = useStore(form, (s) =>
    fieldId ? s.getResponse(fieldId) : undefined
  );
  const isVisible = useStore(form, (s) =>
    fieldId ? s.isVisible(fieldId) : true
  );
  const isEnabled = useStore(form, (s) =>
    fieldId ? s.isEnabled(fieldId) : true
  );
  const isRequired = useStore(form, (s) =>
    fieldId ? s.isRequired(fieldId) : false
  );
  const isReadOnly = useStore(form, (s) =>
    fieldId ? s.isReadOnly(fieldId) : false
  );
  const isSoftRequired = useStore(form, (s) =>
    fieldId ? s.isSoftRequired(fieldId) : false
  );

  // --- Reactive form-level state ---
  const normalized = useStore(form, (s) => s.normalized);
  const responses = useStore(form, (s) => s.responses);
  const instanceId = useStore(form, (s) => s.instanceId);

  return React.useMemo(
    () => ({
      field,
      response,
      isVisible,
      isEnabled,
      isRequired,
      isReadOnly,
      isSoftRequired,
      normalized,
      responses,
      instanceId,

      form: {
        addField: (type: FieldType, opts?: AddFieldOptions) =>
          form.getState().addField(type, opts),
        loadDefinition: form.getState().loadDefinition,
        setFormId: form.getState().setFormId,
        hydrateDefinition: () => form.getState().hydrateDefinition(),
        hydrateResponse: () => form.getState().hydrateResponse(),
        resetResponses: () => form.getState().resetResponses(),
      },

      field_: {
        update: (patch: Partial<Omit<FieldDefinition, 'fields'>>) =>
          fieldId ? form.getState().updateField(fieldId, patch) : false,
        remove: () => (fieldId ? form.getState().removeField(fieldId) : false),
        move: (toIndex: number, toParentId?: string | null) =>
          fieldId
            ? form.getState().moveField(fieldId, toIndex, toParentId)
            : false,
        setResponse: (resp: FieldResponse) =>
          fieldId ? form.getState().setResponse(fieldId, resp) : undefined,
        clearResponse: () =>
          fieldId ? form.getState().clearResponse(fieldId) : undefined,
      },

      option: {
        add: (value?: string) =>
          fieldId ? form.getState().addOption(fieldId, value) : null,
        update: (optId: string, value: string) =>
          fieldId ? form.getState().updateOption(fieldId, optId, value) : false,
        setScore: (optId: string, score: number | undefined) =>
          fieldId
            ? form.getState().setOptionScore(fieldId, optId, score)
            : false,
        remove: (optId: string) =>
          fieldId ? form.getState().removeOption(fieldId, optId) : false,
      },

      row: {
        add: (value?: string) =>
          fieldId ? form.getState().addRow(fieldId, value) : null,
        update: (rowId: string, value: string) =>
          fieldId ? form.getState().updateRow(fieldId, rowId, value) : false,
        remove: (rowId: string) =>
          fieldId ? form.getState().removeRow(fieldId, rowId) : false,
      },

      column: {
        add: (value?: string) =>
          fieldId ? form.getState().addColumn(fieldId, value) : null,
        update: (colId: string, value: string) =>
          fieldId ? form.getState().updateColumn(fieldId, colId, value) : false,
        setScore: (colId: string, score: number | undefined) =>
          fieldId
            ? form.getState().setColumnScore(fieldId, colId, score)
            : false,
        remove: (colId: string) =>
          fieldId ? form.getState().removeColumn(fieldId, colId) : false,
      },

      _form: form,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      fieldId,
      field,
      response,
      isVisible,
      isEnabled,
      isRequired,
      isReadOnly,
      isSoftRequired,
      normalized,
      responses,
      instanceId,
      form,
    ]
  );
}
