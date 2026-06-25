import { useStore } from 'zustand';
import type { FieldDefinition, TextInputType } from '@esheet/core';
import { useFormStore } from '@esheet/fields';
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
  const formStore = useFormStore();
  const dangerouslyAllowJS = useStore(formStore, (s) => s.dangerouslyAllowJS);
  const calculation = (def as { calculation?: string }).calculation ?? '';

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

      {/* Question — hidden for display fields (they use content, not question) */}
      {def.fieldType !== 'display' && (
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
            value={(def as { question?: string }).question ?? ''}
            onChange={(e) =>
              onUpdate({ question: e.currentTarget.value } as Parameters<
                typeof onUpdate
              >[0])
            }
            placeholder="Enter question text"
            className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
          />
        </div>
      )}

      {/* Input Type (text/longtext only) */}
      {showInputType && (
        <InputTypeEditor
          fieldId={fieldId}
          inputType={
            (def as { inputType?: TextInputType }).inputType ?? 'string'
          }
          unit={(def as { unit?: string }).unit}
          onChange={(patch) =>
            onUpdate(patch as Parameters<typeof onUpdate>[0])
          }
        />
      )}

      {/* Calculation (only when dangerouslyAllowJS is enabled on the form) */}
      {dangerouslyAllowJS && (
        <div>
          <label
            htmlFor={`${instanceId}-editor-calculation-${fieldId}`}
            className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
          >
            Calculation (JS)
          </label>
          <textarea
            id={`${instanceId}-editor-calculation-${fieldId}`}
            aria-label="Calculation JS expression"
            value={calculation}
            onChange={(e) =>
              onUpdate({
                calculation: e.currentTarget.value.trim() || undefined,
              } as Parameters<typeof onUpdate>[0])
            }
            placeholder={`responses['fieldId'] + 1`}
            rows={3}
            className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors ms:font-mono ms:resize-y"
          />
          <p className="ms:text-xs ms:text-mstextmuted ms:mt-1">
            JS expression whose return value sets this field. Use{' '}
            <code>{"responses['fieldId']"}</code> for other field values.
          </p>
        </div>
      )}
    </div>
  );
}
