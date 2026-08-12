import React, { type ReactNode } from 'react';

const noop = () => {};

export interface CustomRadioButtonProps {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  children: ReactNode;
  onSelect?: (value: string) => void;
  onUnselect?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const CustomRadioButton = React.memo(function CustomRadioButton({
  id,
  name,
  value,
  checked,
  children,
  onSelect,
  onUnselect,
  disabled = false,
  className = '',
}: CustomRadioButtonProps) {
  const handleClick = () => {
    if (disabled) return;
    if (checked) {
      onUnselect?.(value);
    } else {
      onSelect?.(value);
    }
  };

  return (
    <label
      htmlFor={id}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handleClick();
      }}
      className={`ms:flex ms:min-h-[38px] ms:max-w-full ms:cursor-pointer ms:select-none ms:items-center ms:justify-start ms:rounded-lg ms:border ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:outline-none ms:transition-colors ms:focus-within:ring-2 ms:focus-within:ring-msprimary/30 ${
        checked
          ? 'ms:border-msprimary ms:bg-msprimary ms:text-mstextsecondary ms:shadow-sm'
          : 'ms:border-msborder ms:bg-mssurface ms:text-mstext ms:hover:border-msprimary/50 ms:hover:bg-msprimary/15'
      } ${disabled ? 'ms:cursor-not-allowed ms:opacity-50' : ''} ${className}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={noop}
        className="ms:sr-only"
      />
      <span className="ms:min-w-0 ms:break-words ms:text-left">{children}</span>
    </label>
  );
});
