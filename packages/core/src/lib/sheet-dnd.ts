/// <reference lib="dom" />
/**
 * Sheet DnD — lightweight pointer-event-based drag-and-drop engine.
 *
 * Works on both mouse and touch. Provides:
 *   - Source dimming while dragging
 *   - A visible drop-indicator line at the insertion edge
 *   - Combine (drop into section) with outline highlight
 *   - Auto-scroll of the nearest scrollable ancestor near viewport edges
 *   - A custom `sheetdrop` event dispatched on drop
 *
 * Usage:
 *   1. Call `applySheetDnd(handle)` on each drag-handle element.
 *   2. Listen for `sheetdrop` on a common ancestor to perform the move.
 */

export interface SheetDndDropDetail {
  sourceId: string;
  targetId: string;
  edge: 'top' | 'bottom';
  operation: 'reorder' | 'combine';
}

interface ActiveDrag {
  source: HTMLElement;
  sourceId: string;
  pointerId: number;
  x: number;
  y: number;
  started: boolean;
  startX: number;
  startY: number;
  origDraggable: string | null;
  currentTarget: HTMLElement | null;
  currentEdge: 'top' | 'bottom' | null;
  currentOperation: 'reorder' | 'combine' | null;
  /** Section ancestor highlighted when dragging over a child inside it. */
  highlightedSection: HTMLElement | null;
  scrollContainer: Element | null;
  scrollRafId: number;
}

const DRAG_THRESHOLD = 8;
/** Distance (px) from viewport edge to start auto-scrolling. */
const SCROLL_ZONE = 60;
/** Max scroll speed (px per frame). */
const SCROLL_SPEED = 12;

// ---------------------------------------------------------------------------
// Shared drop indicator element (singleton, reused across all instances)
// ---------------------------------------------------------------------------

let indicator: HTMLElement | null = null;

function getIndicator(): HTMLElement {
  if (indicator) return indicator;
  indicator = document.createElement('div');
  indicator.className = 'sheet-dnd-indicator';
  const s = indicator.style;
  s.position = 'absolute';
  s.left = '0';
  s.right = '0';
  s.height = '2px';
  s.background = 'var(--ms-primary, #3b82f6)';
  s.borderRadius = '1px';
  s.zIndex = '9999';
  s.pointerEvents = 'none';
  s.display = 'none';
  document.body.appendChild(indicator);
  return indicator;
}

/** Check if a Y coordinate (viewport-relative) is within the visible area of any overflow ancestor. */
function isYVisible(el: HTMLElement, viewportY: number): boolean {
  let node: Element | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      const r = node.getBoundingClientRect();
      if (viewportY < r.top || viewportY > r.bottom) return false;
    }
    node = node.parentElement;
  }
  return true;
}

