import React from 'react';
import type { FormStore, UIStore } from '@esheet/core';
import { FieldNode } from './FieldNode.js';

export interface RendererBodyProps {
  form: FormStore;
  ui: UIStore;
}

/**
 * RendererBody - Iterates over pages and renders visible fields.
 *
 * Respects conditional visibility logic from form store.
 * For single-page forms, renders all visible fields on the page.
 * For multi-page forms, shows a numbered navigation UI.
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
  const isFirst = currentPagesIdx === 0;
  const isLast = currentPagesIdx === pages.length - 1;

  const pageLabels = React.useMemo(
    () => pages.map((p, i) => p.title || `Page ${i + 1}`),
    [pages]
  );

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

  const activePage = pages[currentPagesIdx];

  return (
    <div className="canvas-fields renderer-body ms:space-y-0">
      {isMultiPage ? (
        <div className="pages-navigator ms:flex ms:flex-col ms:gap-0">
          <div className="pages-nav ms:flex ms:items-center ms:justify-between ms:gap-2 ms:px-4 ms:py-3 ms:border-b ms:border-msborder ms:bg-mssurface ms:flex-wrap">
            <div className="ms:flex ms:items-center ms:gap-1 ms:flex-wrap">
              <button
                type="button"
                aria-label="Previous page"
                disabled={isFirst}
                onClick={handlePrev}
                className="ms:inline-flex ms:items-center ms:justify-center ms:h-8 ms:w-8 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer ms:shrink-0 ms:text-lg ms:leading-none"
              >
                {'\u2039'}
              </button>
              {pageLabels.map((label, i) => (
                <button
                  key={pages[i].id}
                  type="button"
                  aria-label={`Go to ${label}`}
                  aria-current={i === currentPagesIdx ? 'page' : undefined}
                  onClick={() => setCurrentPagesIdx(i)}
                  className={`ms:inline-flex ms:items-center ms:justify-center ms:min-w-[2rem] ms:h-8 ms:px-2.5 ms:rounded ms:border ms:text-sm ms:font-medium ms:transition-colors ms:outline-none ms:cursor-pointer ms:shrink-0 ${
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
                disabled={isLast}
                onClick={handleNext}
                className="ms:inline-flex ms:items-center ms:justify-center ms:h-8 ms:w-8 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer ms:shrink-0 ms:text-lg ms:leading-none"
              >
                {'\u203a'}
              </button>
            </div>
            <span className="ms:text-xs ms:text-mstextmuted ms:shrink-0">
              {currentPagesIdx + 1} / {pages.length}
            </span>
          </div>

          {activePage &&
            visibleFieldIds.map((id) => (
              <FieldNode key={id} id={id} form={form} ui={ui} />
            ))}

          <div className="ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-3 ms:border-t ms:border-msborder">
            <button
              type="button"
              disabled={isFirst}
              onClick={handlePrev}
              className="ms:px-4 ms:py-2 ms:text-sm ms:font-medium ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer"
            >
              {'\u2190'} Previous
            </button>
            {!isLast ? (
              <button
                type="button"
                onClick={handleNext}
                className="ms:px-4 ms:py-2 ms:text-sm ms:font-medium ms:rounded-lg ms:border ms:border-transparent ms:bg-msprimary ms:text-white ms:transition-colors ms:hover:bg-msprimary/90 ms:outline-none ms:cursor-pointer"
              >
                Next {'\u2192'}
              </button>
            ) : (
              <span className="ms:text-sm ms:text-mstextmuted ms:italic">
                Last page
              </span>
            )}
          </div>
        </div>
      ) : (
        visibleFieldIds.map((id) => (
          <FieldNode key={id} id={id} form={form} ui={ui} />
        ))
      )}
    </div>
  );
}
