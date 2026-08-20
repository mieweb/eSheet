import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { Autocomplete } from '@mieweb/ui';
import { registerCustomFieldTypes } from '../../lib/component-registry.js';

/**
 * Definition props for the `autocomplete` custom field type.
 *
 * The field searches a remote endpoint as the user types and stores the
 * chosen item as `{ selected: { id, value } }`, like a dropdown.
 */
export interface AutocompleteFieldDefinition {
  /** Field id, assigned by the builder like every field definition. */
  id: string;
  question?: string;
  /**
   * Remote endpoint template. `{query}` is replaced with the URL-encoded
   * search text, e.g.
   * `https://en.wikipedia.org/w/api.php?action=opensearch&search={query}&limit=8&format=json&origin=*`
   */
  dataSourceUrl?: string;
  /** For JSON object-array responses: key holding the display label. Default `label`. */
  labelKey?: string;
  /** For JSON object-array responses: key holding the stored id. Defaults to `labelKey`. */
  valueKey?: string;
  /**
   * Dot-path to the results array inside an enveloped response, e.g.
   * `results` for `{ results: [...] }` or `data.items` for `{ data: { items: [...] } }`.
   * Leave empty when the response is the array itself.
   */
  resultsPath?: string;
  /**
   * For JSON object-array responses: extra keys copied from the selected
   * object into `response.attributes`, e.g. `['city', 'state', 'zip']` when
   * picking an address. Values are stringified.
   */
  captureKeys?: string[];
  /** Input placeholder text. */
  answerPlaceholder?: string;
  /** Minimum query length before searching. Default 2. */
  minQueryLength?: number;
}

const DEBOUNCE_MS = 250;

/** An option plus the raw source object it came from (for attribute capture). */
export interface ParsedAutocompleteItem extends SelectedOption {
  /** The raw response object this option was parsed from, when available. */
  raw?: Record<string, unknown>;
}

/**
 * Descends into an enveloped response along a dot-path, e.g. `data.items`.
 * Returns the input unchanged when the path is empty.
 */
export function resolveResultsPath(data: unknown, path?: string): unknown {
  if (!path) return data;
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      data
    );
}

/**
 * Normalizes a remote response into selectable options. Supports:
 * 1. OpenSearch arrays (`[query, titles[], descriptions[], urls[]]`, e.g. Wikipedia)
 * 2. Arrays of strings
 * 3. Arrays of objects (using `labelKey` / `valueKey`; the raw object is
 *    retained for attribute capture)
 *
 * Enveloped responses (`{ results: [...] }`) are unwrapped first via `resultsPath`.
 */
export function parseAutocompleteItems(
  data: unknown,
  labelKey = 'label',
  valueKey = labelKey,
  resultsPath?: string
): ParsedAutocompleteItem[] {
  data = resolveResultsPath(data, resultsPath);
  if (!Array.isArray(data)) return [];

  // OpenSearch: [query, titles, descriptions?, urls?]
  if (typeof data[0] === 'string' && Array.isArray(data[1])) {
    const titles = data[1] as unknown[];
    const urls = Array.isArray(data[3]) ? (data[3] as unknown[]) : [];
    return titles
      .filter((t): t is string => typeof t === 'string')
      .map((title, i) => ({
        id: typeof urls[i] === 'string' ? (urls[i] as string) : title,
        value: title,
      }));
  }

  if (data.every((d) => typeof d === 'string')) {
    return (data as string[]).map((s) => ({ id: s, value: s }));
  }

  return data
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((o): ParsedAutocompleteItem | null => {
      const label = o[labelKey];
      const id = o[valueKey] ?? label;
      return typeof label === 'string'
        ? { id: String(id), value: label, raw: o }
        : null;
    })
    .filter((item): item is ParsedAutocompleteItem => item !== null);
}

/**
 * Copies `captureKeys` from a raw response object into a string map for
 * `response.attributes`. Missing keys are skipped; values are stringified.
 */
export function captureAttributes(
  raw: Record<string, unknown> | undefined,
  captureKeys?: string[]
): Record<string, string> | undefined {
  if (!raw || !captureKeys?.length) return undefined;
  const attributes: Record<string, string> = {};
  for (const key of captureKeys) {
    const v = raw[key];
    if (v !== undefined && v !== null) attributes[key] = String(v);
  }
  return Object.keys(attributes).length ? attributes : undefined;
}

