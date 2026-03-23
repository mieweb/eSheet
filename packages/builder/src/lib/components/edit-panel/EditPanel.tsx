import React, { useSyncExternalStore } from 'react';
import {
  getFieldTypeMeta,
  type FieldDefinition,
  type FormStore,
  type UIStore,
  type EditTab,
} from '@esheet/core';
import { useInstanceId } from '../../EsheetBuilder.js';
import { EditIcon, LogicIcon } from '../../icons.js';
import { DraftIdEditor } from './DraftIdEditor.js';
import { CommonEditor } from './CommonEditor.js';
import { OptionListEditor } from './OptionListEditor.js';
import { MatrixEditor } from './MatrixEditor.js';
import { LogicEditor } from './LogicEditor.js';

export interface EditPanelProps {
  form: FormStore;
  ui: UIStore;
}

/**
 * EditPanel — right panel for editing the selected field's properties.
 *
 * Shows Edit tab (common + per-type editors) and Logic tab.
 * Renders nothing meaningful when no field is selected.
 */
export function EditPanel({ form, ui }: EditPanelProps) {
  // Subscribe to UI state for selected field + active tab
  const selectedFieldId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId
  );
  const selectedFieldChildId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldChildId,
    () => ui.getState().selectedFieldChildId
  );
  const editTab = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().editTab,
    () => ui.getState().editTab
  );

  // Subscribe to form so we re-render when the field definition changes
  const field = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () =>
      selectedFieldId ? form.getState().getField(selectedFieldId) : undefined,
    () =>
      selectedFieldId ? form.getState().getField(selectedFieldId) : undefined
  );

  // Logic tab target: when a section is selected, edit logic for the active child.
  const logicField = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => {
      if (!selectedFieldId) return undefined;
      const parent = form.getState().getField(selectedFieldId);
      if (!parent) return undefined;

      if (parent.definition.fieldType !== 'section' || !selectedFieldChildId) {
        return parent;
      }

      return form.getState().getField(selectedFieldChildId) ?? parent;
    },
    () => {
      if (!selectedFieldId) return undefined;
      return form.getState().getField(selectedFieldId);
    }
  );

  // No selection
  if (!selectedFieldId || !field) {
    return (
      <div className="edit-panel-empty es:flex es:flex-1 es:min-h-0 es:items-center es:justify-center es:text-estextmuted es:text-sm es:p-4 es:text-center">
        Select a field to edit its properties
      </div>
    );
  }

  const def = field.definition;
  const meta = getFieldTypeMeta(def.fieldType);
  const logicTargetLabel = logicField
    ? logicField.definition.fieldType === 'section'
      ? logicField.definition.title || logicField.definition.id
      : logicField.definition.question || logicField.definition.id
    : '';
  const logicTargetQuestion = logicField
    ? logicField.definition.fieldType === 'section'
      ? logicField.definition.title || ''
      : logicField.definition.question || ''
    : '';
  const logicTargetQuestionShort = logicTargetQuestion
    ? logicTargetQuestion.length > 18
      ? `${logicTargetQuestion.slice(0, 18)}...`
      : logicTargetQuestion
    : logicTargetLabel;
  const handleUpdate = (
    patch: Partial<Omit<import('@esheet/core').FieldDefinition, 'fields'>>
  ) => {
    form.getState().updateField(selectedFieldId, patch);
  };

  const handleRenameId = (newId: string): boolean => {
    const success = form.getState().updateField(selectedFieldId, { id: newId });
    if (success) {
      ui.getState().selectField(newId);
    }
    return success;
  };

  const setTab = (tab: EditTab) => ui.getState().setEditTab(tab);

  return (
    <div className="edit-panel es:flex es:flex-1 es:flex-col es:min-h-0">
      {/* Tab Bar — pill segment style */}
      <div className="edit-panel-tabs es:sticky es:top-0 es:z-10 es:bg-essurface es:border-b es:border-esborder es:px-3 es:pt-3 es:pb-2 es:shrink-0">
        <div className="es:flex es:gap-1 es:rounded-lg es:border es:border-esborder es:bg-esbackground es:p-1">
          <button
            type="button"
            onClick={() => setTab('edit')}
            className={`edit-tab-btn es:flex-1 es:flex es:items-center es:justify-center es:gap-1.5 es:px-3 es:py-1.5 es:rounded-md es:text-xs es:font-medium es:transition-colors es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer ${
              editTab === 'edit'
                ? 'es:bg-esprimary es:text-estextsecondary es:shadow-sm'
                : 'es:bg-transparent es:text-estextmuted es:hover:text-estext es:hover:bg-essurface'
            }`}
          >
            <EditIcon className="es:w-3.5 es:h-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('logic')}
            className={`logic-tab-btn es:flex-1 es:flex es:items-center es:justify-center es:gap-1.5 es:px-3 es:py-1.5 es:rounded-md es:text-xs es:font-medium es:transition-colors es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer ${
              editTab === 'logic'
                ? 'es:bg-esprimary es:text-estextsecondary es:shadow-sm'
                : 'es:bg-transparent es:text-estextmuted es:hover:text-estext es:hover:bg-essurface'
            }`}
          >
            <LogicIcon className="es:w-3.5 es:h-3.5" />
            <span>Logic</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="edit-panel-content es:flex-1 es:min-h-0 es:p-4">
        {editTab === 'edit' ? (
          <EditTabContent
            fieldId={selectedFieldId}
            def={def}
            meta={meta}
            form={form}
            ui={ui}
            onUpdate={handleUpdate}
            onRenameId={handleRenameId}
          />
        ) : logicField ? (
          <div className="es:space-y-2">
            <div className="es:flex es:flex-wrap es:items-center es:gap-1.5 es:text-xs es:text-estextmuted es:bg-esbackground es:border es:border-esborder es:rounded es:px-2.5 es:py-1.5">
              <span className="es:inline-block es:text-xs es:font-medium es:text-esprimary es:bg-esprimary/10 es:px-2 es:py-0.5 es:rounded es:shrink-0">
                {logicField.definition.fieldType}
              </span>
              <span className="es:px-1.5 es:py-0.5 es:rounded es:bg-essurface es:border es:border-esborder es:text-estext es:font-medium">
                {logicTargetQuestionShort}
              </span>
            </div>
            <LogicEditor
              fieldId={logicField.definition.id}
              rules={logicField.definition.rules ?? []}
              form={form}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Tab — renders common + per-type editors
// ---------------------------------------------------------------------------

interface EditTabContentProps {
  fieldId: string;
  def: Omit<import('@esheet/core').FieldDefinition, 'fields'>;
  meta: import('@esheet/core').FieldTypeMeta | undefined;
  form: FormStore;
  ui: UIStore;
  onUpdate: (
    patch: Partial<Omit<import('@esheet/core').FieldDefinition, 'fields'>>
  ) => void;
  onRenameId: (newId: string) => boolean;
}

function EditTabContent({
  fieldId,
  def,
  meta,
  form,
  ui,
  onUpdate,
  onRenameId,
}: EditTabContentProps) {
  const isSection = def.fieldType === 'section';

  if (isSection) {
    return (
      <SectionEditContent
        fieldId={fieldId}
        def={def}
        form={form}
        ui={ui}
        onUpdate={onUpdate}
        onRenameId={onRenameId}
      />
    );
  }

  return (
    <div className="edit-tab es:space-y-4">
      {/* Common: ID, Question, Required, InputType */}
      <CommonEditor
        fieldId={fieldId}
        def={def}
        onUpdate={onUpdate}
        onRenameId={onRenameId}
      />

      {/* Divider */}
      {(meta?.hasOptions || meta?.hasMatrix) && (
        <hr className="es:border-esborder" />
      )}

      {/* Options (radio, check, dropdown, multitext, rating, ranking, slider, boolean) */}
      {meta?.hasOptions && def.options && (
        <OptionListEditor
          fieldId={fieldId}
          fieldType={def.fieldType}
          options={def.options}
          form={form}
        />
      )}

      {/* Matrix (singlematrix, multimatrix) */}
      {meta?.hasMatrix && (
        <MatrixEditor
          fieldId={fieldId}
          rows={def.rows ?? []}
          columns={def.columns ?? []}
          form={form}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section editor (simplified — title + ID, no child navigation yet)
// ---------------------------------------------------------------------------

interface SectionEditContentProps {
  fieldId: string;
  def: Omit<import('@esheet/core').FieldDefinition, 'fields'>;
  form: FormStore;
  ui: UIStore;
  onUpdate: (
    patch: Partial<Omit<import('@esheet/core').FieldDefinition, 'fields'>>
  ) => void;
  onRenameId: (newId: string) => boolean;
}

function SectionEditContent({
  fieldId,
  def,
  form,
  ui,
  onUpdate,
  onRenameId,
}: SectionEditContentProps) {
  const instanceId = useInstanceId();
  const normalized = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().normalized,
    () => form.getState().normalized
  );
  const selectedFieldId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId
  );
  const selectedFieldChildId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldChildId,
    () => ui.getState().selectedFieldChildId
  );
  const editTab = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().editTab,
    () => ui.getState().editTab
  );

  const childIds = normalized.byId[fieldId]?.childIds ?? [];
  const childFields = childIds
    .map((id) => normalized.byId[id])
    .filter((node): node is NonNullable<(typeof normalized.byId)[string]> =>
      Boolean(node)
    );

  const activeChildId =
    selectedFieldId === fieldId ? selectedFieldChildId : null;
  const hasActiveChild =
    activeChildId !== null &&
    childFields.some((node) => node.definition.id === activeChildId);
  const resolvedActiveChildId = hasActiveChild ? activeChildId : null;
  const activeChildNode = childFields.find(
    (node) => node.definition.id === resolvedActiveChildId
  );
  const activeChildDef = activeChildNode?.definition;
  const activeChildMeta = activeChildDef
    ? getFieldTypeMeta(activeChildDef.fieldType)
    : undefined;

  React.useEffect(() => {
    // Only heal stale non-null child IDs (e.g. deleted child). Do not auto-pick
    // a new child when none is selected so section-level selection can persist.
    if (activeChildId !== null && resolvedActiveChildId !== activeChildId) {
      ui.getState().selectFieldChild(fieldId, resolvedActiveChildId);
      if (editTab === 'logic') {
        ui.getState().setEditTab('logic');
      }
    }
  }, [activeChildId, editTab, fieldId, resolvedActiveChildId, ui]);

  const handleSelectChild = (childId: string) => {
    ui.getState().selectFieldChild(fieldId, childId);
    if (editTab === 'logic') {
      ui.getState().setEditTab('logic');
    }
  };

  const handleRenameChildId = (newId: string): boolean => {
    if (!activeChildDef) return false;
    const success = form
      .getState()
      .updateField(activeChildDef.id, { id: newId });
    if (success) {
      ui.getState().selectFieldChild(fieldId, newId);
    }
    return success;
  };

  const handleUpdateChild = (
    patch: Partial<Omit<FieldDefinition, 'fields'>>
  ) => {
    if (!activeChildDef) return;
    form.getState().updateField(activeChildDef.id, patch);
  };

  const handleDeleteChild = () => {
    if (!activeChildDef) return;
    form.getState().removeField(activeChildDef.id);
    const nextChildId = childFields.find(
      (node) => node.definition.id !== activeChildDef.id
    )?.definition.id;
    ui.getState().selectFieldChild(fieldId, nextChildId ?? null);
  };

  return (
    <div className="section-editor es:space-y-3">
      {/* Section ID */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-id-${fieldId}`}
          className="edit-label es:block es:text-sm es:font-medium es:text-estext es:mb-1"
        >
          Section ID
        </label>
        <DraftIdEditor id={def.id} fieldId={fieldId} onCommit={onRenameId} />
      </div>

      {/* Section Title */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-title-${fieldId}`}
          className="edit-label es:block es:text-sm es:text-estext es:mb-1"
        >
          Section Title
        </label>
        <input
          id={`${instanceId}-editor-title-${fieldId}`}
          type="text"
          value={def.title ?? ''}
          onChange={(e) => onUpdate({ title: e.currentTarget.value })}
          placeholder="Enter section title..."
          className="es:w-full es:min-w-0 es:px-3 es:py-2 es:text-sm es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:placeholder:text-estextmuted es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:focus:border-esprimary es:transition-colors"
        />
      </div>

      <div className="es:space-y-2">
        <div className="es:flex es:items-center es:justify-between es:gap-2">
          <span className="es:text-sm es:font-medium es:text-estext">
            Section Fields
          </span>
          <span className="es:text-xs es:text-estextmuted">
            {childFields.length} item{childFields.length === 1 ? '' : 's'}
          </span>
        </div>

        {childFields.length === 0 ? (
          <div className="es:text-sm es:text-estextmuted es:px-3 es:py-2 es:bg-esbackground es:border es:border-esborder es:rounded">
            No fields in this section yet.
          </div>
        ) : (
          <select
            id={`${instanceId}-editor-section-child-${fieldId}`}
            aria-label="Section child field selector"
            className="es:w-full es:min-w-0 es:px-3 es:py-2 es:text-sm es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:focus:border-esprimary es:cursor-pointer"
            value={resolvedActiveChildId ?? ''}
            onChange={(e) => handleSelectChild(e.currentTarget.value)}
          >
            <option value="">Select a child field…</option>
            {childFields.map((node) => {
              const childMeta = getFieldTypeMeta(node.definition.fieldType);
              const label =
                node.definition.fieldType === 'section'
                  ? node.definition.title || node.definition.id
                  : node.definition.question || node.definition.id;
              return (
                <option key={node.definition.id} value={node.definition.id}>
                  {label} - {childMeta?.label || node.definition.fieldType}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {activeChildDef && (
        <div className="es:space-y-4 es:p-4 es:bg-esbackground es:border es:border-esborder es:rounded-lg">
          <div className="es:flex es:items-center es:justify-between es:gap-2">
            <span className="es:inline-flex es:items-center es:px-2.5 es:py-0.5 es:rounded-full es:text-xs es:font-medium es:bg-esprimary/10 es:text-esprimary">
              {activeChildMeta?.label || activeChildDef.fieldType}
            </span>
            <button
              type="button"
              onClick={handleDeleteChild}
              className="es:flex es:items-center es:gap-1.5 es:px-3 es:py-1.5 es:text-xs es:font-medium es:bg-essurface es:text-esdanger es:hover:text-esdanger es:hover:bg-esdanger/10 es:border es:border-esdanger/50 es:rounded es:transition-colors es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer"
              title="Delete this field"
            >
              <span className="es:font-bold">×</span>
              Delete
            </button>
          </div>

          {activeChildDef.fieldType === 'section' ? (
            <div className="es:space-y-3">
              <div>
                <label
                  htmlFor={`${instanceId}-editor-active-section-id-${activeChildDef.id}`}
                  className="edit-label es:block es:text-sm es:font-medium es:text-estext es:mb-1"
                >
                  Section ID
                </label>
                <DraftIdEditor
                  id={activeChildDef.id}
                  fieldId={activeChildDef.id}
                  onCommit={handleRenameChildId}
                />
              </div>
              <div>
                <label
                  htmlFor={`${instanceId}-editor-active-section-title-${activeChildDef.id}`}
                  className="edit-label es:block es:text-sm es:text-estext es:mb-1"
                >
                  Section Title
                </label>
                <input
                  id={`${instanceId}-editor-active-section-title-${activeChildDef.id}`}
                  type="text"
                  value={activeChildDef.title ?? ''}
                  onChange={(e) =>
                    handleUpdateChild({ title: e.currentTarget.value })
                  }
                  placeholder="Enter section title..."
                  className="es:w-full es:min-w-0 es:px-3 es:py-2 es:text-sm es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:placeholder:text-estextmuted es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:focus:border-esprimary es:transition-colors"
                />
              </div>
            </div>
          ) : (
            <CommonEditor
              fieldId={activeChildDef.id}
              def={activeChildDef}
              onUpdate={handleUpdateChild}
              onRenameId={handleRenameChildId}
            />
          )}

          {(activeChildMeta?.hasOptions || activeChildMeta?.hasMatrix) && (
            <hr className="es:border-esborder" />
          )}

          {activeChildMeta?.hasOptions && activeChildDef.options && (
            <OptionListEditor
              fieldId={activeChildDef.id}
              fieldType={activeChildDef.fieldType}
              options={activeChildDef.options}
              form={form}
            />
          )}

          {activeChildMeta?.hasMatrix && (
            <MatrixEditor
              fieldId={activeChildDef.id}
              rows={activeChildDef.rows ?? []}
              columns={activeChildDef.columns ?? []}
              form={form}
            />
          )}
        </div>
      )}
    </div>
  );
}
