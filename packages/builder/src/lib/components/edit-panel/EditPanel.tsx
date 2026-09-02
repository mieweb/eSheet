import React from 'react';
import {
  SECTION_ICON_GROUPS,
  getFieldTypeMeta,
  type FieldDefinition,
  type FieldWidth,
  type FieldOption,
  type MatrixColumn,
  type MatrixRow,
  type EditTab,
  type SectionFieldDefinition,
  type SectionIconName,
} from '@esheet/core';
import { useInstanceId } from '../../EsheetBuilder.js';
import { EditIcon, LogicIcon } from '../../icons.js';
import { DraftIdEditor } from './DraftIdEditor.js';
import { CommonEditor } from './CommonEditor.js';
import { OptionListEditor } from './OptionListEditor.js';
import { MatrixEditor } from './MatrixEditor.js';
import { LogicEditor } from './LogicEditor.js';
import { useFormApi } from '../../hooks/useFormApi.js';
import { useUiApi } from '../../hooks/useUiApi.js';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface EditPanelProps {}

/**
 * EditPanel — right panel for editing the selected field's properties.
 *
 * Shows Edit tab (common + per-type editors) and Logic tab.
 * Renders nothing meaningful when no field is selected.
 */
export function EditPanel(_props: EditPanelProps) {
  const {
    selectedFieldId,
    selectedFieldChildId,
    editTab,
    selectField,
    setEditTab,
  } = useUiApi();
  const { normalized } = useFormApi(undefined);

  // Bind field actions to the selected field
  const { field_: selectedField_ } = useFormApi(selectedFieldId ?? undefined);

  // Logic tab target: when a section is selected, edit logic for the active child.
  const logicField = React.useMemo(() => {
    if (!selectedFieldId) return undefined;
    const node = normalized.byId[selectedFieldId];
    if (!node) return undefined;
    if (node.definition.fieldType === 'section' && selectedFieldChildId) {
      return normalized.byId[selectedFieldChildId] ?? node;
    }
    return node;
  }, [normalized, selectedFieldId, selectedFieldChildId]);
  const { field_: logicField_ } = useFormApi(logicField?.definition.id);

  const activeField = selectedFieldId
    ? normalized.byId[selectedFieldId]
    : undefined;

  // No selection
  if (!selectedFieldId || !activeField) {
    return (
      <div className="edit-panel-empty ms:flex ms:flex-1 ms:min-h-0 ms:items-center ms:justify-center ms:text-mstextmuted ms:text-sm ms:p-4 ms:text-center">
        Select a field to edit its properties
      </div>
    );
  }

  const def = activeField.definition;
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
    selectedField_.update(patch);
  };
  const handleLogicUpdate = (
    patch: Partial<Omit<import('@esheet/core').FieldDefinition, 'fields'>>
  ) => {
    logicField_.update(patch);
  };

  const handleRenameId = (newId: string): boolean => {
    const success = selectedField_.update({ id: newId });
    if (success) {
      selectField(newId);
    }
    return success;
  };

  const setTab = (tab: EditTab) => setEditTab(tab);

  return (
    <div className="edit-panel ms:flex ms:flex-1 ms:flex-col ms:min-h-0">
      {/* Tab Bar — pill segment style */}
      <div className="edit-panel-tabs ms:sticky ms:top-0 ms:z-10 ms:bg-mssurface ms:border-b ms:border-msborder ms:px-4 ms:py-2.5 ms:shrink-0">
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
            onUpdate={handleUpdate}
            onRenameId={handleRenameId}
          />
        ) : logicField ? (
          <div className="ms:space-y-2">
            <div className="ms:flex ms:flex-wrap ms:items-center ms:gap-1.5 ms:text-xs ms:text-mstextmuted ms:bg-msbackground ms:border ms:border-msborder ms:rounded ms:px-2.5 ms:py-1.5">
              <span className="ms:inline-block ms:text-xs ms:font-medium ms:text-msprimary ms:bg-msprimary/10 ms:px-2 ms:py-0.5 ms:rounded ms:shrink-0">
                {logicField.definition.fieldType}
              </span>
              <span className="ms:px-1.5 ms:py-0.5 ms:rounded ms:bg-mssurface ms:border ms:border-msborder ms:text-mstext ms:font-medium">
                {logicTargetQuestionShort}
              </span>
            </div>
            <LogicEditor
              fieldId={logicField.definition.id}
              rules={logicField.definition.rules ?? []}
              def={{
                required: logicField.definition.required as
                  | boolean
                  | 'soft'
                  | undefined,
              }}
              onUpdateDef={handleLogicUpdate}
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
  onUpdate: (
    patch: Partial<Omit<import('@esheet/core').FieldDefinition, 'fields'>>
  ) => void;
  onRenameId: (newId: string) => boolean;
}