export const AutocompleteField = React.memo(function AutocompleteField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  isSoftRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as unknown as AutocompleteFieldDefinition;
  const instanceId = form.getState().instanceId;
  const selected = response?.selected as SelectedOption | undefined;

  const [query, setQuery] = React.useState(selected?.value ?? '');
  const [items, setItems] = React.useState<ParsedAutocompleteItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const abortRef = React.useRef<AbortController | undefined>(undefined);

  // Cleanup on unmount: cancel the pending debounce and in-flight request.
  React.useEffect(() => {
    return () => {
      clearTimeout(debounceTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  const minQueryLength = def.minQueryLength ?? 2;

  const search = (q: string) => {
    setQuery(q);
    clearTimeout(debounceTimer.current);
    abortRef.current?.abort();
    if (!q) {
      setItems([]);
      setLoading(false);
      if (selected) onResponse({ selected: undefined });
      return;
    }
    if (!def.dataSourceUrl || q.length < minQueryLength) {
      // Reset any earlier "Searching…" state so loading doesn't stick when
      // the query shrinks below the minimum (the request above was aborted).
      setItems([]);
      setLoading(false);
      return;
    }
    const url = def.dataSourceUrl.replace('{query}', encodeURIComponent(q));
    setLoading(true);
    debounceTimer.current = setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(`Data source responded ${res.status}`);
        const data: unknown = await res.json();
        // Ignore stale responses: only the latest request may update state.
        if (abortRef.current !== ac) return;
        setItems(
          parseAutocompleteItems(
            data,
            def.labelKey,
            def.valueKey,
            def.resultsPath
          )
        );
        setLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (abortRef.current !== ac) return;
        setItems([]);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  };

  if (isPreview) {
    return (
      <div className="autocomplete-field-preview ms:space-y-1.5">
        <div className="ms:text-sm ms:font-medium ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
        </div>
        <Autocomplete<ParsedAutocompleteItem>
          items={items}
          getItemKey={(item) => item.id}
          renderItem={(item) => <span>{item.value}</span>}
          onSelect={(item) => {
            setQuery(item.value);
            onResponse({
              selected: { id: item.id, value: item.value },
              attributes: captureAttributes(item.raw, def.captureKeys),
            });
          }}
          value={query}
          onValueChange={search}
          clearOnSelect={false}
          minQueryLength={minQueryLength}
          placeholder={def.answerPlaceholder || 'Start typing to search…'}
          emptyMessage={loading ? 'Searching…' : 'No results found.'}
          disabled={!isEnabled}
          aria-label={def.question || 'Question'}
          inputProps={{ id: `${instanceId}-autocomplete-answer-${def.id}` }}
        />
      </div>
    );
  }

  return (
    <div className="autocomplete-field-edit ms:space-y-3">
      <EditInput
        id={`${instanceId}-canvas-question-${def.id}`}
        label="Question"
        value={def.question || ''}
        onChange={(question) => onUpdate({ question })}
        placeholder="Enter question"
      />

      <EditInput
        id={`${instanceId}-canvas-datasource-${def.id}`}
        label="Data source URL"
        type="url"
        value={def.dataSourceUrl || ''}
        onChange={(dataSourceUrl) => onUpdate({ dataSourceUrl })}
        placeholder="https://example.com/search?q={query}"
        hint="`{query}` is replaced with the searched text. Supports OpenSearch-style responses (e.g. Wikipedia), string arrays, and object arrays."
      />

      <div className="ms:grid ms:grid-cols-2 ms:gap-3">
        <EditInput
          id={`${instanceId}-canvas-resultspath-${def.id}`}
          label="Results path"
          value={def.resultsPath || ''}
          onChange={(resultsPath) =>
            onUpdate({ resultsPath: resultsPath || undefined })
          }
          placeholder="e.g. results or data.items"
          hint="Dot-path to the array inside an enveloped response. Leave empty when the response is the array itself."
        />
        <EditInput
          id={`${instanceId}-canvas-capturekeys-${def.id}`}
          label="Capture attributes"
          value={(def.captureKeys ?? []).join(', ')}
          onChange={(csv) => {
            const captureKeys = csv
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            onUpdate({
              captureKeys: captureKeys.length ? captureKeys : undefined,
            });
          }}
          placeholder="e.g. city, state, zip"
          hint="Comma-separated keys copied from the selected object into the response."
        />
      </div>

      <div className="ms:grid ms:grid-cols-2 ms:gap-3">
        <EditInput
          id={`${instanceId}-canvas-labelkey-${def.id}`}
          label="Label key"
          value={def.labelKey || ''}
          onChange={(labelKey) => onUpdate({ labelKey: labelKey || undefined })}
          placeholder="label"
          hint="For object responses: key shown to the user."
        />
        <EditInput
          id={`${instanceId}-canvas-valuekey-${def.id}`}
          label="Value key"
          value={def.valueKey || ''}
          onChange={(valueKey) => onUpdate({ valueKey: valueKey || undefined })}
          placeholder="defaults to label key"
          hint="For object responses: key stored as the answer id."
        />
      </div>
    </div>
  );
});

/** Labeled text input row used by the builder-canvas edit view. */
function EditInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
      />
      {hint && <p className="ms:mt-1 ms:text-xs ms:text-mstextmuted">{hint}</p>}
    </div>
  );
}

/** The Wikipedia opensearch endpoint used as the friendly default data source. */
export const WIKIPEDIA_OPENSEARCH_URL =
  'https://en.wikipedia.org/w/api.php?action=opensearch&search={query}&limit=8&format=json&origin=*';

/**
 * Registers the `autocomplete` custom field type: a type-ahead question that
 * searches a remote endpoint and stores the chosen item like a dropdown.
 *
 * @example
 * ```tsx
 * import { registerAutocompleteFieldType } from '@esheet/fields';
 * registerAutocompleteFieldType();
 * ```
 */
export function registerAutocompleteFieldType(): void {
  registerCustomFieldTypes({
    autocomplete: {
      label: 'Autocomplete',
      category: 'selection',
      answerType: 'selection',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {
        width: 'third',
        dataSourceUrl: WIKIPEDIA_OPENSEARCH_URL,
      },
      placeholder: { question: 'Enter your question...' },
      component: AutocompleteField,
    },
  });
}
