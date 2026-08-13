import React from 'react';
import type { FieldOption } from '@esheet/core';
import { TrashIcon } from '@esheet/fields';
import { useInstanceId } from '../../EsheetBuilder.js';
import { useFormApi } from '../../hooks/useFormApi.js';
import { LogicEditor } from './LogicEditor.js';

export interface OptionListEditorProps {
  fieldId: string;
  fieldType: string;
  options: readonly FieldOption[];
}

/**
 * OptionListEditor — add / edit / remove options for choice fields.
 *
 * Disables delete for boolean (fixed Yes/No).
 * Uses form.addOption / updateOption / removeOption directly.
 */
export function OptionListEditor({
  fieldId,
  fieldType,
  options,
}: OptionListEditorProps) {
  const instanceId = useInstanceId();
  const { option } = useFormApi(fieldId);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [expandedRules, setExpandedRules] = React.useState<Set<string>>(
    () => new Set()
  );
  const isBoolean = fieldType === 'boolean';
  const canScore = fieldType !== 'multitext' && fieldType !== 'ranking';
  const isScored = canScore && options.some((o) => o.score != null);
  const label = fieldType === 'multitext' ? 'Text Inputs' : 'Options';

  const handleAdd = () => {
    option.add();
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  const handleToggleScore = () => {
    if (isScored) {
      options.forEach((o) => option.setScore(o.id, undefined));
    } else {
      options.forEach((o) => {
        if (o.score == null) option.setScore(o.id, 0);
      });
    }
  };

  const toggleRules = (optionId: string) => {
    setExpandedRules((current) => {
      const next = new Set(current);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  return (
    <div className="option-list-editor ms:space-y-2">
      <div className="ms:flex ms:items-center ms:justify-between">
        <span className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext">
          {label}
        </span>
        {canScore && !isBoolean && (
          <button
            type="button"
            onClick={handleToggleScore}
            aria-pressed={isScored}
            className={`score-toggle ms:px-2 ms:py-0.5 ms:text-xs ms:font-medium ms:rounded ms:border ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer ${
              isScored
                ? 'ms:bg-msprimary ms:text-white ms:border-msprimary'
                : 'ms:bg-mssurface ms:text-mstextmuted ms:border-msborder ms:hover:text-msprimary ms:hover:border-msprimary/50'
            }`}
          >
            Score
          </button>
        )}
      </div>

      <div ref={listRef} className="option-list ms:space-y-2">
        {options.map((opt, idx) => (
          <div
            key={opt.id}
            className="option-row ms:px-3 ms:py-2 ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:hover:border-msprimary/50 ms:transition-colors"
          >
            <div className="ms:flex ms:items-center ms:gap-2">
              <input
                id={`${instanceId}-editor-option-${fieldId}-${opt.id}`}
                aria-label={`Option ${idx + 1}`}
                type="text"
                value={opt.value}
                onChange={(e) => option.update(opt.id, e.currentTarget.value)}
                placeholder={`Option ${idx + 1}`}
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext ms:placeholder:text-mstextmuted ms:border-0 ms:text-sm"
              />
              {isScored && (
                <input
                  id={`${instanceId}-editor-option-score-${fieldId}-${opt.id}`}
                  aria-label={`Option ${idx + 1} score`}
                  type="number"
                  value={opt.score ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.currentTarget.value);
                    option.setScore(opt.id, Number.isNaN(v) ? 0 : v);
                  }}
                  className="ms:w-16 ms:shrink-0 ms:outline-none ms:bg-transparent ms:text-mstext ms:border ms:border-msborder ms:rounded ms:px-1 ms:py-0.5 ms:text-sm ms:text-right"
                />
              )}
              <button
                type="button"
                onClick={() => toggleRules(opt.id)}
                aria-expanded={expandedRules.has(opt.id)}
                aria-label={`${
                  expandedRules.has(opt.id) ? 'Hide' : 'Show'
                } visibility rules for option ${idx + 1}`}
                className="ms:shrink-0 ms:px-2 ms:py-1 ms:text-xs ms:font-medium ms:rounded ms:border ms:border-msprimary/40 ms:bg-transparent ms:text-msprimary ms:hover:bg-msprimary/10 ms:outline-none ms:focus:outline-none ms:cursor-pointer"
              >
                Visibility rules
              </button>
              {!isBoolean && (
                <button
                  type="button"
                  onClick={() => option.remove(opt.id)}
                  aria-label={`Remove option ${idx + 1}`}
                  className="remove-option-btn ms:shrink-0 ms:p-0.5 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:transition-colors ms:cursor-pointer"
                >
                  <TrashIcon className="ms:w-4 ms:h-4" />
                </button>
              )}
            </div>
            {expandedRules.has(opt.id) && (
              <div className="ms:pt-3">
                <div className="ms:mb-2 ms:text-xs ms:font-medium ms:text-mstextmuted">
                  Visibility rules for {opt.value || `Option ${idx + 1}`}
                </div>
                <LogicEditor
                  fieldId={fieldId}
                  idPrefix={`${fieldId}-option-${opt.id}`}
                  scope="option"
                  rules={opt.rules ?? []}
                  onUpdateRules={(rules) => option.updateRules(opt.id, rules)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {!isBoolean && (
        <button
          type="button"
          onClick={handleAdd}
          className="add-option-btn ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:bg-mssurface ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:hover:bg-msprimary/10 ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer"
        >
          + Add {fieldType === 'multitext' ? 'Input' : 'Option'}
        </button>
      )}
    </div>
  );
}
