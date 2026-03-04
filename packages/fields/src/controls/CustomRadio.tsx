import React from 'react';

const noop = () => { /* controlled radio */ };

// ---------------------------------------------------------------------------
// Size presets
// ---------------------------------------------------------------------------

const SIZES = {
  sm: { outer: 20, inner: 10 },
  md: { outer: 24, inner: 12 },
  lg: { outer: 36, inner: 18 },
} as const;

type RadioSize = keyof typeof SIZES;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CustomRadioProps {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  onSelect?: (value: string) => void;
  onUnselect?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  size?: RadioSize;
  /** If true, only renders a hidden input (for button-style label UIs). */
  hidden?: boolean;
}

/**
 * Themed radio button with deselect support.
 *
 * Click a selected radio again to deselect — uses `onUnselect` callback.
 */
export const CustomRadio = React.memo(function CustomRadio({
  id,
  name,
  value,
  checked,
  onSelect,
  onUnselect,
  disabled = false,
  className = '',
  size = 'md',
  hidden: hiddenMode = false,
}: CustomRadioProps) {
  const lastCheckedRef = React.useRef(checked);
  React.useEffect(() => {
    lastCheckedRef.current = checked;
  }, [checked]);

  const handleClick = () => {
    if (disabled) return;
    if (lastCheckedRef.current) {
      onUnselect?.(value);
    } else {
      onSelect?.(value);
    }
  };

  const s = SIZES[size];

  if (hiddenMode) {
    return (
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onChange={noop}
        className={`ms:hidden ${className}`}
      />
    );
  }

  return (
    <label
      htmlFor={id}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      className={`custom-radio-wrapper ms:inline-flex ms:items-center ms:justify-center ms:cursor-pointer ${className}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={noop}
        className="ms:hidden"
      />
      <span
        className={`custom-radio-display ms:inline-flex ms:items-center ms:justify-center ms:rounded-full ms:border-2 ms:transition-all ms:pointer-events-none ms:shrink-0 ${
          checked
            ? 'ms:border-msprimary ms:bg-msprimary'
            : 'ms:border-msborderinactive ms:bg-mssurface'
        } ${disabled ? 'ms:opacity-50' : ''}`}
        style={{ width: s.outer, height: s.outer }}
        aria-hidden="true"
      >
        {checked && (
          <span
            className="custom-radio-dot ms:rounded-full ms:bg-mssurface"
            style={{ width: s.inner, height: s.inner }}
          />
        )}
      </span>
    </label>
  );
});
