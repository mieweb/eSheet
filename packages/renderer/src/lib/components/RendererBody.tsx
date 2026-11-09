import React from 'react';
import type { CollabDecorations, FormStore, UIStore } from '@esheet/core';
import { FieldGrid, PageNavigator } from '@esheet/fields';
import { FieldNode } from './FieldNode.js';

function hasPendingInputErrors(form: FormStore): boolean {
  return form
    .getState()
    .getErrors()
    .some((error) => error.rule === 'input');
}

export interface RendererBodyProps {
  form: FormStore;
  ui: UIStore;
  /** Optional host-supplied collaboration decorations (see EsheetRendererProps). */
  collab?: CollabDecorations;
  /** Show page tabs above the active page. */
  topNavigation?: boolean;
  /** Show Previous / Next controls below the active page. */
  bottomNavigation?: boolean;
  /** Block forward navigation when required fields on the current page are unanswered. */
  validateNavigation?: boolean;
  /** Hands the host page routing; `false` for unknown pages or pending invalid drafts. */
  registerGoToPage?: (goToPage: (pageId: string) => boolean) => void;
  /** Page shown first, by id. Unknown or absent falls back to the first page. */
  initialPageId?: string;
  /**
   * Fires when the user changes pages (tab click, prev/next) — never on the
   * initial seed and never for programmatic `setCurrentPage`/`goToPage`.
   */
  onPageChange?: (pageId: string, pageIndex: number) => void;
  /** Hands the host the current-page accessors backing the renderer handle. */
  registerPageNavigation?: (api: RendererPageNavigation) => void;
}

/** What `EsheetRendererHandle` exposes for page routing (issue #147). */
export interface RendererPageNavigation {
  /** The active page's id, or `null` before any pages exist. */
  getCurrentPageId: () => string | null;
  /** Show a page by id or index. Unknown pages and pending invalid drafts do not navigate. */
  setCurrentPage: (pageIdOrIndex: string | number) => void;
}

/**
 * RendererBody - Iterates over pages and renders visible fields.
 *
 * Single-page forms render fields directly.
 * Multi-page forms use PageNavigator for optional top tabs and bottom navigation.
 */
