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
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { FormStore, UIStore } from '@msheet/core';
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
}: {
  id: string;
  form: FormStore;
  ui: UIStore;
  collapseWhileDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 10 } : undefined),
  };

  return (
    <div ref={setNodeRef} style={style}>
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
          const Component = getFieldComponent(props.field.definition.fieldType) ?? FieldItem;
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
export const Canvas = React.memo(function Canvas({ form, ui, dragEnabled = true }: CanvasProps) {
  const rootIds = useVisibleFields(form);
  // Convert readonly array to mutable array for SortableContext
  const items = React.useMemo(() => [...rootIds], [rootIds]);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

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

  const handleDragCancel = React.useCallback(
    (_event: DragCancelEvent) => {
      setActiveDragId(null);
    },
    []
  );

  // Clear selection when clicking canvas background
  const handleCanvasClick = React.useCallback((e: React.MouseEvent) => {
    // Only clear if clicking directly on the canvas, not on a field
    if (e.target === e.currentTarget) {
      ui.getState().selectField(null);
    }
  }, [ui]);

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
