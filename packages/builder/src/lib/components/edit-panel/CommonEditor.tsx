import { useStore } from 'zustand';
import type {
  FieldDefinition,
  FieldWidth,
  OptionLayout,
  TextInputType,
} from '@esheet/core';
import { slugifyQuestion } from '@esheet/core';
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
  const width = (def as { width?: FieldWidth }).width ?? 'full';
  const showOptionLayout =
    def.fieldType === 'radio' ||
    def.fieldType === 'check' ||
    def.fieldType === 'multitext';
  const optionLayout =
    (def as { optionLayout?: OptionLayout }).optionLayout ?? 'stack';
  const question = (def as { question?: string }).question ?? '';
  const suggestedId = slugifyQuestion(question);
  const showSuggestion = suggestedId !== '' && suggestedId !== def.id;

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
        {showSuggestion && (
          <p className="ms:mt-1 ms:text-xs ms:text-mstextmuted">
            Suggested:{' '}
            <button
              type="button"
              onClick={() => onRenameId(suggestedId)}
              className="ms:font-mono ms:text-msprimary ms:underline ms:cursor-pointer ms:bg-transparent ms:border-0 ms:p-0"
            >
              {suggestedId}
            </button>
          </p>
        )}
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

      {/* Row width */}
      <div>
        <label
          htmlFor={`${instanceId}-editor-width-${fieldId}`}
          className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
        >
          Row width
        </label>
        <select
          id={`${instanceId}-editor-width-${fieldId}`}
          value={width}
          onChange={(e) =>
            onUpdate({
              width:
                e.currentTarget.value === 'full'
                  ? undefined
                  : (e.currentTarget.value as FieldWidth),
            } as Parameters<typeof onUpdate>[0])
          }
          className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
        >
          <option value="full">Full (whole row)</option>
          <option value="half">Half (2 per row)</option>
          <option value="third">Third (3 per row)</option>
        </select>
      </div>

      {/* Options layout (radio / check / multitext only) */}
      {showOptionLayout && (
        <div>
          <label
            htmlFor={`${instanceId}-editor-optionlayout-${fieldId}`}
            className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext ms:mb-1"
          >
            Options layout
          </label>
          <select
            id={`${instanceId}-editor-optionlayout-${fieldId}`}
            value={optionLayout}
            onChange={(e) =>
              onUpdate({
                optionLayout:
                  e.currentTarget.value === 'stack'
                    ? undefined
                    : (e.currentTarget.value as OptionLayout),
              } as Parameters<typeof onUpdate>[0])
            }
            className="ms:w-full ms:min-w-0 ms:px-3 ms:py-2 ms:text-sm ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:focus:border-msprimary ms:transition-colors"
          >
            <option value="stack">Stack (one per line)</option>
            <option value="wrap">Wrap (flow horizontally)</option>
          </select>
        </div>
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
