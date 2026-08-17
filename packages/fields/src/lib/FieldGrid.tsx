import React from 'react';
import { getFieldTypeMeta, type FieldWidth } from '@esheet/core';

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  alignItems: 'start',
};

const STACK_MEDIA_QUERY = '(max-width: 900px)';

const FieldGridContext = React.createContext(false);

export function useFieldGridLayout(): boolean {
  return React.useContext(FieldGridContext);
}

function useIsNarrowGrid(): boolean {
  const getMatches = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(STACK_MEDIA_QUERY).matches;

  const [isNarrow, setIsNarrow] = React.useState(getMatches);

  React.useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const mediaQuery = window.matchMedia(STACK_MEDIA_QUERY);
    const handler = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isNarrow;
}

export interface FieldGridProps extends React.ComponentPropsWithoutRef<'div'> {
  enabled?: boolean;
  stackedClassName?: string;
}

export const FieldGrid = React.forwardRef<HTMLDivElement, FieldGridProps>(
  function FieldGrid(
    { children, className, enabled = true, stackedClassName, style, ...props },
    ref
  ) {
    const isNarrowGrid = useIsNarrowGrid();
    const useGridLayout = enabled && !isNarrowGrid;
    const containerClassName = [
      className,
      useGridLayout ? 'ms:gap-3' : stackedClassName,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <FieldGridContext.Provider value={useGridLayout}>
        <div
          {...props}
          ref={ref}
          className={containerClassName}
          style={useGridLayout ? { ...style, ...GRID_STYLE } : style}
        >
          {children}
        </div>
      </FieldGridContext.Provider>
    );
  }
);

export interface FieldGridItemProps {
  children: React.ReactElement<{ style?: React.CSSProperties }>;
  fieldType: string;
  width?: FieldWidth;
  inheritedWidth?: FieldWidth;
}

export function FieldGridItem({
  children,
  fieldType,
  width,
  inheritedWidth,
}: FieldGridItemProps) {
  const useGridLayout = useFieldGridLayout();
  if (!useGridLayout) return children;

  if (fieldType === 'section' || fieldType === 'pages') {
    return React.cloneElement(children, {
      style: { ...children.props.style, gridColumn: 'span 6' },
    });
  }

  const defaultWidth = getFieldTypeMeta(fieldType)?.defaultProps.width as
    | FieldWidth
    | undefined;
  const effectiveWidth = inheritedWidth ?? width ?? defaultWidth ?? 'full';

  const columnSpan =
    effectiveWidth === 'half' ? 3 : effectiveWidth === 'third' ? 2 : 6;

  return React.cloneElement(children, {
    style: { ...children.props.style, gridColumn: `span ${columnSpan}` },
  });
}
