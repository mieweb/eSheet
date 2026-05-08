import React from 'react';
import type { FieldComponentProps, FormStore, UIStore } from '@esheet/core';
import Sortable from 'sortablejs';
import { useFormApi } from '../hooks/useFormApi.js';
import { useUiApi } from '../hooks/useUiApi.js';
import { useVisibleRootIds } from '../hooks/useVisibleRootIds.js';
import { FieldWrapper } from './FieldWrapper.js';
import { getFieldComponent } from '@esheet/fields';
import { ViewBigIcon, ViewSmallIcon } from '../icons.js';

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
}) {
  const handleRef = React.useRef<HTMLDivElement | null>(null);
  const field = form.getState().getField(id);

  if (!field) return null;

  const handleSelectOverride = React.useCallback(
    (e: React.MouseEvent) => {
      if (!parentId) return;
      e.stopPropagation();
      ui.getState().selectFieldChild(parentId, id);
    },
    [id, parentId, ui]
  );

  return (
    <div
      className="field-canvas-wrapper ms:relative ms:pb-1 ms:last:pb-0"
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
      >
        {(props) => {
          const Component = getFieldComponent(
            props.field.definition.fieldType
          )!;

          if (props.field.definition.fieldType === 'section') {
            const SectionComponent = Component as React.ComponentType<
              FieldComponentProps & { nestedChildren?: React.ReactNode }
            >;
            return (
              <SectionComponent {...props} nestedChildren={nestedChildren} />
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

      if (node.definition.fieldType !== 'section') {
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
      if (!parent || parent.definition.fieldType !== 'section') return null;

      const childIds = getVisibleChildIds(parentId);
      if (mode === 'preview' && childIds.length === 0) return null;

      const isEmpty = mode !== 'preview' && childIds.length === 0;
      const containerClass =
        depth === 1
          ? 'section-children'
          : 'section-children ms:border-l ms:border-msborder ms:pl-3';
      const emptyClass = isEmpty
        ? ' ms:rounded-lg ms:border-2 ms:border-dashed ms:border-msprimary/30 ms:bg-gradient-to-br ms:from-msbackground ms:to-msbackgroundsecondary'
        : ' ms:min-h-[2rem]';

      return (
        <div
          className={`${containerClass}${emptyClass}`}
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
            />
          ))}
        </div>
      );
    },
    [
      collapseAllVersion,
      dragEnabled,
      expandAllVersion,
      form,
      getVisibleChildIds,
      sectionExpandSignal,
      selectedFieldChildId,
      selectedFieldId,
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
        <div className="ms:bg-msbackground ms:border-b ms:border-msborder ms:px-3 ms:py-1.5 ms:flex ms:items-center ms:justify-between ms:gap-2 ms:py-2 ms:mb-2">
          <span className="ms:text-xs ms:font-medium ms:text-mstextmuted ms:uppercase ms:tracking-wide ms:select-none ms:py-1">
            Fields
          </span>
          {items.length > 0 && (
            <div className="ms:flex ms:items-center ms:gap-1">
              <button
                type="button"
                title="Expand all"
                className="ms:flex ms:items-center ms:gap-1 ms:px-2  ms:text-xs ms:text-mstextmuted ms:hover:text-mstext ms:rounded ms:hover:bg-msbackgroundhover ms:transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandAllVersion((v) => (v ?? 0) + 1);
                }}
              >
                <ViewBigIcon className="ms:w-3.5 ms:h-3.5" />
                Expand all
              </button>
              <button
                type="button"
                title="Collapse all"
                className="ms:flex ms:items-center ms:gap-1 ms:px-2 ms:py-1 ms:text-xs ms:text-mstextmuted ms:hover:text-mstext ms:rounded ms:hover:bg-msbackgroundhover ms:transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapseAllVersion((v) => (v ?? 0) + 1);
                }}
              >
                <ViewSmallIcon className="ms:w-3.5 ms:h-3.5" />
                Collapse all
              </button>
            </div>
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
          className="canvas-fields ms:space-y-0 ms:flex-1 ms:min-h-0 ms:overflow-y-auto"
          data-sortable-list={dragEnabled ? 'true' : undefined}
          data-parent-id=""
        >
          {items.map((id) => (
            <DraggableFieldItem
              key={id}
              id={id}
              form={form}
              ui={ui}
              dragEnabled={dragEnabled}
              isSelected={
                selectedFieldId === id && selectedFieldChildId === null
              }
              forceExpandVersion={
                sectionExpandSignal?.sectionId === id
                  ? sectionExpandSignal.version
                  : expandAllVersion
              }
              forceCollapseVersion={collapseAllVersion}
              nestedChildren={renderNestedChildren(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
