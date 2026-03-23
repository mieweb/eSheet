import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import {
  applySheetDnd,
  getReorderDestinationIndex,
  type SheetDndDropDetail,
} from '@esheet/core';
import {
  TrashIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  UpDownArrowIcon,
  DragHandleIcon,
} from '../../icons.js';

// ---------------------------------------------------------------------------
// Draggable ranking item (preview mode only)
// ---------------------------------------------------------------------------

function DraggableRankItem({
  optId,
  label,
  index,
  total,
  fieldId,
  isEnabled,
  onMove,
}: {
  optId: string;
  label: string;
  index: number;
  total: number;
  fieldId: string;
  isEnabled: boolean;
  onMove: (optId: string, direction: 'up' | 'down') => void;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const handleRef = React.useRef<HTMLDivElement | null>(null);

  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !isEnabled) return;

    const dragHandleEl = handleRef.current ?? el;
    return applySheetDnd(dragHandleEl as HTMLElement, 'data-opt-id');
  }, [isEnabled, optId, fieldId, index]);

  return (
    <div
      ref={ref}
      data-opt-id={optId}
      className="ranking-field-item es:relative es:flex es:items-center es:px-3 es:py-2 es:bg-essurface es:border es:border-esborder es:rounded-lg es:shadow-sm es:hover:border-esprimary/50 es:hover:bg-esprimary/10 es:transition-colors"
    >
      <div
        ref={handleRef}
        className="rank-drag-handle es:flex es:items-center es:mr-2 es:text-estextmuted es:cursor-grab es:active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        aria-label="Drag to reorder"
      >
        <DragHandleIcon className="es:w-5 es:h-5" />
      </div>
      <div className="es:flex es:items-center es:flex-1">
        <span className="es:text-estext">{label}</span>
      </div>
      <div className="es:flex es:items-center es:gap-1 es:ml-2">
        <button
          onClick={() => onMove(optId, 'up')}
          disabled={!canMoveUp || !isEnabled}
          className={`es:p-1 es:bg-transparent es:border-0 es:outline-none es:focus:outline-none ${
            canMoveUp
              ? 'es:text-estext es:hover:text-esprimary'
              : 'es:text-esborder es:cursor-not-allowed'
          }`}
          aria-label="Move up"
        >
          <ArrowUpIcon className="es:h-6 es:w-6" />
        </button>
        <button
          onClick={() => onMove(optId, 'down')}
          disabled={!canMoveDown || !isEnabled}
          className={`es:p-1 es:bg-transparent es:border-0 es:outline-none es:focus:outline-none ${
            canMoveDown
              ? 'es:text-estext es:hover:text-esprimary'
              : 'es:text-esborder es:cursor-not-allowed'
          }`}
          aria-label="Move down"
        >
          <ArrowDownIcon className="es:h-6 es:w-6" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview wrapper — owns the sheetdrop handler for drag-to-reorder
// ---------------------------------------------------------------------------

function RankingPreview({
  ranking,
  optionsMap,
  fieldId,
  isEnabled,
  isRequired,
  question,
  moveItem,
  setRanking,
}: {
  ranking: string[];
  optionsMap: Record<string, string>;
  fieldId: string;
  isEnabled: boolean;
  isRequired: boolean;
  question: string | undefined;
  moveItem: (optId: string, direction: 'up' | 'down') => void;
  setRanking: (newOrder: string[]) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Sheet DnD handler for ranking reorder
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !isEnabled) return;

    const handler = (e: Event) => {
      const { sourceId, targetId, edge } = (
        e as CustomEvent<SheetDndDropDetail>
      ).detail;
      const startIndex = ranking.indexOf(sourceId);
      const targetIndex = ranking.indexOf(targetId);
      if (startIndex === -1 || targetIndex === -1) return;

      const destinationIndex = getReorderDestinationIndex({
        startIndex,
        indexOfTarget: targetIndex,
        closestEdgeOfTarget: edge,
      });

      const next = [...ranking];
      const [moved] = next.splice(startIndex, 1);
      next.splice(destinationIndex, 0, moved);
      setRanking(next);
    };

    el.addEventListener('sheetdrop', handler);
    return () => el.removeEventListener('sheetdrop', handler);
  }, [isEnabled, ranking, setRanking]);

  return (
    <div
      ref={containerRef}
      className="ranking-field-preview es:text-estext es:grid es:grid-cols-1 es:gap-2 es:sm:grid-cols-2 es:pb-4"
    >
      <div className="es:font-light es:text-estext es:break-words es:overflow-hidden">
        {question || 'Question'}
        {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
      </div>
      <div className="es:flex es:flex-col es:gap-2">
        {ranking.map((optId, index) => (
          <DraggableRankItem
            key={optId}
            optId={optId}
            label={optionsMap[optId] || 'Unknown option'}
            index={index}
            total={ranking.length}
            fieldId={fieldId}
            isEnabled={isEnabled}
            onMove={moveItem}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RankingField
// ---------------------------------------------------------------------------

export const RankingField = React.memo(function RankingField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
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
    rankedIds.length === options.length &&
    rankedIds.every((id) => options.some((o) => o.id === id))
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
      <RankingPreview
        ranking={ranking}
        optionsMap={optionsMap}
        fieldId={def.id}
        isEnabled={isEnabled}
        isRequired={isRequired}
        question={def.question}
        moveItem={moveItem}
        setRanking={setRanking}
      />
    );
  }

  return (
    <div className="ranking-field-edit es:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          aria-label="Question"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary es:outline-none"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
        />
      </div>

      <div>
        <span className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-2">
          Items
        </span>
        <div className="es:space-y-2">
          {options.map((option) => (
            <div
              key={option.id}
              className="es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:bg-essurface es:rounded-lg es:shadow-sm es:hover:border-estextmuted es:transition-colors"
            >
              <UpDownArrowIcon className="es:text-estextmuted es:w-5 es:h-5 es:shrink-0" />
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
                className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext"
              />
              <button
                onClick={() => form.getState().removeOption(def.id, option.id)}
                className="es:shrink-0 es:text-estextmuted es:hover:text-esdanger es:transition-colors es:bg-transparent es:border-0 es:outline-none es:focus:outline-none"
                title="Remove option"
              >
                <TrashIcon className="es:w-5 es:h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => form.getState().addOption(def.id)}
        className="es:w-full es:px-3 es:py-2 es:text-sm es:font-medium es:text-esprimary es:border es:border-esprimary/50 es:rounded-lg es:bg-essurface es:hover:bg-esprimary/10 es:transition-colors es:flex es:items-center es:justify-center es:gap-2 es:outline-none es:focus:outline-none"
      >
        <PlusIcon className="es:w-5 es:h-5" /> Add Option
      </button>
    </div>
  );
});
