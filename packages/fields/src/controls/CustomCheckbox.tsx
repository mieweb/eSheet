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
        className={`ms:hidden ${className}`}
      />
    );
  }

  return (
    <label
      htmlFor={id}
      onClick={(e) => e.stopPropagation()}
      className={`custom-checkbox-wrapper ms:inline-flex ms:items-center ms:justify-center ms:cursor-pointer ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(!checked)}
        className="ms:hidden"
      />
      <span
        className={`custom-checkbox-display ms:inline-flex ms:items-center ms:justify-center ms:rounded ms:border-2 ms:transition-all ms:pointer-events-none ms:shrink-0 ${
          checked
            ? 'ms:border-msprimary ms:bg-msprimary'
            : 'ms:border-msborderinactive ms:bg-mssurface'
        } ${disabled ? 'ms:opacity-50' : ''}`}
        style={{
          width: s.outer,
          height: s.outer,
          minWidth: s.outer,
          minHeight: s.outer,
        }}
        aria-hidden="true"
      >
        <svg
          className="custom-checkbox-checkmark ms:text-mssurface"
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
