/**
 * Builder icon components — ported from questionnaire-builder (old QB).
 *
 * All icons accept a `className` prop and render inline SVGs using `currentColor`.
 * Usage: <TrashIcon className="ms:w-5 ms:h-5 ms:text-mstextmuted" />
 */

import React from 'react';

type IconProps = { className?: string };

const eq = (a: IconProps, b: IconProps) => a.className === b.className;

// ---------------------------------------------------------------------------
// Shared icons — re-exported from @msheet/fields
// ---------------------------------------------------------------------------

export { TrashIcon, PlusIcon, ArrowUpIcon, ArrowDownIcon, UpDownArrowIcon } from '@msheet/fields';

// ---------------------------------------------------------------------------
// Field Wrapper actions
// ---------------------------------------------------------------------------

export const ViewBigIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 10v-7l3 3" />
    <path d="M9 6l3 -3" />
    <path d="M12 14v7l3 -3" />
    <path d="M9 18l3 3" />
    <path d="M18 3h1a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-1" />
    <path d="M6 3h-1a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h1" />
  </svg>
), eq);

export const ViewSmallIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 3v7l3 -3" />
    <path d="M9 7l3 3" />
    <path d="M12 21v-7l3 3" />
    <path d="M9 17l3 -3" />
    <path d="M18 9h1a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-1" />
    <path d="M6 9h-1a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h1" />
  </svg>
), eq);

export const EditIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
    <path d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3zM16 5l3 3" />
  </svg>
), eq);

// ---------------------------------------------------------------------------
// ToolPanel category icons
// ---------------------------------------------------------------------------

export const TextFieldsIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m-4 12h2a2 2 0 0 0 2-2v-2m-8 0V9M9 9h6" />
  </svg>
), eq);

export const SelectionFieldsIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="m9 11l3 3l3-3" />
  </svg>
), eq);

export const RatingIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 6h9" />
    <path d="M11 12h9" />
    <path d="M12 18h8" />
    <path d="M4 16a2 2 0 1 1 4 0c0 0.591 -0.5 1 -1 1.5L4 20h4" />
    <path d="M6 10V4L4 6" />
  </svg>
), eq);

export const MatrixIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M11 5a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M18 5a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M4 12a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M11 12a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M18 12a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M4 19a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M11 19a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
    <path d="M18 19a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" />
  </svg>
), eq);

export const RichContentIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 7 -6.5 6.5a1.5 1.5 0 0 0 3 3L18 10a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9L21 13" />
  </svg>
), eq);

export const OrganizationIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 4h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2H9a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2" />
    <path d="M17 17v2a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2h2" />
  </svg>
), eq);

// ---------------------------------------------------------------------------
// BuilderHeader — mode toggle icons
// ---------------------------------------------------------------------------

export const VEditorIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
    <path d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0 -4 -4L4 16v4" />
    <path d="m13.5 6.5 4 4" />
    <path d="m19 16 -2 3h4l-2 3" />
  </svg>
), eq);

export const PreviewIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
    <path d="M15 8h0.01" />
    <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3H6a3 3 0 0 1 -3 -3V6z" />
    <path d="m3 16 5 -5c0.928 -0.893 2.072 -0.893 3 0l5 5" />
    <path d="m14 14 1 -1c0.928 -0.893 2.072 -0.893 3 0l3 3" />
  </svg>
), eq);

// ---------------------------------------------------------------------------
// BuilderHeader — action icons
// ---------------------------------------------------------------------------

export const UploadIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 9l5 -5l5 5" />
    <path d="M12 4l0 12" />
  </svg>
), eq);

export const DownloadIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
    <path d="M7 11l5 5l5 -5" />
    <path d="M12 4l0 12" />
  </svg>
), eq);

export const CodeIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 8 -4 4 4 4" />
    <path d="m17 8 4 4 -4 4" />
    <path d="m14 4 -4 16" />
  </svg>
), eq);

// ---------------------------------------------------------------------------
// Misc / shared
// ---------------------------------------------------------------------------

export const XIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
), eq);

export const CheckIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M5 12l5 5l10 -10" />
  </svg>
), eq);

export const DragHandleIcon = React.memo(({ className = '' }: IconProps) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
), eq);
