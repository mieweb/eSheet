import React from 'react';

// ---------------------------------------------------------------------------
// NoteCardList — presentational entry list used by ActivityField. Pure display:
// any mutation affordances come in via `actions`.
// ---------------------------------------------------------------------------

export interface NoteCardItem {
  id: string;
  /** Card header title, e.g. the author display name. */
  title?: string;
  /** Card header timestamp text (already formatted for display). */
  timestamp?: string;
  /** Card body (rendered markdown, change summary, ...). */
  body: React.ReactNode;
  /** Optional footer (attachments, ...). */
  footer?: React.ReactNode;
  /** Optional header-right action buttons (edit / delete). */
  actions?: React.ReactNode;
}

export interface NoteCardListProps {
  items: NoteCardItem[];
  /** Shown when there are no items. */
  emptyLabel: string;
  /** Accessible label for the list. */
  ariaLabel: string;
}

export function NoteCardList({
  items,
  emptyLabel,
  ariaLabel,
}: NoteCardListProps) {
  if (items.length === 0) {
    return (
      <p className="note-list-empty ms:text-sm ms:text-mstextmuted ms:italic">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="note-list ms:space-y-2 ms:list-none" aria-label={ariaLabel}>
      {items.map((item) => (
        <li
          key={item.id}
          className="note-card ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:p-3"
        >
          {(item.title || item.timestamp || item.actions) && (
            <div className="note-card-header ms:flex ms:items-baseline ms:justify-between ms:gap-2 ms:mb-1">
              <div className="ms:flex ms:items-baseline ms:gap-2 ms:min-w-0">
                {item.title && (
                  <span className="note-card-author ms:text-sm ms:font-medium ms:text-mstext ms:truncate">
                    {item.title}
                  </span>
                )}
                {item.timestamp && (
                  <span className="note-card-timestamp ms:text-xs ms:text-mstextmuted ms:whitespace-nowrap">
                    {item.timestamp}
                  </span>
                )}
              </div>
              {item.actions && (
                <div className="note-card-actions ms:flex ms:items-center ms:gap-1">
                  {item.actions}
                </div>
              )}
            </div>
          )}
          <div className="note-card-body ms:text-sm ms:text-mstext ms:break-words">
            {item.body}
          </div>
          {item.footer && (
            <div className="note-card-footer ms:mt-2">{item.footer}</div>
          )}
        </li>
      ))}
    </ul>
  );
}
