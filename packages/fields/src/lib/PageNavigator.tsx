import React from 'react';

export interface PageNavigatorProps {
  children: React.ReactNode;
  currentIdx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * PageNavigator — wraps a page's content and renders a bottom navigation bar.
 *
 * Used in both the renderer and the builder's preview mode so both surfaces
 * share identical navigation UX.
 *
 * Layout: [← Previous]  [currentIdx + 1 / total]  [Next →]
 * The Next button is replaced with "Last page" text on the final page.
 * The Previous button is disabled (not hidden) on the first page.
 */
export function PageNavigator({
  children,
  currentIdx,
  total,
  onPrev,
  onNext,
}: PageNavigatorProps) {
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === total - 1;

  return (
    <div className="pages-navigator ms:flex ms:flex-col ms:flex-1 ms:min-h-0">
      <div className="ms:flex-1 ms:min-h-0 ms:overflow-y-auto">{children}</div>
      <div className="pages-nav-footer ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-3 ms:bg-mssurface ms:shrink-0">
        <button
          type="button"
          disabled={isFirst}
          onClick={onPrev}
          className="ms:px-4 ms:py-2 ms:text-sm ms:font-medium ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:transition-colors ms:hover:bg-msbackgroundhover ms:disabled:opacity-40 ms:disabled:cursor-not-allowed ms:outline-none ms:cursor-pointer"
        >
          {'\u2190'} Previous
        </button>
        <span className="ms:text-sm ms:text-mstextmuted ms:tabular-nums">
          {currentIdx + 1} / {total}
        </span>
        {!isLast ? (
          <button
            type="button"
            onClick={onNext}
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
  );
}