export function RendererBody({
  form,
  ui,
  collab,
  topNavigation = false,
  bottomNavigation = true,
  validateNavigation = true,
  registerGoToPage,
  initialPageId,
  onPageChange,
  registerPageNavigation,
}: RendererBodyProps) {
  const normalized = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().normalized,
    () => form.getState().normalized
  );
  const responses = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().responses,
    () => form.getState().responses
  );

  const [currentPagesIdx, setCurrentPagesIdx] = React.useState(0);
  const hasInputErrors = React.useSyncExternalStore(
    form.subscribe,
    () => hasPendingInputErrors(form),
    () => hasPendingInputErrors(form)
  );

  const pages = normalized.pages;

  // Fresh references for the registered accessors, which outlive renders.
  const pagesRef = React.useRef(pages);
  pagesRef.current = pages;
  const currentIdxRef = React.useRef(currentPagesIdx);
  currentIdxRef.current = currentPagesIdx;
  const onPageChangeRef = React.useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const trySetPage = React.useCallback(
    (index: number) => {
      if (index !== currentIdxRef.current && hasPendingInputErrors(form))
        return false;
      setCurrentPagesIdx(index);
      return true;
    },
    [form]
  );

  // The definition loads after mount, so the seed waits for pages to exist —
  // once. Unknown id stays on the first page; no onPageChange either way.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current || pages.length === 0) return;
    seededRef.current = true;
    if (!initialPageId) return;
    const index = pages.findIndex((page) => page.id === initialPageId);
    if (index > 0) setCurrentPagesIdx(index);
  }, [pages, initialPageId]);

  React.useEffect(() => {
    if (pages.length > 0 && currentPagesIdx >= pages.length) {
      setCurrentPagesIdx(pages.length - 1);
    }
  }, [pages.length, currentPagesIdx]);

  React.useEffect(() => {
    registerGoToPage?.((pageId) => {
      const index = pagesRef.current.findIndex((page) => page.id === pageId);
      if (index < 0) return false;
      return trySetPage(index);
    });
  }, [registerGoToPage, trySetPage]);

  React.useEffect(() => {
    registerPageNavigation?.({
      getCurrentPageId: () =>
        pagesRef.current[currentIdxRef.current]?.id ?? null,
      setCurrentPage: (pageIdOrIndex) => {
        const index =
          typeof pageIdOrIndex === 'number'
            ? pageIdOrIndex
            : pagesRef.current.findIndex((page) => page.id === pageIdOrIndex);
        if (index < 0 || index >= pagesRef.current.length) return;
        // Already current is a no-op by construction: programmatic moves
        // never fire onPageChange, so there is no loop to guard beyond this.
        trySetPage(index);
      },
    });
  }, [registerPageNavigation, trySetPage]);

  const isMultiPage = pages.length > 1;
  const hasPageNavigation = topNavigation || bottomNavigation;

  // User navigation — and only user navigation — reports the change.
  const navigateTo = React.useCallback(
    (index: number) => {
      const pageList = pagesRef.current;
      const clamped = Math.min(Math.max(index, 0), pageList.length - 1);
      if (clamped === currentIdxRef.current || !trySetPage(clamped)) return;
      const page = pageList[clamped];
      if (page) onPageChangeRef.current?.(page.id, clamped);
    },
    [trySetPage]
  );
  const handlePrev = React.useCallback(
    () => navigateTo(currentIdxRef.current - 1),
    [navigateTo]
  );
  const handleNext = React.useCallback(
    () => navigateTo(currentIdxRef.current + 1),
    [navigateTo]
  );

  const visibleFieldIds = React.useMemo(() => {
    const page = pages[currentPagesIdx];
    if (!page) return [];
    return page.fieldIds.filter((id) => form.getState().isVisible(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pages, currentPagesIdx, responses]);

  /**
   * Count of hard-required visible leaf fields on the current page that have
   * no response. Sections are traversed to find their required children.
   * Uses getFieldErrors() — the same validation path as form submit.
   */
  const unfilledRequiredCount = React.useMemo(() => {
    const { normalized } = form.getState();
    let count = 0;
    const walk = (ids: readonly string[]) => {
      for (const id of ids) {
        const node = normalized.byId[id];
        if (!node) continue;
        if (node.definition.fieldType === 'section') {
          walk(node.childIds);
        } else {
          const errors = form.getState().getFieldErrors(id);
          if (
            errors.some((e) => e.severity === 'hard' && e.rule === 'required')
          ) {
            count += 1;
          }
        }
      }
    };
    const page = pages[currentPagesIdx];
    if (page) walk(page.fieldIds);
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pages, currentPagesIdx, responses]);

  const fields = visibleFieldIds.map((id) => (
    <FieldNode key={id} id={id} form={form} ui={ui} collab={collab} />
  ));

  if (!isMultiPage || !hasPageNavigation) {
    return (
      <FieldGrid
        className="canvas-fields renderer-body"
        stackedClassName="ms:space-y-2 ms:lg:space-y-3"
      >
        {fields}
      </FieldGrid>
    );
  }

  return (
    <PageNavigator
      currentIdx={currentPagesIdx}
      total={pages.length}
      pageTitles={pages.map(
        (page, index) => page.title?.trim() || `Sheet ${index + 1}`
      )}
      onPrev={handlePrev}
      onNext={handleNext}
      onPageChange={navigateTo}
      blockedCount={unfilledRequiredCount}
      topNavigation={topNavigation}
      bottomNavigation={bottomNavigation}
      validateNavigation={validateNavigation}
    >
      {hasInputErrors && (
        <div
          role="alert"
          className="renderer-input-error ms:px-4 ms:py-2 ms:text-msdanger ms:text-sm"
        >
          Complete or clear invalid entries before changing pages.
        </div>
      )}
      <FieldGrid
        className="canvas-fields renderer-body ms:px-0"
        stackedClassName="ms:space-y-2 ms:lg:space-y-3"
      >
        {fields}
      </FieldGrid>
    </PageNavigator>
  );
}
