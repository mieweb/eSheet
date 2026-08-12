import React, { type ReactNode } from 'react';
import { Square, SquareCheck } from 'lucide-react';

const noop = () => {};

export interface CustomCheckboxButtonProps {
  id: string;
  name?: string;
  value: string;
  checked: boolean;
  children: ReactNode;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const CustomCheckboxButton = React.memo(function CustomCheckboxButton({
  id,
  name,
  value,
  checked,
  children,
  onChange,
  disabled = false,
  className = '',
}: CustomCheckboxButtonProps) {
  return (
    <label
      htmlFor={id}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onChange?.(!checked);
      }}
      className={`ms:flex ms:min-h-[38px] ms:max-w-full ms:cursor-pointer ms:select-none ms:items-center ms:justify-start ms:gap-2 ms:rounded-lg ms:border ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:outline-none ms:transition-colors ms:focus-within:ring-2 ms:focus-within:ring-msprimary/30 ${
        checked
          ? 'ms:border-msprimary ms:bg-msprimary ms:text-mstextsecondary ms:shadow-sm'
          : 'ms:border-msborder ms:bg-mssurface ms:text-mstext ms:hover:border-msprimary/50 ms:hover:bg-msprimary/15'
      } ${disabled ? 'ms:cursor-not-allowed ms:opacity-50' : ''} ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={noop}
        className="ms:sr-only"
      />
      {checked ? (
        <SquareCheck
          aria-hidden="true"
          className="ms:h-5 ms:w-5 ms:shrink-0"
          strokeWidth={2}
        />
      ) : (
        <Square
          aria-hidden="true"
          className="ms:h-5 ms:w-5 ms:shrink-0 ms:text-msborder"
          strokeWidth={2}
        />
      )}
      <span className="ms:min-w-0 ms:break-words ms:text-left">{children}</span>
    </label>
  );
});
