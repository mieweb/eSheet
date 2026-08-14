import React from 'react';
import type {
  FieldComponentProps,
  SelectedOption,
  OpenChoiceFieldDefinition,
  FieldOption,
} from '@esheet/core';
import { TrashIcon, PlusIcon } from '../../icons.js';
import { CustomRadioButton } from '../../fields-controls/CustomRadioButton.js';

export const OpenChoiceField = React.memo(function OpenChoiceField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  isSoftRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as OpenChoiceFieldDefinition & {
    question?: string;
  };
  const instanceId = form.getState().instanceId;
  const options = def.options || [];
  const otherLabel = def.otherLabel || 'Other, please Specify:';
  const otherOptionId = `${def.id}-other`;
  const selected =
    (response?.selected as SelectedOption | undefined) ?? undefined;
  const selectedId = selected?.id ?? null;
  const isOtherSelected = selectedId === otherOptionId;

  if (isPreview) {
    const otherText =
      selectedId === otherOptionId && selected?.value ? selected.value : '';
    const isWrap = def.optionLayout === 'wrap';
    const optionContainerClass =
      isWrap && options.length + 1 > 1
        ? 'ms:flex ms:flex-wrap ms:gap-2'
        : 'ms:flex ms:flex-col ms:gap-2';
    const optionClass = isWrap ? 'ms:min-w-[8rem] ms:flex-[1_1_auto]' : '';

    return (
      <div className="openchoice-field-preview ms:space-y-1.5">
        <div className="ms:text-sm ms:font-medium ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
        </div>
        <div className={optionContainerClass}>
          {options.map((option: FieldOption) => (
            <CustomRadioButton
              key={option.id}
              id={`${instanceId}-openchoice-answer-${def.id}-${option.id}`}
              name={`${instanceId}-openchoice-answer-${def.id}`}
              value={option.id}
              checked={selectedId === option.id}
              onSelect={() =>
                onResponse({
                  selected: { id: option.id, value: option.value },
                })
              }
              onUnselect={() => onResponse({ selected: undefined })}
              disabled={!isEnabled}
              className={optionClass}
            >
              {option.value}
            </CustomRadioButton>
          ))}

          <CustomRadioButton
            id={`${instanceId}-openchoice-answer-${def.id}-other`}
            name={`${instanceId}-openchoice-answer-${def.id}`}
            value={otherOptionId}
            checked={isOtherSelected}
            onSelect={() =>
              onResponse({ selected: { id: otherOptionId, value: '' } })
            }
            onUnselect={() => onResponse({ selected: undefined })}
            disabled={!isEnabled}
            className={optionClass}
          >
            {otherLabel}
          </CustomRadioButton>
        </div>

        {isOtherSelected && (
          <div className="ms:mt-2">
            <input
              id={`${instanceId}-openchoice-other-${def.id}`}
              aria-label={otherLabel}
              type="text"
              value={otherText}
              onChange={(e) => {
                onResponse({
                  selected: { id: otherOptionId, value: e.target.value },
                });
              }}
              className="ms:w-full ms:min-h-[38px] ms:px-3 ms:py-2 ms:text-sm ms:rounded-lg ms:border ms:border-msborder ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:bg-mssurface ms:text-mstext ms:cursor-text"
            />
          </div>
        )}
      </div>
    );
  }

  // Builder mode
  return (
    <div className="openchoice-field-edit ms:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          aria-label="Question"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>

      <div>
        <span className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Options
        </span>
        <div className="ms:space-y-2">
          {options.map((option: FieldOption) => (
            <div
              key={option.id}
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm ms:hover:border-mstextmuted ms:transition-colors"
            >
              <span className="ms:shrink-0 ms:w-4 ms:h-4 ms:rounded-full ms:border ms:border-msborder ms:bg-mssurface" />
              <input
                id={`${instanceId}-canvas-option-${def.id}-${option.id}`}
                aria-label={`Option ${option.id}`}
                type="text"
                value={option.value}
                onChange={(e) =>
                  form
                    .getState()
                    .updateOption(def.id, option.id, e.target.value)
                }
                placeholder="Option text"
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                title="Remove option"
              >
                <TrashIcon className="ms:w-4 ms:h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => form.getState().addOption(def.id)}
        className="ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:bg-mssurface ms:hover:bg-msprimary/10 ms:transition-colors ms:flex ms:items-center ms:justify-center ms:gap-2"
      >
        <PlusIcon className="ms:w-5 ms:h-5" /> Add Option
      </button>

      <div>
        <label
          htmlFor={`${instanceId}-canvas-other-label-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Other Label
        </label>
        <input
          id={`${instanceId}-canvas-other-label-${def.id}`}
          type="text"
          value={def.otherLabel || ''}
          onChange={(e) => onUpdate({ otherLabel: e.target.value })}
          placeholder="Other, please Specify :"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
        />
      </div>
    </div>
  );
});

export default OpenChoiceField;
