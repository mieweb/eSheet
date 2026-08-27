import React from 'react';
import {
  ACTIVITY_RESPONSE_KEY,
  type ActivityFieldDefinition,
  type FieldComponentProps,
} from '@esheet/core';
import { NoteCardList, type NoteCardItem } from './NoteCardList.js';

// ---------------------------------------------------------------------------
// ActivityField — read-only, append-only log of response changes over time.
// ---------------------------------------------------------------------------

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

export const ActivityField = React.memo(function ActivityField({
  field,
  form,
  isPreview,
}: FieldComponentProps) {
  const def = field.definition as ActivityFieldDefinition;
  const { responses } = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState(),
    () => form.getState()
  );

  const log = responses[ACTIVITY_RESPONSE_KEY]?.activity ?? [];
  // Newest first, always.
  const items: NoteCardItem[] = [...log]
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    .map((entry) => ({
      id: entry.id,
      title: entry.author,
      timestamp: formatTimestamp(entry.at),
      body: (
        <span>
          <span className="activity-field-label ms:font-medium">
            {entry.question ?? entry.fieldId}
          </span>
          {': '}
          {/* A first fill (or same-display edit) is one statement, no arrow. */}
          {entry.from !== undefined && (
            <>
              <span className="activity-field-from ms:text-mstextmuted">
                {entry.from}
              </span>
              {' → '}
            </>
          )}
          <span className="activity-field-to">{entry.to ?? '—'}</span>
        </span>
      ),
    }));

  return (
    <div className="activity-field ms:flex ms:flex-col ms:gap-3 ms:pb-4">
      <div className="ms:font-light ms:text-mstext ms:break-words">
        {def.question || 'Activity'}
      </div>
      {!isPreview && (
        <p className="ms:text-xs ms:text-mstextmuted">
          Read-only log of response changes — filled in automatically while the
          form is answered.
        </p>
      )}
      <NoteCardList
        items={items}
        emptyLabel="No activity yet"
        ariaLabel={def.question || 'Activity log'}
      />
    </div>
  );
});
