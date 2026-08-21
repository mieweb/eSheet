import React from 'react';
import type { CollabDecorations, FormStore, UIStore } from '@esheet/core';
import { FieldGrid, PageNavigator } from '@esheet/fields';
import { FieldNode } from './FieldNode.js';

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
  /** Hands the host a way to jump to a page by id; `false` when there is no such page. */
  registerGoToPage?: (goToPage: (pageId: string) => boolean) => void;
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

  const pages = normalized.pages;

  React.useEffect(() => {
    if (pages.length > 0 && currentPagesIdx >= pages.length) {
      setCurrentPagesIdx(pages.length - 1);
    }
  }, [pages.length, currentPagesIdx]);

  React.useEffect(() => {
    registerGoToPage?.((pageId) => {
      const index = pages.findIndex((page) => page.id === pageId);
      if (index < 0) return false;
      setCurrentPagesIdx(index);
      return true;
    });
  }, [pages, registerGoToPage]);

  const isMultiPage = pages.length > 1;
  const hasPageNavigation = topNavigation || bottomNavigation;

  const handlePrev = React.useCallback(
    () => setCurrentPagesIdx((p) => Math.max(p - 1, 0)),
    []
  );
  const handleNext = React.useCallback(
    () => setCurrentPagesIdx((p) => Math.min(p + 1, pages.length - 1)),
    [pages.length]
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
      onPageChange={setCurrentPagesIdx}
      blockedCount={unfilledRequiredCount}
      topNavigation={topNavigation}
      bottomNavigation={bottomNavigation}
      validateNavigation={validateNavigation}
    >
      <FieldGrid
        className="canvas-fields renderer-body ms:px-0"
        stackedClassName="ms:space-y-2 ms:lg:space-y-3"
      >
        {fields}
      </FieldGrid>
    </PageNavigator>
  );
}
