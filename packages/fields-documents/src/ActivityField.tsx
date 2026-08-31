import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ComponentType,
  type ContextType,
} from 'react';
import {
  ACTIVITY_RESPONSE_KEY,
  type ActivityEntry,
  type ActivityFieldDefinition,
  type FieldComponentProps,
} from '@esheet/core';
import { Button } from '@mieweb/ui';
import { DataVisNitroContext, DataVisNitroGrid } from '@mieweb/ui/datavis';
import { ComputedView, Source } from 'datavis-ace';
import { LayoutList } from 'lucide-react';

type DataVisGridProps = Partial<ComponentProps<typeof DataVisNitroGrid>>;
type DataVisView = ContextType<typeof DataVisNitroContext>;
const NamedComputedView = ComputedView as unknown as new (
  source: Source,
  options: { readonly name: string }
) => ComputedView;
const OptionalDataVisNitroGrid =
  DataVisNitroGrid as unknown as ComponentType<DataVisGridProps>;

export const ACTIVITY_COLUMNS = [
  {
    field: 'at',
    header: 'Date / Time',
    sortable: true,
    filterable: true,
    resizable: true,
    width: 180,
  },
  {
    field: 'field',
    header: 'Field',
    sortable: true,
    filterable: true,
    resizable: true,
  },
  {
    field: 'category',
    header: 'Category',
    sortable: true,
    filterable: true,
    resizable: true,
    width: 110,
  },
  {
    field: 'from',
    header: 'Previous Value',
    sortable: true,
    filterable: true,
    resizable: true,
  },
  {
    field: 'to',
    header: 'Current Value',
    sortable: true,
    filterable: true,
    resizable: true,
  },
  {
    field: 'author',
    header: 'Author',
    sortable: true,
    filterable: true,
    resizable: true,
    width: 140,
  },
] as const;

type ActivityCategory = 'Added' | 'Updated' | 'Cleared';

interface ActivityRow {
  readonly id: string;
  readonly at: string;
  readonly atDisplay: string;
  readonly field: string;
  readonly category: ActivityCategory;
  readonly from: string;
  readonly to: string;
  readonly author: string;
}

type DataVisTableRow = Record<string, unknown> & {
  readonly data?: Record<string, unknown>;
};

let nextSourceId = 0;

