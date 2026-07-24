/// <reference lib="dom" />

'use client';

import { Card, CardContent, cn } from '@mieweb/ui';
import {
  AlertCircle as AlertCircleIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Loader2 as LoaderIcon,
  Search as SearchIcon,
} from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import type { CodifyResult } from './engine.js';
import { familyKey, familyTerm } from './engine.js';
import { useAnchoredPosition } from './useAnchoredPosition.js';

export type CodifyDomain =
  | 'condition'
  | 'med'
  | 'lab'
  | 'procedure'
  | 'vaccine'
  | 'occupational'
  | 'quality';

export interface CodeLookupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'onSelect'> {
  indexUrl: string;
  locale?: string;
  domains?: CodifyDomain[];
  programsUrl?: string;
  searchDomains?: CodifyDomain[];
  preferDomains?: CodifyDomain[];
  preferCodetypes?: string[];
  billableOnly?: boolean;
  onSelect?: (result: CodifyResult) => void;
  initialQuery?: string;
  initialSearch?: boolean;
  onFreeText?: (text: string) => void;
  limit?: number;
  placeholder?: string;
  bare?: boolean;
  clearOnSelect?: boolean;
  className?: string;
  'data-testid'?: string;
}

type Status =
  | { state: 'loading'; pct: number }
  | { state: 'ready'; docCount: number }
  | { state: 'error'; message: string };

function keyToDomains(key: string | null): string[] | undefined {
  return key === null ? undefined : key === '' ? [] : key.split(',');
}

const DOMAIN_TEXT: Record<string, string> = {
  condition: 'text-primary-600 dark:text-primary-400',
  med: 'text-emerald-700 dark:text-emerald-400',
  lab: 'text-amber-700 dark:text-amber-400',
  procedure: 'text-violet-700 dark:text-violet-400',
  vaccine: 'text-muted-foreground',
  occupational: 'text-sky-700 dark:text-sky-400',
  quality: 'text-rose-700 dark:text-rose-400',
};

const DETAIL_NOUN: Record<string, string> = {
  med: 'forms & strengths',
  condition: 'specific codes',
  lab: 'related tests',
  procedure: 'related codes',
  vaccine: 'related codes',
  occupational: 'required orders',
  quality: 'measure orders',
};

const PROGRAM_DOMAINS = new Set(['occupational', 'quality']);

