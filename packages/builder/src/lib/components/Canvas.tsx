import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import type { FieldComponentProps, FormStore, UIStore } from '@msheet/core';
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

/**
 * SortableFieldItem - A sortable wrapper for a field item.
 */
function SortableFieldItem({
  id,
  form,
  ui,
  collapseWhileDragging = false,
  nestedChildren,
}: {
  id: string;
  form: FormStore;
  ui: UIStore;
  collapseWhileDragging?: boolean;
  nestedChildren?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 10 } : undefined),
  };

  return (
    <div className='field-canvas-wrapper' ref={setNodeRef} style={style}>
      <FieldWrapper
        fieldId={id}
        form={form}
        ui={ui}
        dragHandleProps={attributes}
        dragListeners={listeners}
        isDragging={isDragging}
        collapseWhileDragging={collapseWhileDragging}
      >
        {(props) => {
          const Component =
            getFieldComponent(props.field.definition.fieldType) ?? FieldItem;
          if (props.field.definition.fieldType === 'section') {
            const SectionComponent =
              Component as React.ComponentType<
                FieldComponentProps & { nestedChildren?: React.ReactNode }
              >;
            return <SectionComponent {...props} nestedChildren={nestedChildren} />;
          }
          return <Component {...props} />;
        }}
      </FieldWrapper>
    </div>
  );
}

function PlainFieldItem({
  id,
  form,
  ui,
  parentId,
  isActiveChild = false,
  collapseWhileDragging = false,
}: {
  id: string;
  form: FormStore;
  ui: UIStore;
  parentId?: string;
  isActiveChild?: boolean;
  collapseWhileDragging?: boolean;
}) {
  const handleSelectOverride = React.useCallback(
    (e: React.MouseEvent) => {
      if (!parentId) return;
      e.stopPropagation();
      ui.getState().selectFieldChild(parentId, id);
    },
    [id, parentId, ui]
  );

  return (
    <div className="field-canvas-wrapper section-child-wrapper">
      <FieldWrapper
        fieldId={id}
        form={form}
        ui={ui}
        collapseWhileDragging={collapseWhileDragging}
        isSelectedOverride={parentId ? isActiveChild : undefined}
        onSelectOverride={parentId ? handleSelectOverride : undefined}
        selectedVariant={parentId ? 'nested' : 'default'}
      >
        {(props) => {
          const Component =
            getFieldComponent(props.field.definition.fieldType) ?? FieldItem;
          return <Component {...props} />;
        }}
      </FieldWrapper>
    </div>
  );
}

/**
 * Canvas - The main field list panel with drag-and-drop support.
 *
 * Displays all root-level fields in a sortable vertical list.
 * Uses @dnd-kit for drag-and-drop reordering.
 */
export const Canvas = React.memo(function Canvas({
  form,
  ui,
  dragEnabled = true,
}: CanvasProps) {
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
  // Convert readonly array to mutable array for SortableContext
  const items = React.useMemo(() => [...rootIds], [rootIds]);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

  const getVisibleChildIds = React.useCallback(
    (parentId: string): readonly string[] => {
      const parent = normalized.byId[parentId];
      if (!parent || parent.childIds.length === 0) return [];
      if (mode !== 'preview') return parent.childIds;
      return parent.childIds.filter((childId) => form.getState().isVisible(childId));
    },
    [form, mode, normalized]
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
            <React.Fragment key={childId}>
              <PlainFieldItem
                id={childId}
                form={form}
                ui={ui}
                parentId={parentId}
                isActiveChild={
                  selectedFieldId === parentId &&
                  selectedFieldChildId === childId
                }
                collapseWhileDragging={activeDragId !== null}
              />
              {renderNestedChildren(childId, depth + 1)}
            </React.Fragment>
          ))}
        </div>
      );
    },
    [activeDragId, form, getVisibleChildIds, selectedFieldId, selectedFieldChildId, ui]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      setActiveDragId(event.active.id as string);
      // Select the field being dragged
      ui.getState().selectField(event.active.id as string);
    },
    [ui]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          // Move to root level at the new index
          form.getState().moveField(active.id as string, newIndex, null);
        }
      }
    },
    [form, items]
  );

  const handleDragCancel = React.useCallback((_event: DragCancelEvent) => {
    setActiveDragId(null);
  }, []);

  // Clear selection when clicking canvas background
  const handleCanvasClick = React.useCallback(
    (e: React.MouseEvent) => {
      // Only clear if clicking directly on the canvas, not on a field
      if (e.target === e.currentTarget) {
        ui.getState().selectField(null);
      }
    },
    [ui]
  );

  // Handle empty state
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

  const fieldList = (
    <div className="canvas-fields ms:space-y-0" onClick={handleCanvasClick}>
      {items.map((id) => (
        <SortableFieldItem
          key={id}
          id={id}
          form={form}
          ui={ui}
          collapseWhileDragging={activeDragId !== null}
          nestedChildren={renderNestedChildren(id)}
        />
      ))}
    </div>
  );

  if (!dragEnabled) {
    return fieldList;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {fieldList}
      </SortableContext>
    </DndContext>
  );
});
