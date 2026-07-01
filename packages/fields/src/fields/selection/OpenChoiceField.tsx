import React from 'react';
import type {
  FieldComponentProps,
  SelectedOption,
  OpenChoiceFieldDefinition,
  FieldOption,
} from '@esheet/core';
import { RadioGroup, Radio } from '@mieweb/ui';
import { TrashIcon, PlusIcon } from '../../icons.js';

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
    const otherText = selectedId === otherOptionId && selected?.value ? selected.value : '';

    return (
      <div className="openchoice-field-preview ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
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
        <div className="ms:space-y-2">
          <RadioGroup
            value={selectedId ?? ''}
            onValueChange={(val) => {
              if (!val) {
                onResponse({ selected: undefined });
                return;
              }

              if (val === otherOptionId) {
                onResponse({ selected: { id: otherOptionId, value: '' } });
                return;
              }

              const opt = options.find((o) => o.id === val);
              if (opt) {
                onResponse({ selected: { id: opt.id, value: opt.value } });
              }
            }}
            disabled={!isEnabled}
            orientation="vertical"
            className="ms:space-y-2"
          >
            {options.map((option: FieldOption) => (
              <label
                key={option.id}
                htmlFor={`${instanceId}-openchoice-answer-${def.id}-${option.id}`}
                className={`ms:flex ms:items-center ms:gap-2 ms:rounded ms:transition-colors ms:py-1 ms:px-1 ms:select-none ${
                  isEnabled
                    ? 'ms:cursor-pointer ms:hover:bg-msprimary/5'
                    : 'ms:cursor-not-allowed'
                }`}
              >
                <Radio
                  id={`${instanceId}-openchoice-answer-${def.id}-${option.id}`}
                  value={option.id}
                  onClick={() => {
                    if (selectedId === option.id) {
                      onResponse({ selected: undefined });
                    }
                  }}
                />
                <span className="ms:text-sm ms:text-mstext">
                  {option.value}
                </span>
              </label>
            ))}

            <label
              htmlFor={`${instanceId}-openchoice-answer-${def.id}-other`}
              className={`ms:flex ms:items-center ms:gap-2 ms:rounded ms:transition-colors ms:py-1 ms:px-1 ms:select-none ${
                isEnabled
                  ? 'ms:cursor-pointer ms:hover:bg-msprimary/5'
                  : 'ms:cursor-not-allowed'
              }`}
            >
              <Radio
                id={`${instanceId}-openchoice-answer-${def.id}-other`}
                value={otherOptionId}
                onClick={() => {
                  if (isOtherSelected) {
                    onResponse({ selected: undefined });
                  }
                }}
              />
              <span className="ms:text-sm ms:text-mstext">{otherLabel}</span>
            </label>
          </RadioGroup>

          <div className="ms:mt-2">
            <input
              id={`${instanceId}-openchoice-other-${def.id}`}
              type="text"
              value={otherText}
              onChange={(e) => {
                onResponse({ selected: { id: otherOptionId, value: e.target.value } });
              }}
              disabled={!isOtherSelected}
              className={`ms:w-full ms:px-3 ms:py-2 ms:h-9 ms:rounded-lg ms:transition-all ${
                isOtherSelected
                  ? 'ms:border ms:border-msborder ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:bg-mssurface ms:text-mstext ms:cursor-text'
                  : 'ms:border ms:border-dashed ms:border-msborder ms:bg-mssurface ms:text-mstextmuted ms:opacity-40 ms:cursor-not-allowed'
              }`}
            />
          </div>
        </div>
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
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
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg"
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
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none"
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
        />
      </div>
    </div>
  );
});

export default OpenChoiceField;
