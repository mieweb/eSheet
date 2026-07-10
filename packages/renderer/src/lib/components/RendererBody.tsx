import React from 'react';
import type { FormStore, UIStore } from '@esheet/core';
import { FieldNode } from './FieldNode.js';

export interface RendererBodyProps {
  form: FormStore;
  ui: UIStore;
}

/**
 * RendererBody - Iterates over visible root fields and renders them
 *
 * Respects conditional visibility logic from form store.
 * Only renders fields where isVisible() returns true.
 * Sections and pages fields recursively render their visible children.
 * When multiple pages fields exist at root, shows a numbered navigation UI.
 */
export function RendererBody({ form, ui }: RendererBodyProps) {
  // Subscribe to form state for visibility updates and responses
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

  // Current page index — only used when there are multiple pages fields
  const [currentPagesIdx, setCurrentPagesIdx] = React.useState(0);

  // Compute visible root fields
  const visibleRootIds = React.useMemo(() => {
    const cache = new Map<string, boolean>();

    const isFieldRenderable = (fieldId: string): boolean => {
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

      // Non-container fields are renderable if visible
      if (
        node.definition.fieldType !== 'section' &&
        node.definition.fieldType !== 'pages'
      ) {
        cache.set(fieldId, true);
        return true;
      }

      // Sections and pages are renderable only if they have at least one renderable child
      const hasRenderableChild = node.childIds.some((childId) =>
        isFieldRenderable(childId)
      );
      cache.set(fieldId, hasRenderableChild);
      return hasRenderableChild;
    };

    return normalized.rootIds.filter((id) => isFieldRenderable(id));
  }, [form, normalized, responses]);

  // Separate pages fields from other root fields
  const { pagesIds, otherIds } = React.useMemo(() => {
    const pages: string[] = [];
    const others: string[] = [];
    for (const id of visibleRootIds) {
      if (normalized.byId[id]?.definition.fieldType === 'pages') {
        pages.push(id);
      } else {
        others.push(id);
      }
    }
    return { pagesIds: pages, otherIds: others };
  }, [visibleRootIds, normalized]);

  // Clamp index when pages are added or removed
  React.useEffect(() => {
    if (pagesIds.length > 0 && currentPagesIdx >= pagesIds.length) {
      setCurrentPagesIdx(pagesIds.length - 1);
    }
  }, [pagesIds.length, currentPagesIdx]);

  const isMultiPage = pagesIds.length > 1;
  const isFirst = currentPagesIdx === 0;
  const isLast = currentPagesIdx === pagesIds.length - 1;

  // Page labels — use the Pages field title if set, else "Page N"
  const pageLabels = React.useMemo(
    () =>
      pagesIds.map((id, i) => {
        const def = normalized.byId[id]?.definition;
        return (def as { title?: string })?.title || `Page ${i + 1}`;
      }),
    [pagesIds, normalized]
  );

  const handlePrev = React.useCallback(
    () => setCurrentPagesIdx((p) => Math.max(p - 1, 0)),
    []
  );
  const handleNext = React.useCallback(
    () => setCurrentPagesIdx((p) => Math.min(p + 1, pagesIds.length - 1)),
    [pagesIds.length]
  );

  return (
    <div className="canvas-fields renderer-body ms:space-y-0">
      {/* Non-pages fields always render normally */}
      {otherIds.map((id) => (
        <FieldNode key={id} id={id} form={form} ui={ui} />
      ))}

      {isMultiPage ? (
        <div className="pages-navigator ms:flex ms:flex-col ms:gap-0">
          {/* Navigation bar: ‹ [Page 1] [Page 2] … › + Prev / Next */}
          <div className="pages-nav ms:flex ms:items-center ms:justify-between ms:gap-2 ms:px-4 ms:py-3 ms:border-b ms:border-msborder ms:bg-mssurface ms:flex-wrap">
            <div className="ms:flex ms:items-center ms:gap-1 ms:flex-wrap">
              <button
                type="button"
                aria-label="Previous page"
                disabled={isFirst}
                onClick={handlePrev}
                className="ms:inline-flex ms:items-center ms:justify-center ms:h-8 ms:w-8 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer ms:shrink-0 ms:text-lg ms:leading-none"
              >
                ‹
              </button>
              {pageLabels.map((label, i) => (
                <button
                  key={pagesIds[i]}
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
                ›
              </button>
            </div>
            <span className="ms:text-xs ms:text-mstextmuted ms:shrink-0">
              {currentPagesIdx + 1} / {pagesIds.length}
            </span>
          </div>

          {/* Active page content */}
          <FieldNode
            key={pagesIds[currentPagesIdx]}
            id={pagesIds[currentPagesIdx]}
            form={form}
            ui={ui}
          />

          {/* Bottom Prev / Next row */}
          <div className="ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-3 ms:border-t ms:border-msborder">
            <button
              type="button"
              disabled={isFirst}
              onClick={handlePrev}
              className="ms:px-4 ms:py-2 ms:text-sm ms:font-medium ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer"
            >
              ← Previous
            </button>
            {!isLast ? (
              <button
                type="button"
                onClick={handleNext}
                className="ms:px-4 ms:py-2 ms:text-sm ms:font-medium ms:rounded-lg ms:border ms:border-transparent ms:bg-msprimary ms:text-white ms:transition-colors ms:hover:bg-msprimary/90 ms:outline-none ms:cursor-pointer"
              >
                Next →
              </button>
            ) : (
              <span className="ms:text-sm ms:text-mstextmuted ms:italic">
                Last page
              </span>
            )}
          </div>
        </div>
      ) : (
        // Single pages field or none — render normally
        pagesIds.map((id) => <FieldNode key={id} id={id} form={form} ui={ui} />)
      )}
    </div>
  );
}
