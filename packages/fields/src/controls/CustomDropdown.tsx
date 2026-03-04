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
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export function CustomDropdown(props: CustomDropdownProps) {
  const {
    options = [],
    placeholder = 'Select an option',
    showClearOption = true,
    maxHeight = 'ms:max-h-60',
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
    const selectedOptions = options.filter((opt) => selectedIds.includes(opt.id));
    const availableOptions = options.filter(
      (opt) => !selectedIds.includes(opt.id),
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
        className="custom-dropdown custom-dropdown-multi ms:relative ms:w-full ms:overflow-visible"
      >
        <div
          className={`custom-dropdown-trigger ms:w-full ms:min-h-10 ms:px-3 ms:py-2 ms:shadow ms:border ms:border-msborder ms:rounded-lg ms:cursor-pointer ms:bg-mssurface ms:flex ms:flex-wrap ms:gap-2 ms:items-center ms:hover:border-msprimary/50 ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:transition-colors ${
            disabled
              ? 'ms:opacity-50 ms:cursor-not-allowed ms:bg-msbackground ms:border-msborder'
              : ''
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          {selectedOptions.length === 0 ? (
            <span className="ms:text-mstextmuted">{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.id}
                className="custom-dropdown-selected-pill ms:inline-flex ms:items-center ms:gap-1 ms:px-3 ms:py-1 ms:bg-msprimary ms:text-mstextsecondary ms:rounded ms:text-sm"
              >
                {option.value}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(option.id);
                  }}
                  className="custom-dropdown-remove-btn ms:flex ms:items-center ms:justify-center ms:bg-transparent ms:text-mstextsecondary ms:hover:bg-msprimary/80 ms:rounded ms:border-0 ms:outline-none ms:focus:outline-none"
                  aria-label={`Remove ${option.value}`}
                >
                  <CloseIcon className="ms:w-4 ms:h-4" />
                </button>
              </span>
            ))
          )}
          <ChevronIcon
            className={`ms:w-5 ms:h-5 ms:ml-auto ms:transition-transform ms:shrink-0 ms:text-mstextmuted ${
              isOpen ? 'ms:rotate-180' : ''
            }`}
          />
        </div>

        {isOpen && availableOptions.length > 0 && (
          <div
            className={`custom-dropdown-menu ms:absolute ms:z-50 ms:w-full ms:mt-1 ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-lg ${maxHeight} ms:overflow-y-auto`}
          >
            {availableOptions.map((option) => (
              <div
                key={option.id}
                className="custom-dropdown-option ms:px-4 ms:py-2 ms:text-mstext ms:hover:bg-msprimary/10 ms:cursor-pointer ms:transition-colors"
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
      className="custom-dropdown custom-dropdown-single ms:relative ms:w-full ms:overflow-visible"
    >
      <div
        className={`custom-dropdown-trigger ms:w-full ms:px-4 ms:py-2 ms:h-10 ms:shadow ms:border ms:border-msborder ms:rounded-lg ms:cursor-pointer ms:bg-mssurface ms:flex ms:items-center ms:justify-between ms:hover:border-msprimary/50 ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:transition-colors ${
          disabled
            ? 'ms:opacity-50 ms:cursor-not-allowed ms:bg-msbackground ms:border-msborder'
            : ''
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span
          className={`custom-dropdown-value-text ms:truncate ms:min-w-0 ${
            selectedOption ? 'ms:text-mstext' : 'ms:text-mstextmuted'
          }`}
        >
          {selectedOption ? selectedOption.value : placeholder}
        </span>
        <ChevronIcon
          className={`custom-dropdown-arrow ms:w-5 ms:h-5 ms:transition-transform ms:shrink-0 ms:text-mstextmuted ${
            isOpen ? 'ms:rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && options.length > 0 && (
        <div
          className={`custom-dropdown-menu ms:absolute ms:z-50 ms:w-full ms:mt-1 ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-lg ${maxHeight} ms:overflow-y-auto`}
        >
          {showClearOption && (
            <div
              className="custom-dropdown-clear-option ms:px-4 ms:py-2 ms:text-mstext ms:hover:bg-msprimary/10 ms:cursor-pointer ms:transition-colors"
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
              className={`custom-dropdown-option ms:px-4 ms:py-2 ms:hover:bg-msprimary/10 ms:cursor-pointer ms:transition-colors ${
                value === option.id
                  ? 'ms:bg-msprimary/20 ms:text-msprimary'
                  : 'ms:text-mstext'
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
