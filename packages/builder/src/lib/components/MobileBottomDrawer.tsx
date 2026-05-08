import React from 'react';

export interface MobileBottomDrawerProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileBottomDrawer({
  title,
  open,
  onClose,
  children,
}: MobileBottomDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="ms:lg:hidden ms:fixed ms:inset-0 ms:z-40 ms:bg-msoverlay ms:border-0"
        onClick={onClose}
        aria-label={`Close ${title} drawer`}
      />
      <div className="ms:lg:hidden ms:fixed ms:left-0 ms:right-0 ms:bottom-0 ms:z-50 ms:h-[50dvh] ms:bg-mssurface ms:border-t ms:border-msborder ms:rounded-t-2xl ms:shadow-2xl ms:overflow-hidden">
        <div className="ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-2 ms:border-b ms:border-msborder">
          <span className="ms:text-sm ms:font-medium ms:text-mstext">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ms:px-2 ms:py-1 ms:bg-transparent ms:text-mstextmuted ms:border-0 ms:outline-none ms:focus:outline-none"
            aria-label={`Close ${title} drawer`}
          >
            Close
          </button>
        </div>
        <div className="ms:h-[calc(50dvh-45px)] ms:overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
