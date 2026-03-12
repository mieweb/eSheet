/**
 * Field icon components — used by built-in field components for edit-mode actions.
 *
 * All icons accept a `className` prop and render inline SVGs using `currentColor`.
 */

import React from 'react';

type IconProps = { className?: string };

const eq = (a: IconProps, b: IconProps) => a.className === b.className;

export const TrashIcon = React.memo(
  ({ className = '' }: IconProps) => (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3m-5 5l4 4m0-4l-4 4" />
    </svg>
  ),
  eq
);

export const PlusIcon = React.memo(
  ({ className = '' }: IconProps) => (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v16m8-8H4" />
    </svg>
  ),
  eq
);

export const ArrowUpIcon = React.memo(
  ({ className = '' }: IconProps) => (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M6 15l6 -6l6 6" />
    </svg>
  ),
  eq
);

export const ArrowDownIcon = React.memo(
  ({ className = '' }: IconProps) => (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M6 9l6 6l6 -6" />
    </svg>
  ),
  eq
);

export const UpDownArrowIcon = React.memo(
  ({ className = '' }: IconProps) => (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M8 7l4 -4l4 4" />
      <path d="M8 17l4 4l4 -4" />
      <path d="M12 3v18" />
    </svg>
  ),
  eq
);
