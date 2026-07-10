import React from 'react';
import type { FieldComponentProps, FormStore, UIStore } from '@esheet/core';
import { hydrateDefinition } from '@esheet/core';
import { renderer } from '@esheet/renderer';
import Sortable from 'sortablejs';
import { useFormApi } from '../hooks/useFormApi.js';
import { useUiApi } from '../hooks/useUiApi.js';
import { useVisibleRootIds } from '../hooks/useVisibleRootIds.js';
import { FieldWrapper } from './FieldWrapper.js';
import { getFieldComponent } from '@esheet/fields';
import { ViewBigIcon, ViewSmallIcon } from '../icons.js';

// ---------------------------------------------------------------------------
// Preview row grid
// ---------------------------------------------------------------------------
// Preview lays fields out on a 6-column grid so fields can share rows. Each
// field's `width` decides how many columns it spans; the grid packs them left
// to right and wraps automatically. On narrow screens the grid collapses to a
// single stacked column.
//   full  -> 6 cols (whole row)   half -> 3 cols (2/row)   third -> 2 cols (3/row)
// The 6-column track is applied via inline style because Tailwind's responsive
// display utilities (`ms:sm:grid`) are not reliably generated for these packages.
const PREVIEW_GRID_CLASS = 'ms:gap-3';
const PREVIEW_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  alignItems: 'start',
};

function previewColSpan(field: {
  definition: { fieldType: string; width?: 'full' | 'half' | 'third' };
}): number {
  if (
    field.definition.fieldType === 'section' ||
    field.definition.fieldType === 'pages'
  )
    return 6;
  switch (field.definition.width) {
    case 'half':
      return 3;
    case 'third':
      return 2;
    default:
      return 6;
  }
}

// Below this viewport width the preview collapses to a single stacked column
// (all fields full width), regardless of each field's chosen row width.
const PREVIEW_STACK_MEDIA_QUERY = '(max-width: 900px)';

