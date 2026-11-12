'use client';

import * as React from 'react';

const hiddenStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  visibility: 'hidden',
  zIndex: 9999,
  transition: 'none',
};

export function useAnchoredPosition<
  TAnchor extends HTMLElement,
  TFloating extends HTMLElement
>({
  open,
  placement = 'bottom-start',
  offset = 4,
  matchWidth = false,
  matchMinWidth = false,
  viewportPadding = 8,
  maxHeight,
}: {
  open: boolean;
  placement?:
    | 'bottom-start'
    | 'bottom-end'
    | 'bottom'
    | 'top-start'
    | 'top-end'
    | 'top';
  offset?: number;
  matchWidth?: boolean;
  matchMinWidth?: boolean;
  viewportPadding?: number;
  maxHeight?: number;
}) {
  const anchorRef = React.useRef<TAnchor | null>(null);
  const floatingRef = React.useRef<TFloating | null>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>(hiddenStyle);

  const update = React.useCallback(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;

    const bounds = anchor.getBoundingClientRect();
    const contentHeight = Math.min(
      floating.scrollHeight,
      maxHeight ?? Infinity
    );
    const floatingWidth = matchWidth
      ? bounds.width
      : Math.max(floating.offsetWidth, matchMinWidth ? bounds.width : 0);
    const spaceBelow =
      window.innerHeight - bounds.bottom - offset - viewportPadding;
    const spaceAbove = bounds.top - offset - viewportPadding;
    const preferTop = placement.startsWith('top');
    const side = preferTop
      ? spaceAbove < contentHeight && spaceBelow > spaceAbove
        ? 'bottom'
        : 'top'
      : spaceBelow < contentHeight && spaceAbove > spaceBelow
      ? 'top'
      : 'bottom';
    const availableHeight = Math.max(
      side === 'top' ? spaceAbove : spaceBelow,
      0
    );
    const alignment = placement.endsWith('-start')
      ? 'left'
      : placement.endsWith('-end')
      ? 'right'
      : 'center';
    let left =
      alignment === 'left'
        ? bounds.left
        : alignment === 'right'
        ? bounds.right - floatingWidth
        : bounds.left + bounds.width / 2 - floatingWidth / 2;
    left = Math.min(
      Math.max(left, viewportPadding),
      Math.max(
        window.innerWidth - floatingWidth - viewportPadding,
        viewportPadding
      )
    );

    setStyle({
      position: 'fixed',
      left,
      ...(side === 'top'
        ? { bottom: window.innerHeight - bounds.top + offset }
        : { top: bounds.bottom + offset }),
      ...(matchWidth ? { width: bounds.width } : {}),
      ...(matchMinWidth ? { minWidth: bounds.width } : {}),
      maxHeight: Math.min(availableHeight, maxHeight ?? Infinity),
      zIndex: 9999,
      transition: 'none',
    });
  }, [
    matchMinWidth,
    matchWidth,
    maxHeight,
    offset,
    placement,
    viewportPadding,
  ]);

  React.useLayoutEffect(() => {
    if (open) update();
    else setStyle(hiddenStyle);
  }, [open, update]);

  React.useEffect(() => {
    if (!open) return;
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    window.addEventListener('scroll', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(scheduleUpdate);
    if (anchorRef.current) resizeObserver?.observe(anchorRef.current);
    if (floatingRef.current) resizeObserver?.observe(floatingRef.current);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [open, update]);

  return { anchorRef, floatingRef, style, update };
}
