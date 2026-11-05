import { useEffect, useId, useRef, useState } from 'react';
import type { DocumentPicker, DocumentPickerItem } from '@esheet/core';

export interface DocumentPickerDialogProps {
  readonly picker: DocumentPicker;
  readonly fieldId: string;
  readonly question?: string;
  readonly accept?: string;
  readonly onSelect: (item: DocumentPickerItem) => void;
  readonly onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const formatDate = (value?: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

/** Modal list of host-provided documents; the host decides what is offered. */
export function DocumentPickerDialog({
  picker,
  fieldId,
  question,
  accept,
  onSelect,
  onClose,
}: DocumentPickerDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<readonly DocumentPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const timer = setTimeout(
      () => {
        picker
          .list({
            fieldId,
            question,
            accept,
            search: search.trim() || undefined,
          })
          .then((result) => {
            if (!cancelled) setItems(result);
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setItems([]);
              setError(
                err instanceof Error ? err.message : 'Failed to load documents'
              );
            }
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      search ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [picker, fieldId, question, accept, search]);

  return (
    <dialog
      ref={dialog}
      className="document-picker-overlay ms:fixed ms:inset-0 ms:m-0 ms:h-full ms:w-full ms:max-h-none ms:max-w-none ms:border-0 ms:z-50 ms:flex ms:items-center ms:justify-center ms:bg-msoverlay ms:px-4 ms:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={onClose}
    >
      <div
        className="ms:w-full ms:max-w-2xl ms:max-h-full ms:flex ms:flex-col ms:rounded-xl ms:bg-mssurface ms:border ms:border-msborder ms:shadow-2xl ms:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id={titleId}
          className="ms:text-base ms:font-semibold ms:text-mstext ms:mb-3"
        >
          {picker.label ?? 'Choose from chart'}
        </h3>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents"
          aria-label="Search documents"
          className="ms:w-full ms:mb-3 ms:px-3 ms:py-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:text-mstext ms:text-sm"
        />
        <div
          className="ms:flex-1 ms:overflow-auto ms:space-y-2"
          aria-busy={loading}
        >
          {loading && (
            <div className="ms:text-sm ms:text-mstextmuted">
              Loading documents...
            </div>
          )}
          {!loading && error && (
            <div className="ms:p-3 ms:bg-msdanger/10 ms:border ms:border-msdanger ms:rounded-lg ms:text-sm ms:text-msdanger">
              {error}
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="ms:text-sm ms:text-mstextmuted">
              No documents found.
            </div>
          )}
          {!loading &&
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="ms:w-full ms:text-left ms:p-3 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:hover:bg-msbackground ms:transition-colors ms:cursor-pointer ms:flex ms:items-center ms:gap-3"
              >
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="ms:h-16 ms:w-16 ms:flex-none ms:rounded ms:bg-black ms:object-contain"
                  />
                )}
                <div className="ms:min-w-0 ms:flex-1">
                  <div className="ms:text-sm ms:font-medium ms:text-mstext ms:truncate">
                    {item.title}
                  </div>
                  <div className="ms:text-xs ms:text-mstextmuted ms:flex ms:gap-2 ms:flex-wrap">
                    {item.date && <span>{formatDate(item.date)}</span>}
                    {item.contentType && <span>{item.contentType}</span>}
                    {item.description && <span>{item.description}</span>}
                  </div>
                </div>
              </button>
            ))}
        </div>
        <div className="ms:mt-4 ms:flex ms:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="ms:px-4 ms:py-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm ms:font-medium ms:hover:bg-msbackground ms:transition-colors ms:cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