export const CodeLookup = React.forwardRef<HTMLDivElement, CodeLookupProps>(
  (
    {
      indexUrl,
      locale = 'en',
      domains,
      searchDomains,
      preferDomains,
      preferCodetypes,
      billableOnly = false,
      programsUrl,
      onSelect,
      onFreeText,
      initialQuery,
      initialSearch = true,
      limit = 15,
      placeholder = 'Search conditions, meds, labs… (try "con hea fa", "chf", "lasix")',
      bare = false,
      clearOnSelect,
      className,
      'data-testid': dataTestId,
      ...props
    },
    ref
  ) => {
    const [status, setStatus] = React.useState<Status>({
      state: 'loading',
      pct: 0,
    });
    const [query, setQuery] = React.useState(initialQuery ?? '');
    const [results, setResults] = React.useState<CodifyResult[]>([]);
    const [tookMs, setTookMs] = React.useState<number | null>(null);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const [open, setOpen] = React.useState(false);
    const [drill, setDrill] = React.useState<{
      parent: CodifyResult;
      results: CodifyResult[] | null;
    } | null>(null);
    const workerRef = React.useRef<Worker | null>(null);
    const searchIdRef = React.useRef(0);
    const drillIdRef = React.useRef(0);
    const drillParentRef = React.useRef<CodifyResult | null>(null);
    const billableOnlyRef = React.useRef(billableOnly);
    billableOnlyRef.current = billableOnly;
    const skipSearchRef = React.useRef(Boolean(initialQuery) && !initialSearch);
    const baseId = React.useId();
    const resultsId = `${baseId}-results`;
    const optionId = (i: number) => `${baseId}-option-${i}`;

    const domainsKey = domains ? domains.join(',') : null;
    const searchDomainsKey = searchDomains ? searchDomains.join(',') : null;
    const preferDomainsKey = preferDomains ? preferDomains.join(',') : null;
    const preferCodetypesKey = preferCodetypes
      ? preferCodetypes.join(',')
      : null;

    React.useEffect(() => {
      setStatus({ state: 'loading', pct: 0 });
      setResults([]);
      setTookMs(null);
      setActiveIndex(-1);
      setOpen(false);
      setDrill(null);
      const worker = new Worker(
        new URL('./codify.worker.ts', import.meta.url),
        {
          type: 'module',
        }
      );
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          setStatus({
            state: 'loading',
            pct: Math.round((msg.loadedBytes / msg.totalBytes) * 100),
          });
        } else if (msg.type === 'ready') {
          setStatus({ state: 'ready', docCount: msg.docCount });
        } else if (msg.type === 'error') {
          setStatus({ state: 'error', message: msg.message });
        } else if (msg.type === 'results') {
          if (msg.id === searchIdRef.current) {
            setResults(msg.results);
            setTookMs(msg.tookMs);
            setActiveIndex(-1);
            setOpen(true);
          } else if (msg.id === drillIdRef.current) {
            const parent = drillParentRef.current;
            let members: CodifyResult[];
            if (parent && PROGRAM_DOMAINS.has(parent.domain)) {
              members = msg.results as CodifyResult[];
            } else {
              const pKey = parent
                ? familyKey(parent.domain, parent.label, parent.fullcode)
                : '';
              members = (msg.results as CodifyResult[])
                .filter(
                  (r) =>
                    parent !== null &&
                    r.domain === parent.domain &&
                    r.fullid !== parent.fullid &&
                    familyKey(r.domain, r.label, r.fullcode) === pKey
                )
                .sort((a, b) => a.label.localeCompare(b.label));
            }
            setDrill((prev) => (prev ? { ...prev, results: members } : prev));
            setActiveIndex(members.length > 0 ? 0 : -1);
          }
        }
      };
      worker.postMessage({
        type: 'load',
        baseUrl: `${indexUrl.replace(/\/+$/, '')}/${locale}`,
        domains: keyToDomains(domainsKey),
        programsUrl,
      });
      return () => worker.terminate();
    }, [indexUrl, locale, domainsKey, programsUrl]);

    React.useEffect(() => {
      if (status.state !== 'ready') return;
      if (skipSearchRef.current) {
        skipSearchRef.current = false;
        return;
      }
      const q = query.trim();
      if (!q) {
        setResults([]);
        setTookMs(null);
        setOpen(false);
        setDrill(null);
        return;
      }
      const t = setTimeout(() => {
        const id = ++searchIdRef.current;
        workerRef.current?.postMessage({
          type: 'search',
          id,
          query: q,
          limit,
          domains: keyToDomains(searchDomainsKey),
          prefer: keyToDomains(preferDomainsKey),
          boostCodetypes: keyToDomains(preferCodetypesKey),
          billableOnly,
          collapse: true,
        });
      }, 40);
      return () => clearTimeout(t);
    }, [
      query,
      status.state,
      limit,
      searchDomainsKey,
      preferDomainsKey,
      preferCodetypesKey,
      billableOnly,
    ]);

    const isDrillable = (r: CodifyResult) => r.domain in DETAIL_NOUN;

    const openDrill = React.useCallback((parent: CodifyResult) => {
      drillParentRef.current = parent;
      setDrill({ parent, results: null });
      const id = --drillIdRef.current;
      if (PROGRAM_DOMAINS.has(parent.domain)) {
        workerRef.current?.postMessage({
          type: 'orders',
          id,
          key: `${parent.codetype}|${parent.fullcode}`,
        });
        return;
      }
      workerRef.current?.postMessage({
        type: 'search',
        id,
        query: familyTerm(parent.domain, parent.label) || parent.label,
        limit: 300,
        domains: [parent.domain],
        billableOnly: billableOnlyRef.current,
      });
    }, []);

    const closeDrill = () => {
      setDrill(null);
      setActiveIndex(-1);
    };

    const list: CodifyResult[] = drill ? drill.results ?? [] : results;

    const pick = (r: CodifyResult) => {
      onSelect?.(r);
      setOpen(false);
      setDrill(null);
      setResults([]);
      setActiveIndex(-1);
      if (clearOnSelect ?? bare) {
        setQuery('');
      } else {
        skipSearchRef.current = true;
        setQuery(r.label);
      }
    };

    const submitFreeText = () => {
      const text = query.trim();
      if (!text || !onFreeText) return;
      onFreeText(text);
      setOpen(false);
      setDrill(null);
      setResults([]);
      setActiveIndex(-1);
      if (clearOnSelect ?? bare) setQuery('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => Math.min(list.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(-1, i - 1));
      } else if (
        e.key === 'ArrowRight' &&
        !drill &&
        activeIndex >= 0 &&
        list[activeIndex] &&
        isDrillable(list[activeIndex])
      ) {
        e.preventDefault();
        openDrill(list[activeIndex]);
      } else if (e.key === 'ArrowLeft' && drill) {
        e.preventDefault();
        closeDrill();
      } else if (e.key === 'Enter' && activeIndex >= 0 && list[activeIndex]) {
        e.preventDefault();
        pick(list[activeIndex]);
      } else if (e.key === 'Enter' && onFreeText && query.trim()) {
        e.preventDefault();
        submitFreeText();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (drill) closeDrill();
        else if (open) setOpen(false);
        else setQuery('');
      }
    };

    const effectivePlaceholder =
      status.state === 'loading'
        ? `Loading offline index… ${status.pct}%`
        : status.state === 'error'
        ? 'Code index unavailable'
        : placeholder;

    const dropdownOpen =
      open &&
      (Boolean(drill) ||
        list.length > 0 ||
        Boolean(onFreeText && query.trim() !== ''));

    const { anchorRef, floatingRef, style } = useAnchoredPosition<
      HTMLDivElement,
      HTMLDivElement
    >({ open: dropdownOpen, matchWidth: true });

    const searchBox = (
      <div className="relative" ref={anchorRef}>
        <SearchIcon
          size={16}
          className="text-muted-foreground absolute top-5 left-3 -translate-y-1/2"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-controls={resultsId}
          aria-activedescendant={
            activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          aria-label="Search medical codes"
          value={query}
          onChange={(e) => {
            skipSearchRef.current = false;
            setQuery(e.target.value);
            setDrill(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => list.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={effectivePlaceholder}
          disabled={status.state === 'error'}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground',
            'h-10 w-full rounded-md border pr-3 pl-9 text-sm',
            'focus:ring-ring focus:ring-2 focus:outline-none'
          )}
        />

        {dropdownOpen &&
          createPortal(
            <div
              ref={floatingRef}
              style={style}
              role="presentation"
              className={cn(
                'bg-card border-border flex flex-col',
                'overflow-hidden rounded-md border shadow-lg'
              )}
              onMouseDown={(e) => e.preventDefault()}
            >
              {drill && (
                <div className="border-border bg-muted/50 flex shrink-0 items-center gap-1.5 border-b px-2 py-1.5">
                  <button
                    type="button"
                    onClick={closeDrill}
                    aria-label="Back to search results"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                  >
                    <ChevronLeftIcon size={14} />
                    Back
                  </button>
                  <span className="text-foreground text-xs font-semibold">
                    {drill.parent.label}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    — {DETAIL_NOUN[drill.parent.domain] ?? 'related codes'}
                    {drill.results === null
                      ? '…'
                      : ` (${drill.results.length})`}
                  </span>
                </div>
              )}

              <ul
                id={resultsId}
                role="listbox"
                aria-label={
                  drill
                    ? `${
                        DETAIL_NOUN[drill.parent.domain] ?? 'related codes'
                      } of ${drill.parent.label}`
                    : 'Code search results'
                }
                className="divide-border max-h-80 min-h-0 divide-y overflow-y-auto"
              >
                {list.map((r, i) => (
                  <li
                    key={r.fullid}
                    role="presentation"
                    className="flex items-stretch"
                  >
                    <button
                      type="button"
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === activeIndex}
                      tabIndex={-1}
                      onClick={() => pick(r)}
                      onMouseMove={() => activeIndex !== i && setActiveIndex(i)}
                      className={cn(
                        'flex min-w-0 flex-1 items-baseline gap-2 px-3 py-1.5 text-left text-sm',
                        'hover:bg-muted/60 focus:bg-muted/60 focus:outline-none',
                        i === activeIndex && 'bg-muted/60'
                      )}
                    >
                      <span className="text-foreground min-w-0 flex-1 truncate">
                        {r.label}
                      </span>
                      <span
                        className={cn(
                          'text-muted-foreground shrink-0 text-[11px] whitespace-nowrap',
                          DOMAIN_TEXT[r.domain]
                        )}
                      >
                        {r.codetype}{' '}
                        <span className="font-mono">{r.fullcode}</span>
                      </span>
                    </button>
                    {!drill && isDrillable(r) && (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Show ${
                          DETAIL_NOUN[r.domain] ?? 'related codes'
                        } of ${r.label}`}
                        title={`${
                          DETAIL_NOUN[r.domain] ?? 'Related codes'
                        } (→)`}
                        onClick={() => openDrill(r)}
                        onMouseMove={() =>
                          activeIndex !== i && setActiveIndex(i)
                        }
                        className={cn(
                          'text-muted-foreground hover:text-foreground shrink-0 px-1.5',
                          'hover:bg-muted/60 focus:outline-none',
                          i === activeIndex
                            ? 'bg-muted/60 opacity-100'
                            : 'opacity-40'
                        )}
                      >
                        <ChevronRightIcon size={14} />
                      </button>
                    )}
                  </li>
                ))}
                {drill &&
                  drill.results !== null &&
                  drill.results.length === 0 && (
                    <li className="text-muted-foreground px-3 py-2 text-sm">
                      No related entries found — press ← to go back.
                    </li>
                  )}
                {!drill && onFreeText && query.trim() !== '' && (
                  <li role="presentation" className="border-border border-t">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={submitFreeText}
                      className={cn(
                        'text-muted-foreground hover:text-foreground hover:bg-muted/60 w-full px-3 py-1.5 text-left text-sm italic',
                        'focus:bg-muted/60 focus:outline-none'
                      )}
                    >
                      Use “{query.trim()}” as free text…
                    </button>
                  </li>
                )}
              </ul>
            </div>,
            document.body
          )}
      </div>
    );

    if (bare) {
      return (
        <div
          ref={ref}
          className={cn('w-full', className)}
          data-testid={dataTestId}
          {...props}
        >
          {searchBox}
        </div>
      );
    }

    return (
      <Card
        ref={ref}
        padding="none"
        className={cn('w-full overflow-visible', className)}
        data-testid={dataTestId}
        {...props}
      >
        <CardContent className="space-y-2 px-4 py-4">
          {searchBox}

          <div
            className="text-muted-foreground flex items-center gap-2 text-xs"
            aria-live="polite"
          >
            {status.state === 'loading' && (
              <>
                <LoaderIcon size={12} className="animate-spin" />
                Loading offline index… {status.pct}%
              </>
            )}
            {status.state === 'ready' && tookMs === null && (
              <>
                Offline index ready — {status.docCount.toLocaleString()}{' '}
                entries.
              </>
            )}
            {status.state === 'ready' && tookMs !== null && (
              <>
                {results.length} results in {tookMs.toFixed(1)} ms (local) · ↑↓
                navigate · → drill into a row · Enter selects
              </>
            )}
            {status.state === 'error' && (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertCircleIcon size={12} />
                Index unavailable: {status.message}. See{' '}
                <code className="font-mono">
                  src/components/CodeLookup/README.md
                </code>{' '}
                to rebuild the index.
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

CodeLookup.displayName = 'CodeLookup';

export default CodeLookup;
