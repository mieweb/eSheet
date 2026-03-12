import type { FieldDefinition, TextInputType } from '@msheet/core';
import { CustomCheckbox } from '@msheet/fields';
import { useInstanceId } from '../../MsheetBuilder.js';
import { DraftIdEditor } from './DraftIdEditor.js';
import { InputTypeEditor } from './InputTypeEditor.js';

export interface CommonEditorProps {
  fieldId: string;
  def: Omit<FieldDefinition, 'fields'>;
  onUpdate: (patch: Partial<Omit<FieldDefinition, 'fields'>>) => void;
  /** Called to rename the field ID. Returns false if the name collides. */
  onRenameId: (newId: string) => boolean;
}

/**
 * CommonEditor — shared property editors for all non-section fields.
 *
 * Renders: ID, Question, Sublabel (description), Required toggle,
 * and InputTypeEditor for text/longtext fields.
 */
export function CommonEditor({
  fieldId,
  def,
  onUpdate,
  onRenameId,
}: CommonEditorProps) {
  const instanceId = useInstanceId();
  const showInputType =
    def.fieldType === 'text' || def.fieldType === 'longtext';

  return (
    <div className="common-editor ms:space-y-3">
      {/* Field ID */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-id-${fieldId}`}
          className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
        >
          Field ID
        </label>
        <DraftIdEditor id={def.id} fieldId={fieldId} onCommit={onRenameId} />
      </div>

      {/* Question */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-question-${fieldId}`}
          className="edit-label ms:block ms:text-sm ms:text-mstext ms:mb-1"
        >
          Label / Question
        </label>
        <input
          id={`${instanceId}-editor-question-${fieldId}`}
          type="text"
          value={def.question ?? ''}
          onChange={(e) => onUpdate({ question: e.currentTarget.value })}
          placeholder="Enter question text"
          className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
        />
      </div>

      {/* Required */}
      <div className="required-toggle ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext">
        <CustomCheckbox
          id={`${instanceId}-editor-required-${fieldId}`}
          checked={def.required ?? false}
          onChange={(checked) => onUpdate({ required: checked })}
          size="sm"
        />
        <label
          htmlFor={`${instanceId}-editor-required-${fieldId}`}
          className="ms:cursor-pointer ms:select-none"
        >
          Required
        </label>
      </div>

      {/* Input Type (text/longtext only) */}
      {showInputType && (
        <InputTypeEditor
          fieldId={fieldId}
          inputType={(def.inputType as TextInputType) ?? 'string'}
          unit={def.unit}
          onChange={onUpdate}
        />
      )}
    </div>
  );
}
