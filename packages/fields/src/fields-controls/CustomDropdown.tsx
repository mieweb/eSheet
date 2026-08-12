import {
  useState,
  useRef,
  useEffect,
  useId,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { useAnchoredPosition } from '@mieweb/ui';

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
    maxHeight = 'ms:max-h-60',
    isMulti = false,
    disabled = false,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const listboxId = `custom-dropdown-listbox-${useId().replace(/:/g, '')}`;
  const multiOptionCount = props.isMulti ? options.length : 0;
  const { anchorRef, floatingRef, style } = useAnchoredPosition<
    HTMLDivElement,
    HTMLDivElement
  >({
    open: isOpen,
    placement: 'bottom-start',
    offset: 4,
    matchWidth: true,
    viewportPadding: 8,
  });

  const closeDropdown = (restoreFocus = false) => {
    setIsOpen(false);
    setFocusedOptionIndex(0);
    if (restoreFocus) {
      anchorRef.current?.focus();
    }
  };

  const openDropdown = (initialIndex = 0) => {
    if (disabled) return;
    setFocusedOptionIndex(initialIndex);
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeDropdown(true);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        closeDropdown();
      } else {
        openDropdown();
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown(event.key === 'ArrowUp' ? multiOptionCount - 1 : 0);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !floatingRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedOptionIndex(0);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [floatingRef]);

  useEffect(() => {
    if (!isOpen || !props.isMulti || multiOptionCount === 0) return;

    const boundedIndex = Math.min(
      Math.max(focusedOptionIndex, 0),
      multiOptionCount - 1
    );
    if (boundedIndex !== focusedOptionIndex) {
      setFocusedOptionIndex(boundedIndex);
      return;
    }
    optionRefs.current[boundedIndex]?.focus();
  }, [focusedOptionIndex, isOpen, multiOptionCount, props.isMulti]);

  const renderMenu = (content: ReactNode, isMultiSelect = false) => {
    if (!isOpen || options.length === 0) return null;

    return createPortal(
      <div
        ref={floatingRef}
        style={style}
        id={listboxId}
        role="listbox"
        aria-label={placeholder}
        aria-multiselectable={isMultiSelect || undefined}
        className={`custom-dropdown-menu ms:z-50 ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-lg ms:p-1 ${maxHeight} ms:overflow-y-auto`}
      >
        {content}
      </div>,
      document.body
    );
  };

  if (isMulti) {
    const value = (props as MultiSelectProps).value;
    const onChange = (props as MultiSelectProps).onChange;
    const selectedIds = Array.isArray(value) ? value : [];
    const selectedOptions = options.filter((opt) =>
      selectedIds.includes(opt.id)
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
          ref={anchorRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={placeholder}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-disabled={disabled || undefined}
          className={`custom-dropdown-trigger ms:w-full ms:min-h-[38px] ms:px-3 ms:py-2 ms:text-sm ms:shadow ms:border ms:border-msborder ms:rounded-lg ms:cursor-pointer ms:bg-mssurface ms:flex ms:gap-2 ms:items-start ms:hover:border-msprimary/50 ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:transition-colors ${
            disabled
              ? 'ms:opacity-50 ms:cursor-not-allowed ms:bg-msbackground ms:border-msborder'
              : ''
          }`}
          onClick={() => {
            if (disabled) return;
            if (isOpen) closeDropdown();
            else openDropdown();
          }}
          onKeyDown={handleTriggerKeyDown}
        >
          <div className="ms:flex ms:min-w-0 ms:flex-1 ms:flex-wrap ms:items-center ms:gap-1">
            {selectedOptions.length === 0 ? (
              <span className="ms:min-w-0 ms:truncate ms:text-mstextmuted">
                {placeholder}
              </span>
            ) : (
              selectedOptions.map((option) => (
                <span
                  key={option.id}
                  className="custom-dropdown-selected-pill ms:inline-flex ms:min-w-0 ms:max-w-full ms:items-center ms:gap-0.5 ms:px-1.5 ms:py-0.5 ms:bg-msprimary ms:text-mstextsecondary ms:rounded ms:text-xs"
                >
                  <span className="ms:min-w-0 ms:flex-1 ms:truncate">
                    {option.value}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(option.id);
                    }}
                    className="custom-dropdown-remove-btn ms:flex ms:shrink-0 ms:items-center ms:justify-center ms:bg-transparent ms:text-mstextsecondary ms:hover:bg-msprimary/80 ms:rounded ms:border-0 ms:outline-none ms:focus:outline-none"
                    aria-label={`Remove ${option.value}`}
                  >
                    <CloseIcon className="ms:w-3 ms:h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <ChevronIcon
            className={`ms:w-4 ms:h-4 ms:shrink-0 ms:transition-transform ms:text-mstextmuted ${
              isOpen ? 'ms:rotate-180' : ''
            }`}
          />
        </div>

        {renderMenu(
          options.map((option, optionIndex) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <div
                key={option.id}
                ref={(element) => {
                  optionRefs.current[optionIndex] = element;
                }}
                role="option"
                tabIndex={optionIndex === focusedOptionIndex ? 0 : -1}
                aria-selected={isSelected}
                className={`custom-dropdown-option ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:rounded-md ms:cursor-pointer ms:text-sm ms:transition-colors ms:hover:bg-msbackgroundhover ms:focus:bg-msbackgroundhover ms:focus:outline-none ${
                  isSelected ? 'ms:text-msprimary' : 'ms:text-mstext'
                }`}
                onMouseEnter={() => setFocusedOptionIndex(optionIndex)}
                onClick={() => {
                  setFocusedOptionIndex(optionIndex);
                  handleSelect(option.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setFocusedOptionIndex((currentIndex) => {
                      const direction = event.key === 'ArrowDown' ? 1 : -1;
                      return (
                        (currentIndex + direction + options.length) %
                        options.length
                      );
                    });
                  } else if (event.key === 'Home') {
                    event.preventDefault();
                    setFocusedOptionIndex(0);
                  } else if (event.key === 'End') {
                    event.preventDefault();
                    setFocusedOptionIndex(options.length - 1);
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelect(option.id);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeDropdown(true);
                  }
                }}
              >
                <span className="ms:min-w-0 ms:flex-1 ms:truncate">
                  {option.value}
                </span>
                {isSelected && (
                  <Check
                    aria-hidden="true"
                    className="ms:h-4 ms:w-4 ms:shrink-0 ms:text-msprimary"
                    strokeWidth={2}
                  />
                )}
              </div>
            );
          }),
          true
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
        ref={anchorRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-disabled={disabled || undefined}
        className={`custom-dropdown-trigger ms:w-full ms:min-h-[38px] ms:px-4 ms:py-2 ms:text-sm ms:shadow ms:border ms:border-msborder ms:rounded-lg ms:cursor-pointer ms:bg-mssurface ms:flex ms:items-center ms:justify-between ms:hover:border-msprimary/50 ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:transition-colors ${
          disabled
            ? 'ms:opacity-50 ms:cursor-not-allowed ms:bg-msbackground ms:border-msborder'
            : ''
        }`}
        onClick={() => {
          if (disabled) return;
          if (isOpen) closeDropdown();
          else openDropdown();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          className={`custom-dropdown-value-text ms:truncate ms:min-w-0 ${
            selectedOption ? 'ms:text-mstext' : 'ms:text-mstextmuted'
          }`}
        >
          {selectedOption ? selectedOption.value : placeholder}
        </span>
        <ChevronIcon
          className={`custom-dropdown-arrow ms:w-4 ms:h-4 ms:transition-transform ms:shrink-0 ms:text-mstextmuted ${
            isOpen ? 'ms:rotate-180' : ''
          }`}
        />
      </div>

      {renderMenu(
        <>
          {showClearOption && (
            <div
              role="option"
              aria-selected={!value}
              className="custom-dropdown-clear-option ms:px-4 ms:py-2 ms:text-sm ms:text-mstext ms:hover:bg-msbackgroundhover ms:focus:bg-msbackgroundhover ms:cursor-pointer ms:transition-colors ms:focus:outline-none"
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
              role="option"
              aria-selected={value === option.id}
              className={`custom-dropdown-option ms:px-4 ms:py-2 ms:text-sm ms:cursor-pointer ms:transition-colors ms:focus:outline-none ${
                value === option.id
                  ? 'ms:bg-msprimary/20 ms:text-msprimary'
                  : 'ms:text-mstext ms:hover:bg-msbackgroundhover ms:focus:bg-msbackgroundhover'
              }`}
              onClick={() => handleSelect(option.id)}
            >
              {option.value}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
