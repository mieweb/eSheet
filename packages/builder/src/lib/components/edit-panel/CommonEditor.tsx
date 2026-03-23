import type { FieldDefinition, TextInputType } from '@esheet/core';
import { CustomCheckbox } from '@esheet/fields';
import { useInstanceId } from '../../EsheetBuilder.js';
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
    <div className="common-editor es:space-y-3">
      {/* Field ID */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-id-${fieldId}`}
          className="edit-label es:block es:text-sm es:font-medium es:text-estext es:mb-1"
        >
          Field ID
        </label>
        <DraftIdEditor id={def.id} fieldId={fieldId} onCommit={onRenameId} />
      </div>

      {/* Question */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-question-${fieldId}`}
          className="edit-label es:block es:text-sm es:text-estext es:mb-1"
        >
          Label / Question
        </label>
        <input
          id={`${instanceId}-editor-question-${fieldId}`}
          type="text"
          value={def.question ?? ''}
          onChange={(e) => onUpdate({ question: e.currentTarget.value })}
          placeholder="Enter question text"
          className="es:w-full es:min-w-0 es:px-3 es:py-2 es:text-sm es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:placeholder:text-estextmuted es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:focus:border-esprimary es:transition-colors"
        />
      </div>

      {/* Required */}
      <div className="required-toggle es:flex es:items-center es:gap-2 es:text-sm es:text-estext">
        <CustomCheckbox
          id={`${instanceId}-editor-required-${fieldId}`}
          checked={def.required ?? false}
          onChange={(checked: boolean) => onUpdate({ required: checked })}
          size="sm"
        />
        <label
          htmlFor={`${instanceId}-editor-required-${fieldId}`}
          className="es:cursor-pointer es:select-none"
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
