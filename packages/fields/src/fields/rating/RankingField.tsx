import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@msheet/core';
import { TrashIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon, UpDownArrowIcon } from '../../icons.js';

export const RankingField = React.memo(function RankingField({
  field,
  form,
  isPreview,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;
  const options = def.options || [];

  // Ranking stores an ordered array of SelectedOption[] representing the user's rank order
  const rankingArr = (response?.selected as SelectedOption[] | undefined) ?? [];
  const rankedIds = rankingArr.map((s) => s.id);

  // Build ranking: use response order if valid, otherwise default to definition order
  const ranking =
    rankedIds.length === options.length && rankedIds.every((id) => options.some((o) => o.id === id))
      ? rankedIds
      : options.map((o) => o.id);

  const optionsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of options) map[o.id] = o.value;
    return map;
  }, [options]);

  const setRanking = (newOrder: string[]) => {
    const next: SelectedOption[] = newOrder
      .map((id) => {
        const opt = options.find((o) => o.id === id);
        return opt ? { id: opt.id, value: opt.value } : null;
      })
      .filter((s): s is SelectedOption => s != null);
    onResponse({ selected: next });
  };

  const moveItem = (optId: string, direction: 'up' | 'down') => {
    const idx = ranking.indexOf(optId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= ranking.length) return;
    const next = [...ranking];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setRanking(next);
  };

  if (isPreview) {
    return (
      <div className="ranking-field-preview ms:text-mstext">
        <div className="ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
          <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
          </div>
          <div>
            {ranking.map((optId, index) => {
              const canMoveUp = index > 0;
              const canMoveDown = index < ranking.length - 1;

              return (
                <div
                  key={optId}
                  className="ranking-field-item ms:flex ms:items-center ms:px-3 ms:py-2 ms:my-2 ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:hover:border-msprimary/50 ms:hover:bg-msprimary/10 ms:transition-colors"
                >
                  <div className="ms:flex ms:items-center ms:flex-1">
                    <span className="ms:text-mstext">{optionsMap[optId] || 'Unknown option'}</span>
                  </div>
                  <div className="ms:flex ms:items-center ms:gap-1 ms:ml-2">
                    <button
                      onClick={() => moveItem(optId, 'up')}
                      disabled={!canMoveUp}
                      className={`ms:p-1 ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none ${canMoveUp ? 'ms:text-mstext ms:hover:text-msprimary' : 'ms:text-msborder ms:cursor-not-allowed'}`}
                      aria-label="Move up"
                    >
                      <ArrowUpIcon className="ms:h-6 ms:w-6" />
                    </button>
                    <button
                      onClick={() => moveItem(optId, 'down')}
                      disabled={!canMoveDown}
                      className={`ms:p-1 ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none ${canMoveDown ? 'ms:text-mstext ms:hover:text-msprimary' : 'ms:text-msborder ms:cursor-not-allowed'}`}
                      aria-label="Move down"
                    >
                      <ArrowDownIcon className="ms:h-6 ms:w-6" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ranking-field-edit ms:space-y-3">
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
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:outline-none"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
        />
      </div>

      <div>
        <span className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Items
        </span>
        <div className="ms:space-y-2">
          {options.map((option) => (
            <div
              key={option.id}
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm ms:hover:border-mstextmuted ms:transition-colors"
            >
              <UpDownArrowIcon className="ms:text-mstextmuted ms:w-5 ms:h-5 ms:shrink-0" />
              <input
                id={`${instanceId}-canvas-option-${def.id}-${option.id}`}
                aria-label={`Option ${option.id}`}
                type="text"
                value={option.value}
                onChange={(e) =>
                  form.getState().updateOption(def.id, option.id, e.target.value)
                }
                placeholder="Option text"
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                title="Remove option"
              >
                <TrashIcon className="ms:w-5 ms:h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => form.getState().addOption(def.id)}
        className="ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:bg-mssurface ms:hover:bg-msprimary/10 ms:transition-colors ms:flex ms:items-center ms:justify-center ms:gap-2 ms:outline-none ms:focus:outline-none"
      >
        <PlusIcon className="ms:w-5 ms:h-5" /> Add Option
      </button>
    </div>
  );
});