function EditTabContent({
  fieldId,
  def,
  meta,
  onUpdate,
  onRenameId,
}: EditTabContentProps) {
  const isSection = def.fieldType === 'section';

  if (isSection) {
    return (
      <SectionEditContent
        fieldId={fieldId}
        def={def}
        onUpdate={onUpdate}
        onRenameId={onRenameId}
      />
    );
  }

  return (
    <div className="edit-tab ms:space-y-4">
      {/* Common: ID, Question, Required, InputType */}
      <CommonEditor
        fieldId={fieldId}
        def={def}
        onUpdate={onUpdate}
        onRenameId={onRenameId}
      />

      {/* Divider */}
      {(meta?.hasOptions || meta?.hasMatrix) && (
        <hr className="ms:border-msborder" />
      )}

      {/* Options (radio, check, dropdown, multitext, rating, ranking, slider, boolean) */}
      {meta?.hasOptions && (def as { options?: FieldOption[] }).options && (
        <OptionListEditor
          fieldId={fieldId}
          fieldType={def.fieldType}
          options={(def as { options?: FieldOption[] }).options!}
        />
      )}

      {/* Matrix (singlematrix, multimatrix) */}
      {meta?.hasMatrix && (
        <MatrixEditor
          fieldId={fieldId}
          rows={(def as { rows?: MatrixRow[] }).rows ?? []}
          columns={(def as { columns?: MatrixColumn[] }).columns ?? []}
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
  onUpdate: (
    patch: Partial<Omit<import('@esheet/core').FieldDefinition, 'fields'>>
  ) => void;
  onRenameId: (newId: string) => boolean;
}

interface SectionWidthEditorProps {
  fieldId: string;
  width?: FieldWidth;
  onUpdate: (patch: Partial<Omit<FieldDefinition, 'fields'>>) => void;
  showOverride?: boolean;
  overrideSectionWidth?: boolean;
}

function SectionWidthEditor({
  fieldId,
  width,
  onUpdate,
  showOverride = false,
  overrideSectionWidth = false,
}: SectionWidthEditorProps) {
  const instanceId = useInstanceId();

  return (
    <div>
      <label
        htmlFor={`${instanceId}-editor-child-width-${fieldId}`}
        className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
      >
        Child row width
      </label>
      <select
        id={`${instanceId}-editor-child-width-${fieldId}`}
        value={width ?? 'none'}
        onChange={(e) =>
          onUpdate({ width: e.currentTarget.value as FieldWidth })
        }
        className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
      >
        <option value="none">None</option>
        <option value="full">Full (whole row)</option>
        <option value="half">Half (2 per row)</option>
        <option value="third">Third (3 per row)</option>
      </select>
      {showOverride && (
        <label
          htmlFor={`${instanceId}-editor-override-width-${fieldId}`}
          className="ms:mt-2 ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext ms:cursor-pointer"
        >
          <input
            id={`${instanceId}-editor-override-width-${fieldId}`}
            type="checkbox"
            checked={overrideSectionWidth}
            onChange={(e) =>
              onUpdate({
                overrideSectionWidth: e.currentTarget.checked || undefined,
              })
            }
            className="ms:h-4 ms:w-4 ms:accent-msprimary"
          />
          Override parent width
        </label>
      )}
    </div>
  );
}

function SectionEditContent({
  fieldId,
  def,
  onUpdate,
  onRenameId,
}: SectionEditContentProps) {
  const instanceId = useInstanceId();
  const sectionCollapse = (
    def as { sectionCollapse?: SectionFieldDefinition['sectionCollapse'] }
  ).sectionCollapse;
  const {
    selectedFieldId,
    selectedFieldChildId,
    editTab,
    selectFieldChild,
    setEditTab,
  } = useUiApi();
  const { normalized } = useFormApi();
  const { field_: activeChildField_ } = useFormApi(
    selectedFieldId === fieldId && selectedFieldChildId
      ? selectedFieldChildId
      : undefined
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
    if (activeChildId !== null && resolvedActiveChildId !== activeChildId) {
      selectFieldChild(fieldId, resolvedActiveChildId);
      if (editTab === 'logic') {
        setEditTab('logic');
      }
    }
  }, [
    activeChildId,
    editTab,
    fieldId,
    resolvedActiveChildId,
    selectFieldChild,
    setEditTab,
  ]);

  const handleSelectChild = (childId: string) => {
    selectFieldChild(fieldId, childId);
    if (editTab === 'logic') {
      setEditTab('logic');
    }
  };

  const handleRenameChildId = (newId: string): boolean => {
    if (!activeChildDef) return false;
    const success = activeChildField_.update({ id: newId });
    if (success) {
      selectFieldChild(fieldId, newId);
    }
    return success;
  };

  const handleUpdateChild = (
    patch: Partial<Omit<FieldDefinition, 'fields'>>
  ) => {
    if (!activeChildDef) return;
    activeChildField_.update(patch);
  };

  const handleDeleteChild = () => {
    if (!activeChildDef) return;
    activeChildField_.remove();
    const nextChildId = childFields.find(
      (node) => node.definition.id !== activeChildDef.id
    )?.definition.id;
    selectFieldChild(fieldId, nextChildId ?? null);
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
          value={(def as { title?: string }).title ?? ''}
          onChange={(e) =>
            onUpdate({ title: e.currentTarget.value } as Parameters<
              typeof onUpdate
            >[0])
          }
          placeholder="Enter section title..."
          className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
        />
      </div>

      {/* Collapse behavior */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-collapse-${fieldId}`}
          className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
        >
          Collapse behavior
        </label>
        <select
          id={`${instanceId}-editor-collapse-${fieldId}`}
          value={sectionCollapse}
          onChange={(e) => {
            const value = e.currentTarget.value;
            onUpdate({
              sectionCollapse: value,
            } as Parameters<typeof onUpdate>[0]);
          }}
          className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
        >
          <option value="collapsed">Collapsible (collapsed by default)</option>
          <option value="expanded">Collapsible (expanded by default)</option>
          <option value="disabled">Not collapsible (always expanded)</option>
        </select>
      </div>

      {/* Section icon */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-icon-${fieldId}`}
          className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
        >
          Section icon
        </label>
        <select
          id={`${instanceId}-editor-icon-${fieldId}`}
          value={(def as { sectionIcon?: SectionIconName }).sectionIcon ?? ''}
          onChange={(e) => {
            const value = e.currentTarget.value as SectionIconName | '';
            onUpdate({
              sectionIcon: value || undefined,
            } as Parameters<typeof onUpdate>[0]);
          }}
          className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
        >
          <option value="">No icon</option>
          {SECTION_ICON_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.icons.map((icon) => (
                <option key={icon.name} value={icon.name}>
                  {icon.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <SectionWidthEditor
        fieldId={fieldId}
        width={def.width}
        onUpdate={onUpdate}
      />

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
                  onChange={(e) =>
                    handleUpdateChild({
                      title: e.currentTarget.value,
                    } as Parameters<typeof handleUpdateChild>[0])
                  }
                  placeholder="Enter section title..."
                  className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
                />
              </div>
              <SectionWidthEditor
                fieldId={activeChildDef.id}
                width={activeChildDef.width}
                onUpdate={handleUpdateChild}
                showOverride
                overrideSectionWidth={
                  activeChildDef.overrideSectionWidth === true
                }
              />
            </div>
          ) : (
            <CommonEditor
              fieldId={activeChildDef.id}
              def={activeChildDef}
              onUpdate={handleUpdateChild}
              onRenameId={handleRenameChildId}
              isNestedChild
            />
          )}

          {(activeChildMeta?.hasOptions || activeChildMeta?.hasMatrix) && (
            <hr className="ms:border-msborder" />
          )}

          {activeChildMeta?.hasOptions &&
            (activeChildDef as { options?: FieldOption[] }).options && (
              <OptionListEditor
                fieldId={activeChildDef.id}
                fieldType={activeChildDef.fieldType}
                options={
                  (activeChildDef as { options?: FieldOption[] }).options!
                }
              />
            )}

          {activeChildMeta?.hasMatrix && (
            <MatrixEditor
              fieldId={activeChildDef.id}
              rows={(activeChildDef as { rows?: MatrixRow[] }).rows ?? []}
              columns={
                (activeChildDef as { columns?: MatrixColumn[] }).columns ?? []
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
