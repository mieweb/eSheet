import { useState, useEffect, useCallback } from 'react';

const TOUCH_MODE_MEDIA_QUERY = '(max-width: 979px)';

export interface TouchModeConfig {
  /** Touch mode setting: true = always on, false = always off, 'auto' = media query based */
  mode?: boolean | 'auto';
  /** Called when touch mode changes */
  onChange?: (enabled: boolean) => void;
}

export interface TouchModeState {
  /** Whether touch mode is currently enabled */
  isTouchEnabled: boolean;
  /** Whether user has manually overridden auto mode */
  isManualOverride: boolean;
  /** Toggle touch mode on/off. Only works when mode is 'auto' or undefined. */
  setTouchMode: (enabled: boolean) => void;
  /** Reset to auto-detection mode (clears manual override). Only works when mode='auto'. */
  resetTouchMode: () => void;
}

/**
 * Hook to manage touch mode state with auto-detection support.
 *
 * @param config - Configuration object
 * @returns Touch mode state and control methods
 *
 * @example
 * ```tsx
 * const { isTouchEnabled, setTouchMode, resetTouchMode } = useTouchMode({
 *   mode: 'auto',
 *   onChange: (enabled) => console.log('Touch mode:', enabled),
 * });
 * ```
 */
export function useTouchMode(config: TouchModeConfig = {}): TouchModeState {
  const { mode, onChange } = config;

  const [isTouchEnabled, setIsTouchEnabled] = useState(() => {
    if (mode === true) return true;
    if (mode === false) return false;
    // Auto-detect for 'auto' mode or undefined (default)
    if (typeof window !== 'undefined') {
      return window.matchMedia(TOUCH_MODE_MEDIA_QUERY).matches;
    }
    return false;
  });

  const [isManualOverride, setIsManualOverride] = useState(false);

  // Listen for viewport changes when mode is 'auto' or undefined (but not if manually overridden)
  useEffect(() => {
    if (mode === true || mode === false) return;
    if (typeof window === 'undefined') return;
    if (isManualOverride) return;

    const mediaQuery = window.matchMedia(TOUCH_MODE_MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsTouchEnabled(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode, isManualOverride]);

  // Notify consumer when touch mode changes
  useEffect(() => {
    onChange?.(isTouchEnabled);
  }, [isTouchEnabled, onChange]);

  const setTouchMode = useCallback(
    (enabled: boolean) => {
      // Only allow manual toggle when not explicitly set to true/false
      if (mode === true || mode === false) return;
      setIsManualOverride(true);
      setIsTouchEnabled(enabled);
    },
    [mode]
  );

  const resetTouchMode = useCallback(() => {
    // Reset only works for 'auto' or undefined mode
    if (mode === true || mode === false) return;
    setIsManualOverride(false);
    if (typeof window !== 'undefined') {
      setIsTouchEnabled(window.matchMedia(TOUCH_MODE_MEDIA_QUERY).matches);
    }
  }, [mode]);

  return {
    isTouchEnabled,
    isManualOverride,
    setTouchMode,
    resetTouchMode,
  };
}
