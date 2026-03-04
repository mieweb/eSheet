import { useSyncExternalStore } from 'react';
import { getFieldTypeMeta, type FormStore } from '@msheet/core';
import type { UIStore, EditTab } from '../../ui-store.js';
import { useInstanceId } from '../../MsheetBuilder.js';
import { DraftIdEditor } from './DraftIdEditor.js';
import { CommonEditor } from './CommonEditor.js';
import { OptionListEditor } from './OptionListEditor.js';
import { MatrixEditor } from './MatrixEditor.js';

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
      <div className="edit-panel-empty ms:flex ms:items-center ms:justify-center ms:h-full ms:text-mstextmuted ms:text-sm ms:p-4 ms:text-center">
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
    <div className="edit-panel ms:flex ms:flex-col ms:h-full">
      {/* Tab Bar */}
      <div className="edit-panel-tabs ms:flex ms:border-b ms:border-msborder ms:shrink-0">
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={`edit-tab-btn ms:flex-1 ms:py-2 ms:text-sm ms:font-medium ms:bg-transparent ms:border-0 ms:outline-none focus:ms:outline-none ms:transition-colors ms:cursor-pointer ${
            editTab === 'edit'
              ? 'ms:text-msprimary ms:border-b-2 ms:border-msprimary'
              : 'ms:text-mstextmuted ms:hover:text-mstext'
          }`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setTab('logic')}
          className={`logic-tab-btn ms:flex-1 ms:py-2 ms:text-sm ms:font-medium ms:bg-transparent ms:border-0 ms:outline-none focus:ms:outline-none ms:transition-colors ms:cursor-pointer ${
            editTab === 'logic'
              ? 'ms:text-msprimary ms:border-b-2 ms:border-msprimary'
              : 'ms:text-mstextmuted ms:hover:text-mstext'
          }`}
        >
          Logic
        </button>
      </div>

      {/* Tab Content */}
      <div className="edit-panel-content ms:flex-1 ms:overflow-y-auto ms:p-4">
        {editTab === 'edit' ? (
          <EditTabContent
            fieldId={selectedFieldId}
            def={def}
            meta={meta}
            form={form}
            onUpdate={handleUpdate}
            onRenameId={handleRenameId}
          />
        ) : (
          <LogicTabPlaceholder />
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
  onUpdate: (patch: Partial<Omit<import('@msheet/core').FieldDefinition, 'fields'>>) => void;
  onRenameId: (newId: string) => boolean;
}

function EditTabContent({ fieldId, def, meta, form, onUpdate, onRenameId }: EditTabContentProps) {
  const isSection = def.fieldType === 'section';

  if (isSection) {
    return <SectionEditContent fieldId={fieldId} def={def} onUpdate={onUpdate} onRenameId={onRenameId} />;
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
  onUpdate: (patch: Partial<Omit<import('@msheet/core').FieldDefinition, 'fields'>>) => void;
  onRenameId: (newId: string) => boolean;
}

function SectionEditContent({ fieldId, def, onUpdate, onRenameId }: SectionEditContentProps) {
  const instanceId = useInstanceId();

  return (
    <div className="section-editor ms:space-y-3">
      {/* Section ID */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-id-${fieldId}`}
          className="edit-label ms:block ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Section ID
        </label>
        <DraftIdEditor id={def.id} fieldId={fieldId} onCommit={onRenameId} />
      </div>

      {/* Section Title */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-title-${fieldId}`}
          className="edit-label ms:block ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Section Title
        </label>
        <input
          id={`${instanceId}-editor-title-${fieldId}`}
          type="text"
          value={def.title ?? ''}
          onChange={(e) => onUpdate({ title: e.currentTarget.value })}
          placeholder="Enter section title..."
          className="ms:w-full ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-transparent ms:border ms:border-msborder ms:rounded ms:text-mstext placeholder:ms:text-mstextmuted focus:ms:outline-none focus:ms:ring-2 focus:ms:ring-msprimary focus:ms:border-msprimary"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logic tab placeholder
// ---------------------------------------------------------------------------

function LogicTabPlaceholder() {
  return (
    <div className="logic-placeholder ms:text-sm ms:text-mstextmuted ms:text-center ms:py-8">
      <div className="ms:mb-2">
        <svg className="ms:w-8 ms:h-8 ms:mx-auto ms:text-mstextmuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      </div>
      Conditional logic editor coming soon.
      <div className="ms:text-xs ms:mt-1">Rules: visible, enable, required</div>
    </div>
  );
}
