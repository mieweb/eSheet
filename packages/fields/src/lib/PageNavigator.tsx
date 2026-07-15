import React from 'react';

export interface PageNavigatorProps {
  children: React.ReactNode;
  currentIdx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** Number of unfilled hard-required fields on the current page. Blocks Next when > 0. */
  blockedCount?: number;
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
 * When blockedCount > 0, clicking Next shows an inline error instead of advancing.
 */
export function PageNavigator({
  children,
  currentIdx,
  total,
  onPrev,
  onNext,
  blockedCount = 0,
}: PageNavigatorProps) {
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === total - 1;
  const [showError, setShowError] = React.useState(false);

  // Clear the error banner whenever the page changes or the required-field count changes.
  React.useEffect(() => {
    setShowError(false);
  }, [currentIdx, blockedCount]);

  const handleNext = () => {
    if (blockedCount > 0) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onNext();
  };

  const handlePrev = () => {
    setShowError(false);
    onPrev();
  };

  return (
    <div className="pages-navigator ms:flex ms:flex-col ms:flex-1 ms:min-h-0">
      <div className="ms:flex-1 ms:min-h-0 ms:overflow-y-auto">{children}</div>
      {showError && blockedCount > 0 && (
        <div
          role="alert"
          className="ms:px-4 ms:py-2 ms:bg-msdanger/10 ms:border-t ms:border-msdanger/30 ms:text-msdanger ms:text-sm ms:text-center"
        >
          Please answer{' '}
          {blockedCount === 1
            ? '1 required field'
            : `${blockedCount} required fields`}{' '}
          before continuing.
        </div>
      )}
      <div className="pages-nav-footer ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-3 ms:shrink-0">
        <button
          type="button"
          disabled={isFirst}
          onClick={handlePrev}
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
            onClick={handleNext}
            className={`ms:px-4 ms:py-2 ms:text-sm ms:font-medium ms:rounded-lg ms:border ms:border-transparent ms:bg-msprimary ms:text-white ms:transition-colors ms:hover:bg-msprimary/90 ms:outline-none ms:cursor-pointer${
              showError && blockedCount > 0
                ? ' ms:outline ms:outline-2 ms:outline-msdanger'
                : ''
            }`}
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
