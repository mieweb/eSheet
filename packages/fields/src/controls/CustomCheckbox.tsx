import React from 'react';

// ---------------------------------------------------------------------------
// Size presets
// ---------------------------------------------------------------------------

const SIZES = {
  sm: { outer: 20, inner: 12 },
  md: { outer: 24, inner: 16 },
  lg: { outer: 36, inner: 24 },
} as const;

type CheckboxSize = keyof typeof SIZES;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CustomCheckboxProps {
  id: string;
  name?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: CheckboxSize;
  /** If true, only renders a hidden input (for button-style label UIs). */
  hidden?: boolean;
}

/**
 * Themed checkbox with custom square + checkmark SVG.
 */
export const CustomCheckbox = React.memo(function CustomCheckbox({
  id,
  name,
  checked,
  onChange,
  disabled = false,
  className = '',
  size = 'md',
  hidden: hiddenMode = false,
}: CustomCheckboxProps) {
  const s = SIZES[size];

  if (hiddenMode) {
    return (
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(!checked)}
        className={`es:hidden ${className}`}
      />
    );
  }

  return (
    <label
      htmlFor={id}
      onClick={(e) => e.stopPropagation()}
      className={`custom-checkbox-wrapper es:inline-flex es:items-center es:justify-center es:cursor-pointer ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(!checked)}
        className="es:hidden"
      />
      <span
        className={`custom-checkbox-display es:inline-flex es:items-center es:justify-center es:rounded es:border-2 es:transition-all es:pointer-events-none es:shrink-0 ${
          checked
            ? 'es:border-esprimary es:bg-esprimary'
            : 'es:border-esborderinactive es:bg-essurface'
        } ${disabled ? 'es:opacity-50' : ''}`}
        style={{
          width: s.outer,
          height: s.outer,
          minWidth: s.outer,
          minHeight: s.outer,
        }}
        aria-hidden="true"
      >
        <svg
          className="custom-checkbox-checkmark es:text-essurface"
          style={{ width: s.inner, height: s.inner, opacity: checked ? 1 : 0 }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </span>
    </label>
  );
});
