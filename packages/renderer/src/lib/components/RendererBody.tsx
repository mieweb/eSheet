import React from 'react';
import type { FormStore, UIStore } from '@esheet/core';
import { PageNavigator } from '@esheet/fields';
import { FieldNode } from './FieldNode.js';

export interface RendererBodyProps {
  form: FormStore;
  ui: UIStore;
}

/**
 * RendererBody - Iterates over pages and renders visible fields.
 *
 * Single-page forms render fields directly.
 * Multi-page forms use PageNavigator for bottom-only Prev / X of Y / Next navigation.
 */
export function RendererBody({ form, ui }: RendererBodyProps) {
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

  const isMultiPage = pages.length > 1;

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

  const fields = visibleFieldIds.map((id) => (
    <FieldNode key={id} id={id} form={form} ui={ui} />
  ));

  if (!isMultiPage) {
    return (
      <div className="canvas-fields renderer-body ms:space-y-0">{fields}</div>
    );
  }

  return (
    <PageNavigator
      currentIdx={currentPagesIdx}
      total={pages.length}
      onPrev={handlePrev}
      onNext={handleNext}
    >
      <div className="canvas-fields renderer-body ms:space-y-0 ms:px-0">
        {fields}
      </div>
    </PageNavigator>
  );
}
