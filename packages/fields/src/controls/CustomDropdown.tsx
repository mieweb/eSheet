import { useState, useRef, useEffect, useLayoutEffect } from 'react';

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

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

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
    maxHeight = '240px',
    isMulti = false,
    disabled = false,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

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

  // Reposition after every render while open (handles trigger height changes from pill wrapping).
  // Guard: only call setMenuPos when the computed position actually differs to avoid infinite loops.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const next = calcPosition(triggerRef.current);
    setMenuPos((prev) => {
      if (
        prev &&
        prev.top === next.top &&
        prev.bottom === next.bottom &&
        prev.left === next.left &&
        prev.width === next.width
      ) {
        return prev;
      }
      return next;
    });
  });

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (triggerRef.current) setMenuPos(calcPosition(triggerRef.current));
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      setMenuPos(calcPosition(triggerRef.current));
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div ref={dropdownRef} className="custom-dropdown ms:relative ms:w-full">
      {isMulti ? renderMulti() : renderSingle()}

      {isOpen && menuPos && (
        <div
          style={{
            position: 'fixed',
            top: menuPos.top !== undefined ? menuPos.top : undefined,
            bottom: menuPos.bottom !== undefined ? menuPos.bottom : undefined,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: maxHeight,
            zIndex: 9999,
            overflowY: 'auto',
          }}
          className="custom-dropdown-menu ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-lg"
        >
          {renderMenuContents()}
        </div>
      )}
    </div>
  );

  function renderMulti() {
    const value = (props as MultiSelectProps).value;
    const onChange = (props as MultiSelectProps).onChange;
    const selectedIds = Array.isArray(value) ? value : [];
    const selectedOptions = options.filter((opt) =>
      selectedIds.includes(opt.id)
    );

    const handleRemove = (optionId: string) => {
      onChange(selectedIds.filter((id) => id !== optionId));
    };

    return (
      <div
        ref={triggerRef}
        className={`custom-dropdown-trigger ms:w-full ms:min-h-10 ms:px-3 ms:py-2 ms:shadow ms:border ms:border-msborder ms:rounded-lg ms:cursor-pointer ms:bg-mssurface ms:flex ms:flex-wrap ms:gap-2 ms:items-center ms:hover:border-msprimary/50 ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:transition-colors ${
          disabled
            ? 'ms:opacity-50 ms:cursor-not-allowed ms:bg-msbackground ms:border-msborder'
            : ''
        }`}
        onClick={handleOpen}
      >
        {selectedOptions.length === 0 ? (
          <span className="ms:text-mstextmuted">{placeholder}</span>
        ) : (
          selectedOptions.map((option) => (
            <span
              key={option.id}
              className="custom-dropdown-selected-pill ms:inline-flex ms:items-center ms:gap-1 ms:px-3 ms:py-1 ms:bg-msprimary-active ms:text-mstextsecondary ms:rounded ms:text-sm"
            >
              {option.value}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(option.id);
                }}
                className="custom-dropdown-remove-btn ms:flex ms:items-center ms:justify-center ms:bg-transparent ms:text-mstextsecondary ms:hover:bg-msprimary-active/80 ms:rounded ms:border-0 ms:outline-none ms:focus:outline-none"
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
    );
  }

  function renderSingle() {
    const value = (props as SingleSelectProps).value;
    const selectedOption = options.find((opt) => opt.id === value);

    return (
      <div
        ref={triggerRef}
        className={`custom-dropdown-trigger ms:w-full ms:px-4 ms:py-2 ms:h-10 ms:shadow ms:border ms:border-msborder ms:rounded-lg ms:cursor-pointer ms:bg-mssurface ms:flex ms:items-center ms:justify-between ms:hover:border-msprimary/50 ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:transition-colors ${
          disabled
            ? 'ms:opacity-50 ms:cursor-not-allowed ms:bg-msbackground ms:border-msborder'
            : ''
        }`}
        onClick={handleOpen}
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
    );
  }

  function renderMenuContents() {
    if (isMulti) {
      const value = (props as MultiSelectProps).value;
      const onChange = (props as MultiSelectProps).onChange;
      const selectedIds = Array.isArray(value) ? value : [];
      const availableOptions = options.filter(
        (opt) => !selectedIds.includes(opt.id)
      );

      const handleSelect = (optionId: string) => {
        onChange([...selectedIds, optionId]);
      };

      if (availableOptions.length === 0) {
        return (
          <div
            className="custom-dropdown-clear-all ms:px-4 ms:py-2 ms:text-mstext ms:hover:bg-msprimary/10 ms:cursor-pointer ms:transition-colors"
            onClick={() => {
              onChange([]);
              setIsOpen(false);
            }}
          >
            Clear all
          </div>
        );
      }

      return availableOptions.map((option) => (
        <div
          key={option.id}
          className="custom-dropdown-option ms:px-4 ms:py-2 ms:text-mstext ms:hover:bg-msprimary/10 ms:cursor-pointer ms:transition-colors"
          onClick={() => handleSelect(option.id)}
        >
          {option.value}
        </div>
      ));
    }

    // Single select
    const value = (props as SingleSelectProps).value;
    const onChange = (props as SingleSelectProps).onChange;

    const handleSelect = (optionId: string) => {
      onChange(optionId);
      setIsOpen(false);
    };

    return (
      <>
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
      </>
    );
  }
}

function calcPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove = spaceBelow < 200;
  return openAbove
    ? {
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
      }
    : { top: rect.bottom + 4, left: rect.left, width: rect.width };
}
