import React, { useSyncExternalStore } from 'react';
import {
  getFieldTypeMeta,
  type FieldDefinition,
  type FormStore,
  type UIStore,
  type EditTab,
} from '@msheet/core';
import { useInstanceId } from '../../MsheetBuilder.js';
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
 * Shows Edit tab (common + per-type editors) and Logic tab (placeholder for now).
 * Renders nothing meaningful when no field is selected.
 */
export function EditPanel({ form, ui }: EditPanelProps) {
  // Subscribe to UI state for selected field + active tab
  const selectedFieldId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId,
  );

  const editTab = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().editTab,
    () => ui.getState().editTab,
  );

  // Subscribe to form so we re-render when the field definition changes
  const field = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => (selectedFieldId ? form.getState().getField(selectedFieldId) : undefined),
    () => (selectedFieldId ? form.getState().getField(selectedFieldId) : undefined),
  );

  // No selection
  if (!selectedFieldId || !field) {
    return (
      <div className="edit-panel-empty ms:flex ms:flex-1 ms:min-h-0 ms:items-center ms:justify-center ms:text-mstextmuted ms:text-sm ms:p-4 ms:text-center">
        Select a field to edit its properties
      </div>
    );
  }

  const def = field.definition;
  const meta = getFieldTypeMeta(def.fieldType);

  const handleUpdate = (patch: Partial<Omit<import('@msheet/core').FieldDefinition, 'fields'>>) => {
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
    <div className="edit-panel ms:flex ms:flex-1 ms:flex-col ms:min-h-0">
      {/* Tab Bar — pill segment style */}
      <div className="edit-panel-tabs ms:sticky ms:top-0 ms:z-10 ms:bg-mssurface ms:border-b ms:border-msborder ms:px-3 ms:pt-3 ms:pb-2 ms:shrink-0">
        <div className="ms:flex ms:gap-1 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-1">
          <button
            type="button"
            onClick={() => setTab('edit')}
            className={`edit-tab-btn ms:flex-1 ms:flex ms:items-center ms:justify-center ms:gap-1.5 ms:px-3 ms:py-1.5 ms:rounded-md ms:text-xs ms:font-medium ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ${
              editTab === 'edit'
                ? 'ms:bg-msprimary ms:text-mstextsecondary ms:shadow-sm'
                : 'ms:bg-transparent ms:text-mstextmuted ms:hover:text-mstext ms:hover:bg-mssurface'
            }`}
          >
            <EditIcon className="ms:w-3.5 ms:h-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('logic')}
            className={`logic-tab-btn ms:flex-1 ms:flex ms:items-center ms:justify-center ms:gap-1.5 ms:px-3 ms:py-1.5 ms:rounded-md ms:text-xs ms:font-medium ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ${
              editTab === 'logic'
                ? 'ms:bg-msprimary ms:text-mstextsecondary ms:shadow-sm'
                : 'ms:bg-transparent ms:text-mstextmuted ms:hover:text-mstext ms:hover:bg-mssurface'
            }`}
          >
            <LogicIcon className="ms:w-3.5 ms:h-3.5" />
            <span>Logic</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="edit-panel-content ms:flex-1 ms:min-h-0 ms:p-4">
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
        ) : (
          <LogicEditor
            fieldId={selectedFieldId}
            rules={def.rules ?? []}
            form={form}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Tab — renders common + per-type editors
// ---------------------------------------------------------------------------

interface EditTabContentProps {
  fieldId: string;
  def: Omit<import('@msheet/core').FieldDefinition, 'fields'>;
  meta: import('@msheet/core').FieldTypeMeta | undefined;
  form: FormStore;
  ui: UIStore;
  onUpdate: (patch: Partial<Omit<import('@msheet/core').FieldDefinition, 'fields'>>) => void;
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
    <div className="edit-tab ms:space-y-4">
      {/* Common: ID, Question, Required, InputType */}
      <CommonEditor fieldId={fieldId} def={def} onUpdate={onUpdate} onRenameId={onRenameId} />

      {/* Divider */}
      {(meta?.hasOptions || meta?.hasMatrix) && (
        <hr className="ms:border-msborder" />
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
  def: Omit<import('@msheet/core').FieldDefinition, 'fields'>;
  form: FormStore;
  ui: UIStore;
  onUpdate: (patch: Partial<Omit<import('@msheet/core').FieldDefinition, 'fields'>>) => void;
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
    () => form.getState().normalized,
  );
  const selectedFieldId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId,
  );
  const selectedFieldChildId = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldChildId,
    () => ui.getState().selectedFieldChildId,
  );

  const childIds = normalized.byId[fieldId]?.childIds ?? [];
  const childFields = childIds
    .map((id) => normalized.byId[id])
    .filter((node): node is NonNullable<typeof normalized.byId[string]> =>
      Boolean(node),
    );

  const activeChildId =
    selectedFieldId === fieldId ? selectedFieldChildId : null;
  const resolvedActiveChildId = childFields.some(
    (node) => node.definition.id === activeChildId,
  )
    ? activeChildId
    : childFields[0]?.definition.id ?? null;
  const activeChildNode = childFields.find(
    (node) => node.definition.id === resolvedActiveChildId,
  );
  const activeChildDef = activeChildNode?.definition;
  const activeChildMeta = activeChildDef
    ? getFieldTypeMeta(activeChildDef.fieldType)
    : undefined;

  React.useEffect(() => {
    if (resolvedActiveChildId !== activeChildId) {
      ui.getState().selectFieldChild(fieldId, resolvedActiveChildId);
    }
  }, [activeChildId, fieldId, resolvedActiveChildId, ui]);

  const handleSelectChild = (childId: string) => {
    ui.getState().selectFieldChild(fieldId, childId);
  };

  const handleRenameChildId = (newId: string): boolean => {
    if (!activeChildDef) return false;
    const success = form.getState().updateField(activeChildDef.id, { id: newId });
    if (success) {
      ui.getState().selectFieldChild(fieldId, newId);
    }
    return success;
  };

  const handleUpdateChild = (
    patch: Partial<Omit<FieldDefinition, 'fields'>>,
  ) => {
    if (!activeChildDef) return;
    form.getState().updateField(activeChildDef.id, patch);
  };

  const handleDeleteChild = () => {
    if (!activeChildDef) return;
    form.getState().removeField(activeChildDef.id);
    const nextChildId = childFields.find(
      (node) => node.definition.id !== activeChildDef.id,
    )?.definition.id;
    ui.getState().selectFieldChild(fieldId, nextChildId ?? null);
  };

  return (
    <div className="section-editor ms:space-y-3">
      {/* Section ID */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-id-${fieldId}`}
          className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
        >
          Section ID
        </label>
        <DraftIdEditor id={def.id} fieldId={fieldId} onCommit={onRenameId} />
      </div>

      {/* Section Title */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-title-${fieldId}`}
          className="edit-label ms:block ms:text-sm ms:text-mstext ms:mb-1"
        >
          Section Title
        </label>
        <input
          id={`${instanceId}-editor-title-${fieldId}`}
          type="text"
          value={def.title ?? ''}
          onChange={(e) => onUpdate({ title: e.currentTarget.value })}
          placeholder="Enter section title..."
          className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
        />
      </div>

      <div className="ms:space-y-2">
        <div className="ms:flex ms:items-center ms:justify-between ms:gap-2">
          <span className="ms:text-sm ms:font-medium ms:text-mstext">
            Section Fields
          </span>
          <span className="ms:text-xs ms:text-mstextmuted">
            {childFields.length} item{childFields.length === 1 ? '' : 's'}
          </span>
        </div>

        {childFields.length === 0 ? (
          <div className="ms:text-sm ms:text-mstextmuted ms:px-3 ms:py-2 ms:bg-msbackground ms:border ms:border-msborder ms:rounded">
            No fields in this section yet.
          </div>
        ) : (
          <select
            id={`${instanceId}-editor-section-child-${fieldId}`}
            aria-label="Section child field selector"
            className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:cursor-pointer"
            value={resolvedActiveChildId ?? ''}
            onChange={(e) => handleSelectChild(e.currentTarget.value)}
          >
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
        <div className="ms:space-y-4 ms:p-4 ms:bg-msbackground ms:border ms:border-msborder ms:rounded-lg">
          <div className="ms:flex ms:items-center ms:justify-between ms:gap-2">
            <span className="ms:inline-flex ms:items-center ms:px-2.5 ms:py-0.5 ms:rounded-full ms:text-xs ms:font-medium ms:bg-msprimary/10 ms:text-msprimary">
              {activeChildMeta?.label || activeChildDef.fieldType}
            </span>
            <button
              type="button"
              onClick={handleDeleteChild}
              className="ms:flex ms:items-center ms:gap-1.5 ms:px-3 ms:py-1.5 ms:text-xs ms:font-medium ms:bg-mssurface ms:text-msdanger ms:hover:text-msdanger ms:hover:bg-msdanger/10 ms:border ms:border-msdanger/50 ms:rounded ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer"
              title="Delete this field"
            >
              <span className="ms:font-bold">×</span>
              Delete
            </button>
          </div>

          {activeChildDef.fieldType === 'section' ? (
            <div className="ms:space-y-3">
              <div>
                <label
                  htmlFor={`${instanceId}-editor-active-section-id-${activeChildDef.id}`}
                  className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
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
                  className="edit-label ms:block ms:text-sm ms:text-mstext ms:mb-1"
                >
                  Section Title
                </label>
                <input
                  id={`${instanceId}-editor-active-section-title-${activeChildDef.id}`}
                  type="text"
                  value={activeChildDef.title ?? ''}
                  onChange={(e) => handleUpdateChild({ title: e.currentTarget.value })}
                  placeholder="Enter section title..."
                  className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
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
            <hr className="ms:border-msborder" />
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


