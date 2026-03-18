import React from 'react';
import type { FieldComponentProps, FormStore, UIStore } from '@msheet/core';
import {
  applySheetDnd,
  getReorderDestinationIndex,
  type SheetDndDropDetail,
} from '@msheet/core';
import { useVisibleFields } from '../hooks/useVisibleFields.js';
import { FieldWrapper } from './FieldWrapper.js';
import { FieldItem } from './FieldItem.js';
import { getFieldComponent } from '../component-registry.js';

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
  isActiveChild = false,
  forceExpandVersion,
  nestedChildren,
}: {
  id: string;
  form: FormStore;
  ui: UIStore;
  parentId?: string;
  dragEnabled: boolean;
  isActiveChild?: boolean;
  forceExpandVersion?: number;
  nestedChildren?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const handleRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !dragEnabled) return;

    const dragHandleEl = handleRef.current ?? el;

    return applySheetDnd(dragHandleEl as HTMLElement, undefined, (sourceId) => {
      if (parentId) {
        ui.getState().selectFieldChild(parentId, sourceId);
      } else {
        ui.getState().selectField(sourceId);
      }
    });
  }, [dragEnabled, id, parentId]);

  const handleSelectOverride = React.useCallback(
    (e: React.MouseEvent) => {
      if (!parentId) return;
      e.stopPropagation();
      ui.getState().selectFieldChild(parentId, id);
    },
    [id, parentId, ui]
  );

  return (
    <div ref={ref} className="field-canvas-wrapper ms:relative">
      <FieldWrapper
        fieldId={id}
        form={form}
        ui={ui}
        dragHandleRef={handleRef}
        forceExpandVersion={forceExpandVersion}
        isSelectedOverride={parentId ? isActiveChild : undefined}
        onSelectOverride={parentId ? handleSelectOverride : undefined}
        selectedVariant={parentId ? 'nested' : 'default'}
      >
        {(props) => {
          const Component =
            getFieldComponent(props.field.definition.fieldType) ?? FieldItem;
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
  const rootIds = useVisibleFields(form, ui);
  const normalized = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().normalized,
    () => form.getState().normalized
  );
  const mode = React.useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().mode,
    () => ui.getState().mode
  );
  const responses = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().responses,
    () => form.getState().responses
  );
  const selectedFieldId = React.useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId
  );
  const selectedFieldChildId = React.useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldChildId,
    () => ui.getState().selectedFieldChildId
  );
  const [sectionExpandSignal, setSectionExpandSignal] = React.useState<{
    sectionId: string;
    version: number;
  } | null>(null);

  // Sheet DnD drop handler — unified for mouse and touch
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el || !dragEnabled) return;

    const handler = (e: Event) => {
      const { sourceId, targetId, edge, operation } = (
        e as CustomEvent<SheetDndDropDetail>
      ).detail;
      const sourceNode = normalized.byId[sourceId];
      const targetNode = normalized.byId[targetId];
      if (!sourceNode || !targetNode) return;

      // Drop into section (combine)
      if (operation === 'combine') {
        if (targetNode.definition.fieldType !== 'section') return;
        const children = targetNode.childIds.filter((cid) => cid !== sourceId);
        form.getState().moveField(sourceId, children.length, targetId);
        setSectionExpandSignal((prev) => ({
          sectionId: targetId,
          version: (prev?.version ?? 0) + 1,
        }));
        return;
      }

      // Reorder
      const sourceParentId = sourceNode.parentId;
      const targetParentId = targetNode.parentId;
      const siblingIds = targetParentId
        ? normalized.byId[targetParentId]?.childIds ?? []
        : [...normalized.rootIds];

      const startIndex = siblingIds.indexOf(sourceId);
      const targetIndex = siblingIds.indexOf(targetId);
      const isSameParent = sourceParentId === targetParentId;

      if (isSameParent && startIndex !== -1 && targetIndex !== -1) {
        const destinationIndex = getReorderDestinationIndex({
          startIndex,
          indexOfTarget: targetIndex,
          closestEdgeOfTarget: edge,
        });
        form.getState().moveField(sourceId, destinationIndex, targetParentId);
      } else {
        const siblingsWithoutSource = siblingIds.filter(
          (cid) => cid !== sourceId
        );
        const overIdx = siblingsWithoutSource.indexOf(targetId);
        const newIndex =
          overIdx === -1
            ? siblingsWithoutSource.length
            : edge === 'top'
            ? overIdx
            : overIdx + 1;
        form.getState().moveField(sourceId, newIndex, targetParentId);
      }

      if (
        targetParentId !== null &&
        normalized.byId[targetParentId]?.definition.fieldType === 'section'
      ) {
        setSectionExpandSignal((prev) => ({
          sectionId: targetParentId,
          version: (prev?.version ?? 0) + 1,
        }));
      }
    };

    el.addEventListener('sheetdrop', handler);
    return () => el.removeEventListener('sheetdrop', handler);
  }, [dragEnabled, form, normalized]);

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
      const childIds = getVisibleChildIds(parentId);
      if (childIds.length === 0) return null;

      const containerClass =
        depth === 1
          ? 'section-children ms:space-y-2'
          : 'section-children ms:space-y-2 ms:border-l ms:border-msborder ms:pl-3';

      return (
        <div className={containerClass} data-depth={depth}>
          {childIds.map((childId) => (
            <DraggableFieldItem
              key={childId}
              id={childId}
              form={form}
              ui={ui}
              parentId={parentId}
              dragEnabled={dragEnabled}
              isActiveChild={
                selectedFieldId === parentId && selectedFieldChildId === childId
              }
              forceExpandVersion={
                sectionExpandSignal?.sectionId === childId
                  ? sectionExpandSignal.version
                  : undefined
              }
              nestedChildren={renderNestedChildren(childId, depth + 1)}
            />
          ))}
        </div>
      );
    },
    [
      dragEnabled,
      form,
      getVisibleChildIds,
      sectionExpandSignal,
      selectedFieldChildId,
      selectedFieldId,
      ui,
    ]
  );

  // Clear selection when clicking canvas background
  const handleCanvasClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        ui.getState().selectField(null);
      }
    },
    [ui]
  );

  // Clear selection on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ui.getState().selectField(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ui]);

  if (items.length === 0) {
    return (
      <div
        className="canvas-empty ms:flex ms:items-center ms:justify-center ms:min-h-[200px] ms:text-mstextmuted ms:text-sm"
        onClick={handleCanvasClick}
      >
        No fields yet. Add a field from the Tool Panel to get started.
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="canvas-fields ms:space-y-0"
      onClick={handleCanvasClick}
    >
      {items.map((id) => (
        <DraggableFieldItem
          key={id}
          id={id}
          form={form}
          ui={ui}
          dragEnabled={dragEnabled}
          forceExpandVersion={
            sectionExpandSignal?.sectionId === id
              ? sectionExpandSignal.version
              : undefined
          }
          nestedChildren={renderNestedChildren(id)}
        />
      ))}
    </div>
  );
});