/** True when the viewport is at tablet width or narrower. */
function useIsNarrowPreview(): boolean {
  const getMatches = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(PREVIEW_STACK_MEDIA_QUERY).matches;

  const [isNarrow, setIsNarrow] = React.useState(getMatches);

  React.useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mq = window.matchMedia(PREVIEW_STACK_MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isNarrow;
}

export interface CanvasProps {
  /** The form store */
  form: FormStore;
  /** The UI store */
  ui: UIStore;
  /** Whether drag-and-drop reordering is enabled (default: true) */
  dragEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// DraggableFieldItem — each field is both draggable and a drop target
// ---------------------------------------------------------------------------

function DraggableFieldItem({
  id,
  form,
  ui,
  parentId,
  dragEnabled,
  isSelected = false,
  isActiveChild = false,
  forceExpandVersion,
  forceCollapseVersion,
  nestedChildren,
  previewGrid = false,
  computedValue,
}: {
  id: string;
  form: FormStore;
  ui: UIStore;
  parentId?: string;
  dragEnabled: boolean;
  isSelected?: boolean;
  isActiveChild?: boolean;
  forceExpandVersion?: number;
  forceCollapseVersion?: number;
  nestedChildren?: React.ReactNode;
  previewGrid?: boolean;
  computedValue?: string | number | null;
}) {
  const handleRef = React.useRef<HTMLDivElement | null>(null);
  const field = form.getState().getField(id);

  const handleSelectOverride = React.useCallback(
    (e: React.MouseEvent) => {
      if (!parentId) return;
      e.stopPropagation();
      ui.getState().selectFieldChild(parentId, id);
    },
    [id, parentId, ui]
  );

  if (!field) return null;

  const wrapperClass = previewGrid
    ? 'field-canvas-wrapper ms:relative'
    : 'field-canvas-wrapper ms:relative ms:pb-1 ms:last:pb-0';
  const wrapperStyle = previewGrid
    ? { gridColumn: `span ${previewColSpan(field)}` }
    : undefined;

  return (
    <div
      className={wrapperClass}
      style={wrapperStyle}
      data-field-id={id}
      data-field-type={field.definition.fieldType}
      data-selected={isSelected ? 'true' : 'false'}
    >
      <FieldWrapper
        fieldId={id}
        form={form}
        ui={ui}
        dragHandleRef={handleRef}
        forceExpandVersion={forceExpandVersion}
        forceCollapseVersion={forceCollapseVersion}
        isSelectedOverride={parentId ? isActiveChild : undefined}
        onSelectOverride={parentId ? handleSelectOverride : undefined}
        selectedVariant={parentId ? 'nested' : 'default'}
        computedValue={computedValue}
      >
        {(props) => {
          const Component = getFieldComponent(props.field.definition.fieldType);

          if (!Component) {
            return (
              <p className="ms:text-sm ms:text-mstextmuted ms:p-2">
                Unknown field type:{' '}
                <code className="ms:font-mono">
                  {props.field.definition.fieldType}
                </code>
              </p>
            );
          }

          if (
            props.field.definition.fieldType === 'section' ||
            props.field.definition.fieldType === 'pages'
          ) {
            const ContainerComponent = Component as React.ComponentType<
              FieldComponentProps & { nestedChildren?: React.ReactNode }
            >;
            return (
              <ContainerComponent {...props} nestedChildren={nestedChildren} />
            );
          }
          return <Component {...props} />;
        }}
      </FieldWrapper>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas — main field list panel with Sheet DnD
// ---------------------------------------------------------------------------

export const Canvas = React.memo(function Canvas({
  form,
  ui,
  dragEnabled = true,
}: CanvasProps) {
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const rootIds = useVisibleRootIds();
  const { normalized, responses } = useFormApi();
  const { mode, selectedFieldId, selectedFieldChildId } = useUiApi();
  const isNarrowPreview = useIsNarrowPreview();
  const showPreviewGrid = mode === 'preview' && !isNarrowPreview;
  const [sectionExpandSignal, setSectionExpandSignal] = React.useState<{
    sectionId: string;
    version: number;
  } | null>(null);
  const [expandAllVersion, setExpandAllVersion] = React.useState<
    number | undefined
  >(undefined);
  const [collapseAllVersion, setCollapseAllVersion] = React.useState<
    number | undefined
  >(undefined);
  const [allExpanded, setAllExpanded] = React.useState(false);
  const [currentPagesIdx, setCurrentPagesIdx] = React.useState(0);
  const normalizedRef = React.useRef(normalized);

  React.useEffect(() => {
    normalizedRef.current = normalized;
  }, [normalized]);

  // Clear drag state when mode changes or modal closes
  React.useEffect(() => {
    ui.getState().clearDragState();
  }, [dragEnabled, ui]);

  // SortableJS setup for root and section child lists.
  // Re-runs whenever `normalized` changes so newly added section child
  // containers always get their own Sortable instance.
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el || !dragEnabled) return;

    const resolveScrollContainer = (
      fromEl: HTMLElement
    ): HTMLElement | null => {
      let node: HTMLElement | null = fromEl;
      while (node) {
        const style = window.getComputedStyle(node);
        const canScrollY =
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          style.overflowY === 'overlay';
        if (canScrollY && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return document.scrollingElement instanceof HTMLElement
        ? document.scrollingElement
        : null;
    };

    const getParentId = (listEl: HTMLElement): string | null => {
      const attr = listEl.getAttribute('data-parent-id');
      return attr && attr.length > 0 ? attr : null;
    };

    const restoreDomToSource = (evt: Sortable.SortableEvent) => {
      if (typeof evt.oldIndex !== 'number') return;
      const { item, from: sourceList, to: targetList } = evt;
      if (sourceList !== targetList && item.parentElement === targetList) {
        targetList.removeChild(item);
      }
      const clamped = Math.max(
        0,
        Math.min(evt.oldIndex, sourceList.children.length)
      );
      const ref = sourceList.children.item(clamped);
      if (ref) sourceList.insertBefore(item, ref);
      else sourceList.appendChild(item);
    };

    const listEls = [
      el,
      ...Array.from(
        el.querySelectorAll<HTMLElement>('[data-sortable-list="true"]')
      ),
    ];

    const instances = listEls.map((listEl) => {
      const scrollContainer = resolveScrollContainer(listEl);

      return Sortable.create(listEl, {
        group: 'builder-fields',
        handle: '.drag-handle',
        draggable: '.field-canvas-wrapper',
        dataIdAttr: 'data-field-id',
        animation: 150,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 3,
        scroll: scrollContainer ?? true,
        bubbleScroll: scrollContainer === null,
        forceAutoScrollFallback: true,
        scrollSensitivity: 220,
        scrollSpeed: 13,
        invertSwap: true,
        swapThreshold: getParentId(listEl) !== null ? 0.21 : 0.5,
        invertedSwapThreshold: getParentId(listEl) !== null ? 0.21 : 0.5,
        emptyInsertThreshold: getParentId(listEl) !== null ? 40 : 18,
        onChoose: (evt) => {
          const sourceId = evt.item.getAttribute('data-field-id');
          if (!sourceId) return;
          const sourceNode = normalizedRef.current.byId[sourceId];
          if (sourceNode?.parentId) {
            ui.getState().selectFieldChild(sourceNode.parentId, sourceId);
          } else {
            ui.getState().selectField(sourceId);
          }
        },
        onMove: (evt) => {
          // Toggle placeholder visibility without triggering a React re-render.
          // A re-render here would shift DOM indices and break restoreDomToSource.

          // Reset ALL placeholders first so any section we just left is restored.
          el.querySelectorAll<HTMLElement>(
            '.section-empty-placeholder'
          ).forEach((ph) => {
            ph.style.display = '';
          });

          // Hide placeholder in the list currently being dragged into.
          if (getParentId(evt.to) !== null) {
            const ph = evt.to.querySelector<HTMLElement>(
              '.section-empty-placeholder'
            );
            if (ph) ph.style.display = 'none';
          }

          // Show placeholder when dragging the last child out of a section.
          if (
            evt.from !== evt.to &&
            getParentId(evt.from) !== null &&
            evt.from.querySelectorAll('.field-canvas-wrapper').length <= 1
          ) {
            const ph = evt.from.querySelector<HTMLElement>(
              '.section-empty-placeholder'
            );
            if (ph) ph.style.display = '';
          }

          return true;
        },
        onEnd: (evt) => {
          // Clear any inline display overrides set during drag.
          el.querySelectorAll<HTMLElement>(
            '.section-empty-placeholder'
          ).forEach((ph) => {
            ph.style.display = '';
          });
          const sourceId = evt.item.getAttribute('data-field-id');
          if (!sourceId) return;

          const newIndex = evt.newDraggableIndex ?? evt.newIndex;
          const oldIndex = evt.oldDraggableIndex ?? evt.oldIndex;
          if (typeof newIndex !== 'number') return;

          const fromParentId = getParentId(evt.from);
          const toParentId = getParentId(evt.to);

          // No-op: dropped back in the same position
          if (fromParentId === toParentId && oldIndex === newIndex) return;

          // Undo Sortable's DOM move so React can own the placement
          restoreDomToSource(evt);

          form.getState().moveField(sourceId, newIndex, toParentId);

          // Update selection to follow the moved field to its new location.
          if (toParentId !== null) {
            setSectionExpandSignal((prev) => ({
              sectionId: toParentId,
              version: (prev?.version ?? 0) + 1,
            }));
            ui.getState().selectFieldChild(toParentId, sourceId);
          } else {
            ui.getState().selectField(sourceId);
          }

          ui.getState().clearDragState();
        },
      });
    });

    return () => {
      for (const instance of instances) instance.destroy();
    };
  }, [dragEnabled, form, normalized, ui]);

  // Preview-only renderability map
  const previewRenderableMap = React.useMemo(() => {
    if (mode !== 'preview') return null;
    const cache = new Map<string, boolean>();

    const visit = (fieldId: string): boolean => {
      const cached = cache.get(fieldId);
      if (cached !== undefined) return cached;

      const isVisible = form.getState().isVisible(fieldId);
      if (!isVisible) {
        cache.set(fieldId, false);
        return false;
      }

      const node = normalized.byId[fieldId];
      if (!node) {
        cache.set(fieldId, false);
        return false;
      }

      if (
        node.definition.fieldType !== 'section' &&
        node.definition.fieldType !== 'pages'
      ) {
        cache.set(fieldId, true);
        return true;
      }

      const hasRenderableChild = node.childIds.some((childId) =>
        visit(childId)
      );
      cache.set(fieldId, hasRenderableChild);
      return hasRenderableChild;
    };

    for (const id of Object.keys(normalized.byId)) {
      visit(id);
    }
    return cache;
  }, [form, mode, normalized, responses]);

  const items = React.useMemo(() => {
    if (mode !== 'preview' || !previewRenderableMap) return [...rootIds];
    return rootIds.filter((id) => previewRenderableMap.get(id) === true);
  }, [mode, previewRenderableMap, rootIds]);

  // Separate pages fields from other root fields
  const { pagesIds } = React.useMemo(() => {
    const pages: string[] = [];
    for (const id of items) {
      if (normalized.byId[id]?.definition.fieldType === 'pages') {
        pages.push(id);
      }
    }
    return { pagesIds: pages };
  }, [items, normalized]);

  const isMultiPage = pagesIds.length > 1;

  // Clamp index when pages are added or removed
  React.useEffect(() => {
    if (pagesIds.length > 0 && currentPagesIdx >= pagesIds.length) {
      setCurrentPagesIdx(pagesIds.length - 1);
    }
  }, [pagesIds.length, currentPagesIdx]);

  const pageLabels = React.useMemo(
    () =>
      pagesIds.map((id, i) => {
        const def = normalized.byId[id]?.definition;
        return (def as { title?: string })?.title || `Page ${i + 1}`;
      }),
    [pagesIds, normalized]
  );

  const handlePrevPage = React.useCallback(
    () => setCurrentPagesIdx((p) => Math.max(p - 1, 0)),
    []
  );
  const handleNextPage = React.useCallback(
    () => setCurrentPagesIdx((p) => Math.min(p + 1, pagesIds.length - 1)),
    [pagesIds.length]
  );

  // When pages exist, the canvas IS the active page — show its children directly.
  const hasPages = pagesIds.length > 0;
  const activePagesId = hasPages ? pagesIds[currentPagesIdx] ?? null : null;

  // Keep UIStore in sync so ToolPanel always knows which page is active
  React.useEffect(() => {
    ui.getState().setActivePagesId(activePagesId);
  }, [activePagesId, ui]);

  const displayItems = React.useMemo(() => {
    if (!hasPages || !activePagesId) return items;
    const node = normalized.byId[activePagesId];
    if (!node) return [];
    if (mode !== 'preview') return [...node.childIds];
    return node.childIds.filter((id) => previewRenderableMap?.get(id) === true);
  }, [hasPages, activePagesId, items, normalized, mode, previewRenderableMap]);

  // Build render tree to extract computed values from setValue effects
  const computedValuesMap = React.useMemo(() => {
    const hydratedFields = hydrateDefinition(normalized);
    const tree = renderer(
      { id: 'canvas', pages: [{ id: 'page-1', fields: hydratedFields }] },
      responses
    );

    const buildMap = (
      nodes: typeof tree
    ): Map<string, string | number | null> => {
      const map = new Map<string, string | number | null>();
      const walk = (n: typeof tree) => {
        for (const node of n) {
          if (node.computedValue !== undefined && node.computedValue !== null) {
            map.set(node.id, node.computedValue);
          }
          walk(node.children);
        }
      };
      walk(nodes);
      return map;
    };

    return buildMap(tree);
  }, [normalized, responses]);

  const getVisibleChildIds = React.useCallback(
    (parentId: string): readonly string[] => {
      const parent = normalized.byId[parentId];
      if (!parent || parent.childIds.length === 0) return [];
      if (mode !== 'preview') return parent.childIds;
      return parent.childIds.filter(
        (childId) => previewRenderableMap?.get(childId) === true
      );
    },
    [mode, normalized, previewRenderableMap]
  );

  const renderNestedChildren = React.useCallback(
    (parentId: string, depth = 1): React.ReactNode => {
      const parent = normalized.byId[parentId];
      if (
        !parent ||
        (parent.definition.fieldType !== 'section' &&
          parent.definition.fieldType !== 'pages')
      )
        return null;

      const childIds = getVisibleChildIds(parentId);
      if (mode === 'preview' && childIds.length === 0) return null;

      const isEmpty = mode !== 'preview' && childIds.length === 0;
      const previewGridClass = showPreviewGrid ? ` ${PREVIEW_GRID_CLASS}` : '';
      const containerClass =
        depth === 1
          ? `section-children${previewGridClass}`
          : `section-children ms:border-l ms:border-msborder ms:pl-3${previewGridClass}`;
      const emptyClass = isEmpty
        ? ' ms:rounded-lg ms:border-2 ms:border-dashed ms:border-msprimary/30 ms:bg-gradient-to-br ms:from-msbackground ms:to-msbackgroundsecondary'
        : ' ms:min-h-[2rem]';

      return (
        <div
          className={`${containerClass}${emptyClass}`}
          style={showPreviewGrid ? PREVIEW_GRID_STYLE : undefined}
          data-depth={depth}
          data-sortable-list={dragEnabled ? 'true' : undefined}
          data-parent-id={parentId}
        >
          {isEmpty && (
            <div className="section-empty-placeholder ms:flex ms:flex-col ms:items-center ms:justify-center ms:p-8 ms:text-center ms:pointer-events-none ms:select-none">
              <p className="ms:text-sm ms:font-semibold ms:text-mstext ms:mb-2">
                No fields in this section
              </p>
              <p className="ms:text-xs ms:text-mstextmuted ms:leading-relaxed">
                Use the Tool Panel on the left to add fields.
              </p>
            </div>
          )}
          {childIds.map((childId) => (
            <DraggableFieldItem
              key={childId}
              id={childId}
              form={form}
              ui={ui}
              parentId={parentId}
              dragEnabled={dragEnabled}
              previewGrid={showPreviewGrid}
              isSelected={
                selectedFieldId === parentId && selectedFieldChildId === childId
              }
              isActiveChild={
                selectedFieldId === parentId && selectedFieldChildId === childId
              }
              forceExpandVersion={
                sectionExpandSignal?.sectionId === childId
                  ? sectionExpandSignal.version
                  : expandAllVersion
              }
              forceCollapseVersion={collapseAllVersion}
              nestedChildren={renderNestedChildren(childId, depth + 1)}
              computedValue={computedValuesMap.get(childId)}
            />
          ))}
        </div>
      );
    },
    [
      collapseAllVersion,
      computedValuesMap,
      dragEnabled,
      expandAllVersion,
      form,
      getVisibleChildIds,
      sectionExpandSignal,
      selectedFieldChildId,
      selectedFieldId,
      showPreviewGrid,
      ui,
    ]
  );

  // Clear selection on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ui.getState().selectField(null);
        ui.getState().clearDragState();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ui]);

  return (
    <div className="ms:flex ms:flex-col ms:flex-1 ms:min-h-0">
      {mode === 'build' && (
        <div className="ms:bg-mssurface ms:border-b ms:border-msborder ms:px-4 ms:py-4 ms:flex ms:items-center ms:justify-between ms:gap-2">
          <span className="ms:text-sm ms:font-semibold ms:text-mstext ms:select-none">
            Fields
          </span>
          {displayItems.length > 0 && (
            <div className="ms:flex ms:items-center ms:gap-1">
              <button
                type="button"
                title={allExpanded ? 'Collapse all' : 'Expand all'}
                className="ms:flex ms:items-center ms:gap-1 ms:px-2 ms:py-1 ms:text-xs ms:text-mstextmuted ms:hover:text-mstext ms:rounded ms:hover:bg-msbackgroundhover ms:transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (allExpanded) {
                    setCollapseAllVersion((v) => (v ?? 0) + 1);
                  } else {
                    setExpandAllVersion((v) => (v ?? 0) + 1);
                  }
                  setAllExpanded((v) => !v);
                }}
              >
                {allExpanded ? (
                  <ViewSmallIcon className="ms:w-3.5 ms:h-3.5" />
                ) : (
                  <ViewBigIcon className="ms:w-3.5 ms:h-3.5" />
                )}
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          )}
        </div>
      )}
      {isMultiPage && (
        <div className="pages-nav ms:flex ms:items-center ms:justify-between ms:gap-2 ms:px-4 ms:py-2 ms:border-b ms:border-msborder ms:bg-mssurface ms:flex-wrap">
          <div className="ms:flex ms:items-center ms:gap-1 ms:flex-wrap">
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPagesIdx === 0}
              onClick={handlePrevPage}
              className="ms:inline-flex ms:items-center ms:justify-center ms:h-7 ms:w-7 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer ms:shrink-0 ms:text-base ms:leading-none"
            >
              ‹
            </button>
            {pageLabels.map((label, i) => (
              <button
                key={pagesIds[i]}
                type="button"
                aria-label={`Go to ${label}`}
                aria-current={i === currentPagesIdx ? 'page' : undefined}
                onClick={() => {
                  setCurrentPagesIdx(i);
                  ui.getState().selectField(pagesIds[i]);
                }}
                className={`ms:inline-flex ms:items-center ms:justify-center ms:min-w-[2rem] ms:h-7 ms:px-2 ms:rounded ms:border ms:text-xs ms:font-medium ms:transition-colors ms:outline-none ms:cursor-pointer ms:shrink-0 ${
                  i === currentPagesIdx
                    ? 'ms:border-msprimary ms:bg-msprimary/10 ms:text-msprimary'
                    : 'ms:border-msborder ms:bg-mssurface ms:text-mstext ms:hover:bg-msbackgroundhover ms:hover:border-msprimary/40'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPagesIdx === pagesIds.length - 1}
              onClick={handleNextPage}
              className="ms:inline-flex ms:items-center ms:justify-center ms:h-7 ms:w-7 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer ms:shrink-0 ms:text-base ms:leading-none"
            >
              ›
            </button>
          </div>
          <span className="ms:text-xs ms:text-mstextmuted ms:shrink-0">
            {currentPagesIdx + 1} / {pagesIds.length}
          </span>
          {mode === 'build' && activePagesId && (
            <button
              type="button"
              aria-label="Delete current page"
              disabled={pagesIds.length <= 1}
              onClick={() => {
                const nextIdx = Math.max(currentPagesIdx - 1, 0);
                form.getState().removePage(activePagesId);
                setCurrentPagesIdx(nextIdx);
                ui.getState().selectField(null);
              }}
              className="ms:inline-flex ms:items-center ms:justify-center ms:h-7 ms:px-2 ms:rounded ms:border ms:border-msdanger/50 ms:bg-mssurface ms:text-msdanger ms:text-xs ms:transition-colors ms:hover:bg-msdanger/10 ms:outline-none ms:cursor-pointer ms:shrink-0 ms:disabled:opacity-40 ms:disabled:cursor-not-allowed"
            >
              Delete page
            </button>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <div className="canvas-empty ms:flex ms:flex-1 ms:items-center ms:justify-center ms:min-h-[200px] ms:text-mstextmuted ms:text-sm">
          No fields yet. Add a field from the Tool Panel to get started.
        </div>
      ) : (
        <div
          ref={canvasRef}
          className={`canvas-fields ${
            showPreviewGrid ? PREVIEW_GRID_CLASS : 'ms:space-y-0'
          } ms:flex-1 ms:min-h-0 ms:overflow-y-auto ms:px-4 ms:pt-3 ms:pb-4`}
          style={showPreviewGrid ? PREVIEW_GRID_STYLE : undefined}
          data-sortable-list={dragEnabled ? 'true' : undefined}
          data-parent-id={activePagesId ?? ''}
        >
          {displayItems.length === 0 && hasPages && mode !== 'preview' ? (
            <div className="section-empty-placeholder ms:flex ms:flex-col ms:items-center ms:justify-center ms:p-8 ms:text-center ms:pointer-events-none ms:select-none ms:rounded-lg ms:border-2 ms:border-dashed ms:border-msprimary/30 ms:bg-gradient-to-br ms:from-msbackground ms:to-msbackgroundsecondary">
              <p className="ms:text-sm ms:font-semibold ms:text-mstext ms:mb-2">
                No fields on this page
              </p>
              <p className="ms:text-xs ms:text-mstextmuted ms:leading-relaxed">
                Use the Tool Panel on the left to add fields.
              </p>
            </div>
          ) : (
            displayItems.map((id) => (
              <DraggableFieldItem
                key={id}
                id={id}
                form={form}
                ui={ui}
                parentId={activePagesId ?? undefined}
                dragEnabled={dragEnabled}
                previewGrid={showPreviewGrid}
                isSelected={
                  activePagesId
                    ? selectedFieldId === activePagesId &&
                      selectedFieldChildId === id
                    : selectedFieldId === id && selectedFieldChildId === null
                }
                isActiveChild={
                  activePagesId
                    ? selectedFieldId === activePagesId &&
                      selectedFieldChildId === id
                    : false
                }
                forceExpandVersion={
                  sectionExpandSignal?.sectionId === id
                    ? sectionExpandSignal.version
                    : expandAllVersion
                }
                forceCollapseVersion={collapseAllVersion}
                nestedChildren={renderNestedChildren(id)}
                computedValue={computedValuesMap.get(id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});