function showIndicator(target: HTMLElement, edge: 'top' | 'bottom') {
  const el = getIndicator();
  const rect = target.getBoundingClientRect();
  const lineY = edge === 'top' ? rect.top : rect.bottom;

  // Hide if the indicator line would be outside a clipped scroll container
  if (!isYVisible(target, lineY)) {
    el.style.display = 'none';
    return;
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  el.style.left = `${rect.left + scrollX}px`;
  el.style.width = `${rect.width}px`;
  el.style.top = `${lineY + scrollY - 1}px`;
  el.style.display = 'block';
}

function showCombineHighlight(target: HTMLElement) {
  target.style.outline = '2px solid var(--ms-primary, #3b82f6)';
  target.style.outlineOffset = '2px';
  target.style.borderRadius = '0.5rem';
}

function clearCombineHighlight(target: HTMLElement) {
  target.style.removeProperty('outline');
  target.style.removeProperty('outline-offset');
  target.style.removeProperty('border-radius');
}

function hideIndicator() {
  if (indicator) indicator.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findDropTarget(
  x: number,
  y: number,
  idAttr: string
): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  return (el as HTMLElement).closest?.(`[${idAttr}]`) ?? null;
}

function getEdge(el: HTMLElement, y: number): 'top' | 'bottom' {
  const rect = el.getBoundingClientRect();
  return y < rect.top + rect.height / 2 ? 'top' : 'bottom';
}

/**
 * Determine if the pointer is in the combine zone (center 50%) of a section,
 * or in the top/bottom reorder edges.
 */
function getOperation(
  el: HTMLElement,
  y: number
): { operation: 'reorder' | 'combine'; edge: 'top' | 'bottom' | null } {
  const isSection = el.getAttribute('data-field-type') === 'section';
  if (!isSection) {
    const edge = getEdge(el, y);
    return { operation: 'reorder', edge };
  }

  const rect = el.getBoundingClientRect();
  const edgeZone = rect.height * 0.25;
  if (y < rect.top + edgeZone) return { operation: 'reorder', edge: 'top' };
  if (y > rect.bottom - edgeZone) return { operation: 'reorder', edge: 'bottom' };
  return { operation: 'combine', edge: null };
}

/** Find the nearest scrollable ancestor. */
function findScrollParent(el: HTMLElement): Element | null {
  let node: Element | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/** Walk up from el to find a section wrapper that is NOT the el itself. */
function findSectionAncestor(
  el: HTMLElement,
  idAttr: string
): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    if (
      node.hasAttribute(idAttr) &&
      node.getAttribute('data-field-type') === 'section'
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sheet DnD
// ---------------------------------------------------------------------------

export function applySheetDnd(
  handle: HTMLElement,
  idAttr: string = 'data-field-id',
  onDragStart?: (sourceId: string) => void
): () => void {
  let active: ActiveDrag | null = null;

  function findSource(el: HTMLElement): HTMLElement | null {
    return el.closest<HTMLElement>(`[${idAttr}]`);
  }

  // --- Auto-scroll loop ---
  function tickScroll() {
    if (!active || !active.started) return;

    const { y, scrollContainer } = active;

    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect();
      if (y < rect.top + SCROLL_ZONE) {
        const ratio = 1 - (y - rect.top) / SCROLL_ZONE;
        scrollContainer.scrollBy(0, -SCROLL_SPEED * Math.max(0, ratio));
      } else if (y > rect.bottom - SCROLL_ZONE) {
        const ratio = 1 - (rect.bottom - y) / SCROLL_ZONE;
        scrollContainer.scrollBy(0, SCROLL_SPEED * Math.max(0, ratio));
      }
    } else {
      // Fallback: scroll the window
      const vh = window.innerHeight;
      if (y < SCROLL_ZONE) {
        const ratio = 1 - y / SCROLL_ZONE;
        window.scrollBy(0, -SCROLL_SPEED * ratio);
      } else if (y > vh - SCROLL_ZONE) {
        const ratio = 1 - (vh - y) / SCROLL_ZONE;
        window.scrollBy(0, SCROLL_SPEED * ratio);
      }
    }

    // Reposition indicator after scroll shifted the target in the viewport
    if (active.currentTarget) {
      if (active.currentOperation === 'combine') {
        showCombineHighlight(active.currentTarget);
      } else if (active.currentEdge) {
        showIndicator(active.currentTarget, active.currentEdge);
      }
    }
    if (active.highlightedSection) {
      showCombineHighlight(active.highlightedSection);
    }

    active.scrollRafId = requestAnimationFrame(tickScroll);
  }

  function startScroll() {
    if (!active) return;
    active.scrollRafId = requestAnimationFrame(tickScroll);
  }

  function stopScroll() {
    if (active?.scrollRafId) {
      cancelAnimationFrame(active.scrollRafId);
      active.scrollRafId = 0;
    }
  }

  // --- Pointer events ---
  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return;
    const source = findSource(handle);
    if (!source) return;
    const sourceId = source.getAttribute(idAttr);
    if (!sourceId) return;

    const origDraggable = source.getAttribute('draggable');
    source.setAttribute('draggable', 'false');

    active = {
      source,
      sourceId,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      started: false,
      startX: e.clientX,
      startY: e.clientY,
      origDraggable,
      currentTarget: null,
      currentEdge: null,
      currentOperation: null,
      highlightedSection: null,
      scrollContainer: findScrollParent(source),
      scrollRafId: 0,
    };

    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!active || e.pointerId !== active.pointerId) return;
    e.preventDefault();

    active.x = e.clientX;
    active.y = e.clientY;

    if (!active.started) {
      const dx = active.x - active.startX;
      const dy = active.y - active.startY;
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return;
      }
      active.started = true;
      active.source.style.opacity = '0.4';
      onDragStart?.(active.sourceId);
      startScroll();
    }

    // Find drop target (hide source from elementFromPoint)
    const prev = active.source.style.pointerEvents;
    active.source.style.pointerEvents = 'none';
    const target = findDropTarget(active.x, active.y, idAttr);
    active.source.style.pointerEvents = prev || '';

    const targetId = target?.getAttribute(idAttr) ?? null;

    if (target && targetId && targetId !== active.sourceId) {
      const { operation, edge } = getOperation(target, active.y);

      // Determine if we should highlight a section ancestor
      const sectionAncestor =
        operation === 'reorder' ? findSectionAncestor(target, idAttr) : null;
      // Only highlight section if source isn't already a child of it
      const shouldHighlightSection =
        sectionAncestor !== null &&
        findSectionAncestor(active.source, idAttr) !== sectionAncestor;

      if (
        target !== active.currentTarget ||
        edge !== active.currentEdge ||
        operation !== active.currentOperation
      ) {
        // Clear previous highlights
        if (active.currentTarget && active.currentOperation === 'combine') {
          clearCombineHighlight(active.currentTarget);
        }
        if (active.highlightedSection) {
          clearCombineHighlight(active.highlightedSection);
          active.highlightedSection = null;
        }
        hideIndicator();

        active.currentTarget = target;
        active.currentEdge = edge;
        active.currentOperation = operation;

        if (operation === 'combine') {
          showCombineHighlight(target);
        } else if (edge) {
          showIndicator(target, edge);
        }
      }

      // Update section ancestor highlight
      const newSection = shouldHighlightSection ? sectionAncestor : null;
      if (newSection !== active.highlightedSection) {
        if (active.highlightedSection) {
          clearCombineHighlight(active.highlightedSection);
        }
        active.highlightedSection = newSection;
        if (newSection) {
          showCombineHighlight(newSection);
        }
      }
    } else {
      if (active.currentTarget) {
        if (active.currentOperation === 'combine') {
          clearCombineHighlight(active.currentTarget);
        }
        active.currentTarget = null;
        active.currentEdge = null;
        active.currentOperation = null;
        hideIndicator();
      }
      if (active.highlightedSection) {
        clearCombineHighlight(active.highlightedSection);
        active.highlightedSection = null;
      }
    }
  }

  function cleanup() {
    if (!active) return;
    const { source, origDraggable } = active;

    stopScroll();
    if (active.currentTarget && active.currentOperation === 'combine') {
      clearCombineHighlight(active.currentTarget);
    }
    if (active.highlightedSection) {
      clearCombineHighlight(active.highlightedSection);
    }
    hideIndicator();

    source.style.removeProperty('opacity');
    source.style.removeProperty('pointer-events');

    if (origDraggable !== null) {
      source.setAttribute('draggable', origDraggable);
    } else {
      source.removeAttribute('draggable');
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!active || e.pointerId !== active.pointerId) return;
    if (handle.hasPointerCapture(e.pointerId)) {
      handle.releasePointerCapture(e.pointerId);
    }

    const { source, sourceId, started, x, y } = active;

    cleanup();

    if (!started) {
      active = null;
      return;
    }

    // Find drop target
    source.style.pointerEvents = 'none';
    const target = findDropTarget(x, y, idAttr);
    source.style.removeProperty('pointer-events');

    const targetId = target?.getAttribute(idAttr) ?? null;

    if (target && targetId && targetId !== sourceId) {
      const { operation, edge } = getOperation(target, y);
      const detail: SheetDndDropDetail = {
        sourceId,
        targetId,
        edge: edge ?? 'top',
        operation,
      };
      target.dispatchEvent(
        new CustomEvent('sheetdrop', { bubbles: true, detail })
      );
    }

    active = null;
  }

  function onPointerCancel(e: PointerEvent) {
    if (!active || e.pointerId !== active.pointerId) return;
    if (handle.hasPointerCapture(e.pointerId)) {
      handle.releasePointerCapture(e.pointerId);
    }
    cleanup();
    active = null;
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerCancel);

  return () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerUp);
    handle.removeEventListener('pointercancel', onPointerCancel);
    if (active) {
      cleanup();
      active = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Reorder index utility
// ---------------------------------------------------------------------------

/**
 * Compute the destination index when reordering items in a list.
 * Replaces `@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index`.
 */
export function getReorderDestinationIndex({
  startIndex,
  indexOfTarget,
  closestEdgeOfTarget,
}: {
  startIndex: number;
  indexOfTarget: number;
  closestEdgeOfTarget: 'top' | 'bottom' | null;
}): number {
  if (startIndex === -1 || indexOfTarget === -1) return startIndex;
  if (startIndex === indexOfTarget) return startIndex;
  if (closestEdgeOfTarget === null) return indexOfTarget;

  const isGoingAfter = closestEdgeOfTarget === 'bottom';
  const isMovingForward = startIndex < indexOfTarget;

  if (isMovingForward) return isGoingAfter ? indexOfTarget : indexOfTarget - 1;
  return isGoingAfter ? indexOfTarget + 1 : indexOfTarget;
}
