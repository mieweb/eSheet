import { useState, useRef, useEffect } from 'react';

interface DropdownOption {
  readonly id: string;
  value: string;
}

/* ── Single-select props ── */
interface SingleSelectProps {
  options: readonly DropdownOption[];
  value: string | null;
  onChange: (selectedId: string | null) => void;
  placeholder?: string;
  showClearOption?: boolean;
  maxHeight?: string;
  isMulti?: false;
  disabled?: boolean;
}

/* ── Multi-select props ── */
interface MultiSelectProps {
  options: readonly DropdownOption[];
  value: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  showClearOption?: boolean;
  maxHeight?: string;
  isMulti: true;
  disabled?: boolean;
}

type CustomDropdownProps = SingleSelectProps | MultiSelectProps;

// Inline SVG icons
const ChevronIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export function CustomDropdown(props: CustomDropdownProps) {
  const {
    options = [],
    placeholder = 'Select an option',
    showClearOption = true,
    maxHeight = 'es:max-h-60',
    isMulti = false,
    disabled = false,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isMulti) {
    const value = (props as MultiSelectProps).value;
    const onChange = (props as MultiSelectProps).onChange;
    const selectedIds = Array.isArray(value) ? value : [];
    const selectedOptions = options.filter((opt) =>
      selectedIds.includes(opt.id)
    );
    const availableOptions = options.filter(
      (opt) => !selectedIds.includes(opt.id)
    );

    const handleSelect = (optionId: string) => {
      if (selectedIds.includes(optionId)) {
        onChange(selectedIds.filter((id) => id !== optionId));
      } else {
        onChange([...selectedIds, optionId]);
      }
    };

    const handleRemove = (optionId: string) => {
      onChange(selectedIds.filter((id) => id !== optionId));
    };

    return (
      <div
        ref={dropdownRef}
        className="custom-dropdown custom-dropdown-multi es:relative es:w-full es:overflow-visible"
      >
        <div
          className={`custom-dropdown-trigger es:w-full es:min-h-10 es:px-3 es:py-2 es:shadow es:border es:border-esborder es:rounded-lg es:cursor-pointer es:bg-essurface es:flex es:flex-wrap es:gap-2 es:items-center es:hover:border-esprimary/50 es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary es:transition-colors ${
            disabled
              ? 'es:opacity-50 es:cursor-not-allowed es:bg-esbackground es:border-esborder'
              : ''
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          {selectedOptions.length === 0 ? (
            <span className="es:text-estextmuted">{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.id}
                className="custom-dropdown-selected-pill es:inline-flex es:items-center es:gap-1 es:px-3 es:py-1 es:bg-esprimary es:text-estextsecondary es:rounded es:text-sm"
              >
                {option.value}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(option.id);
                  }}
                  className="custom-dropdown-remove-btn es:flex es:items-center es:justify-center es:bg-transparent es:text-estextsecondary es:hover:bg-esprimary/80 es:rounded es:border-0 es:outline-none es:focus:outline-none"
                  aria-label={`Remove ${option.value}`}
                >
                  <CloseIcon className="es:w-4 es:h-4" />
                </button>
              </span>
            ))
          )}
          <ChevronIcon
            className={`es:w-5 es:h-5 es:ml-auto es:transition-transform es:shrink-0 es:text-estextmuted ${
              isOpen ? 'es:rotate-180' : ''
            }`}
          />
        </div>

        {isOpen && availableOptions.length > 0 && (
          <div
            className={`custom-dropdown-menu es:absolute es:z-50 es:w-full es:mt-1 es:bg-essurface es:border es:border-esborder es:rounded-lg es:shadow-lg ${maxHeight} es:overflow-y-auto`}
          >
            {availableOptions.map((option) => (
              <div
                key={option.id}
                className="custom-dropdown-option es:px-4 es:py-2 es:text-estext es:hover:bg-esprimary/10 es:cursor-pointer es:transition-colors"
                onClick={() => handleSelect(option.id)}
              >
                {option.value}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ────────── Single Select ──────────
  const value = (props as SingleSelectProps).value;
  const onChange = (props as SingleSelectProps).onChange;
  const selectedOption = options.find((opt) => opt.id === value);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className="custom-dropdown custom-dropdown-single es:relative es:w-full es:overflow-visible"
    >
      <div
        className={`custom-dropdown-trigger es:w-full es:px-4 es:py-2 es:h-10 es:shadow es:border es:border-esborder es:rounded-lg es:cursor-pointer es:bg-essurface es:flex es:items-center es:justify-between es:hover:border-esprimary/50 es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary es:transition-colors ${
          disabled
            ? 'es:opacity-50 es:cursor-not-allowed es:bg-esbackground es:border-esborder'
            : ''
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span
          className={`custom-dropdown-value-text es:truncate es:min-w-0 ${
            selectedOption ? 'es:text-estext' : 'es:text-estextmuted'
          }`}
        >
          {selectedOption ? selectedOption.value : placeholder}
        </span>
        <ChevronIcon
          className={`custom-dropdown-arrow es:w-5 es:h-5 es:transition-transform es:shrink-0 es:text-estextmuted ${
            isOpen ? 'es:rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && options.length > 0 && (
        <div
          className={`custom-dropdown-menu es:absolute es:z-50 es:w-full es:mt-1 es:bg-essurface es:border es:border-esborder es:rounded-lg es:shadow-lg ${maxHeight} es:overflow-y-auto`}
        >
          {showClearOption && (
            <div
              className="custom-dropdown-clear-option es:px-4 es:py-2 es:text-estext es:hover:bg-esprimary/10 es:cursor-pointer es:transition-colors"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
            >
              Clear selection
            </div>
          )}
          {options.map((option) => (
            <div
              key={option.id}
              className={`custom-dropdown-option es:px-4 es:py-2 es:hover:bg-esprimary/10 es:cursor-pointer es:transition-colors ${
                value === option.id
                  ? 'es:bg-esprimary/20 es:text-esprimary'
                  : 'es:text-estext'
              }`}
              onClick={() => handleSelect(option.id)}
            >
              {option.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