function createSourceKey(): string {
  nextSourceId += 1;
  return `__esheet_activity_${nextSourceId}`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function categoryFor(entry: ActivityEntry): ActivityCategory {
  if (entry.from === undefined && entry.to !== undefined) return 'Added';
  if (entry.from !== undefined && entry.to === undefined) return 'Cleared';
  return 'Updated';
}

function activityRow(entry: ActivityEntry): ActivityRow {
  return {
    id: entry.id,
    at: entry.at,
    atDisplay: formatTimestamp(entry.at),
    field: entry.question ?? entry.fieldId,
    category: categoryFor(entry),
    from: entry.from ?? '—',
    to: entry.to ?? '—',
    author: entry.author ?? '—',
  };
}

function activityFromTableRow(row: DataVisTableRow): ActivityRow | null {
  const data = row.data ?? row;
  if (
    typeof data.id !== 'string' ||
    typeof data.at !== 'string' ||
    typeof data.field !== 'string'
  ) {
    return null;
  }
  return data as unknown as ActivityRow;
}

function publishRows(sourceKey: string, rows: readonly ActivityRow[]): void {
  (window as unknown as Record<string, unknown>)[sourceKey] = {
    type: 'table',
    data: rows,
  };
}

function refreshView(view: ComputedView): void {
  const source = view.source as unknown as { cache?: Record<string, unknown> };
  source.cache = {};
  view.clearCache();
  view.getData();
}

function useActivityView(rows: readonly ActivityRow[]): DataVisView {
  const sourceKey = useRef<string | null>(null);
  const viewRef = useRef<ComputedView | null>(null);
  const [view, setView] = useState<DataVisView>(null);

  if (sourceKey.current === null) sourceKey.current = createSourceKey();

  useEffect(() => {
    if (typeof window === 'undefined' || sourceKey.current === null) return;
    const key = sourceKey.current;
    publishRows(key, rows);
    const nextView = new NamedComputedView(
      new Source(
        { type: 'local', varName: key },
        undefined,
        undefined,
        { name: `ActivitySource:${key}` }
      ),
      { name: `ActivityView:${key}` }
    );
    viewRef.current = nextView;
    setView(nextView as unknown as DataVisView);
    return () => {
      delete (window as unknown as Record<string, unknown>)[key];
      viewRef.current = null;
      setView(null);
    };
    // The source is intentionally created once per mounted field instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || sourceKey.current === null) return;
    publishRows(sourceKey.current, rows);
    const refreshTimer = window.setTimeout(() => {
      if (viewRef.current) refreshView(viewRef.current);
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [rows]);

  return view;
}

interface DiffParts {
  readonly prefix: string;
  readonly previous: string;
  readonly current: string;
  readonly suffix: string;
}

function diffParts(previous: string, current: string): DiffParts {
  let prefixLength = 0;
  const sharedLength = Math.min(previous.length, current.length);
  while (
    prefixLength < sharedLength &&
    previous[prefixLength] === current[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < sharedLength - prefixLength &&
    previous[previous.length - suffixLength - 1] ===
      current[current.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return {
    prefix: previous.slice(0, prefixLength),
    previous: previous.slice(
      prefixLength,
      suffixLength ? previous.length - suffixLength : undefined
    ),
    current: current.slice(
      prefixLength,
      suffixLength ? current.length - suffixLength : undefined
    ),
    suffix: suffixLength ? previous.slice(-suffixLength) : '',
  };
}

function ActivityDetail({ row }: { readonly row: ActivityRow }) {
  const diff = diffParts(row.from, row.to);
  return (
    <div className="activity-field__detail ms:grid ms:grid-cols-1 ms:border-y ms:border-msborder ms:font-mono ms:text-sm ms:sm:grid-cols-2">
      <div className="activity-field__previous ms:grid ms:grid-cols-[2rem_1fr] ms:bg-msdanger/10">
        <div
          className="ms:flex ms:justify-center ms:border-r ms:border-msdanger/20 ms:px-2 ms:py-3 ms:text-msdanger"
          aria-hidden="true"
        >
          −
        </div>
        <div className="ms:whitespace-pre-wrap ms:break-words ms:px-3 ms:py-3 ms:text-mstext">
          {diff.prefix}
          {diff.previous && (
            <del className="activity-field__removed ms:bg-msdanger/20 ms:text-msdanger ms:no-underline">
              {diff.previous}
            </del>
          )}
          {diff.suffix}
        </div>
      </div>
      <div className="activity-field__current ms:grid ms:grid-cols-[2rem_1fr] ms:border-t ms:border-msborder ms:bg-msaccent/10 ms:sm:border-t-0 ms:sm:border-l">
        <div
          className="ms:flex ms:justify-center ms:border-r ms:border-msaccent/20 ms:px-2 ms:py-3 ms:text-msaccent"
          aria-hidden="true"
        >
          +
        </div>
        <div className="ms:whitespace-pre-wrap ms:break-words ms:px-3 ms:py-3 ms:text-mstext">
          {diff.prefix}
          {diff.current && (
            <ins className="activity-field__added ms:bg-msaccent/20 ms:text-msaccent ms:no-underline">
              {diff.current}
            </ins>
          )}
          {diff.suffix}
        </div>
      </div>
    </div>
  );
}

export function ActivityField({
  field,
  form,
  isPreview,
}: FieldComponentProps): React.JSX.Element {
  const def = field.definition as ActivityFieldDefinition;
  const { responses } = useSyncExternalStore(
    (callback) => form.subscribe(callback),
    () => form.getState(),
    () => form.getState()
  );
  const [detailRowsExpanded, setDetailRowsExpanded] = useState(false);
  const rows = [...(responses[ACTIVITY_RESPONSE_KEY]?.activity ?? [])]
    .sort(
      (left, right) =>
        right.at.localeCompare(left.at) || right.id.localeCompare(left.id)
    )
    .map(activityRow);
  const view = useActivityView(rows);

  if (!view) {
    return (
      <div className="activity-field activity-field--loading" role="status">
        Loading activity…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="activity-field ms:flex ms:flex-col ms:gap-3 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words">
          {def.question || 'Activity'}
        </div>
        <div className="ms:text-sm ms:text-mstextmuted">No activity yet</div>
      </div>
    );
  }

  const titleActions = (
    <Button
      type="button"
      variant={detailRowsExpanded ? 'primary' : 'ghost'}
      size="sm"
      onClick={() => setDetailRowsExpanded((expanded) => !expanded)}
      aria-label="Toggle all activity details"
      aria-pressed={detailRowsExpanded}
      title="Detail"
      leftIcon={<LayoutList size={16} aria-hidden="true" />}
    >
      Detail
    </Button>
  );

  return (
    <div className="activity-field ms:flex ms:min-w-0 ms:flex-col ms:gap-3 ms:overflow-x-auto ms:pb-4">
      {!isPreview && (
        <p className="ms:text-xs ms:text-mstextmuted">
          Read-only log of response changes — filled in automatically while the
          form is answered.
        </p>
      )}
      <DataVisNitroContext.Provider value={view}>
        <OptionalDataVisNitroGrid
          title={def.question || 'Activity'}
          titleActions={titleActions}
          columns={ACTIVITY_COLUMNS as unknown as DataVisGridProps['columns']}
          formatCell={(value, _row, column) => {
            if (column.field === 'at') {
              const row = activityFromTableRow(
                _row as unknown as DataVisTableRow
              );
              return row?.atDisplay ?? String(value ?? '');
            }
            return String(value ?? '');
          }}
          renderDetailRow={(tableRow) => {
            const row = activityFromTableRow(
              tableRow as unknown as DataVisTableRow
            );
            return row ? <ActivityDetail row={row} /> : null;
          }}
          detailRowsExpanded={detailRowsExpanded}
          style={{ width: '100%', minWidth: 900 }}
        />
      </DataVisNitroContext.Provider>
    </div>
  );
}
