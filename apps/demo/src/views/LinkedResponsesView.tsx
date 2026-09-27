import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, CardContent } from '@mieweb/ui';
import {
  serializeResponseReference,
  type FormResponse,
  type ResponseReferenceResolver,
} from '@esheet/core';
import { createResponseReferenceProvider } from '@esheet/fields';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';
import { Navbar } from '../components/Navbar';
import overviewDefinition from '../schemas/linked-overview.yaml?raw';
import reviewDefinition from '../schemas/linked-review.yaml?raw';

const collection = 'demo-responses';
const responses = {
  'overview-1': {
    title: 'Request overview',
    definition: overviewDefinition,
    field: 'linked_review',
    target: 'review-1',
    relationship: 'review',
  },
  'review-1': {
    title: 'Request review',
    definition: reviewDefinition,
    field: 'linked_overview',
    target: 'overview-1',
    relationship: 'overview',
  },
} as const;
type ResponseId = keyof typeof responses;
const isResponseId = (id: string | null): id is ResponseId =>
  id !== null && Object.prototype.hasOwnProperty.call(responses, id);
const storageKey = (id: ResponseId) => `esheet-linked-responses-v1:${id}`;

function readResponse(id: ResponseId): FormResponse {
  let saved: FormResponse = {};
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(storageKey(id)) ?? '{}'
    );
    if (value && typeof value === 'object' && !Array.isArray(value))
      saved = value as FormResponse;
  } catch {
    /* A fresh response is still usable when storage is unavailable. */
  }
  const config = responses[id];
  return {
    ...saved,
    [config.field]: {
      answer: serializeResponseReference({
        collection,
        id: config.target,
        relationship: config.relationship,
      }),
    },
  };
}

const resolver: ResponseReferenceResolver = (reference) => {
  if (reference.collection !== collection || !isResponseId(reference.id))
    return { status: 'missing' };
  return {
    status: 'available',
    label: `Open ${responses[reference.id].title.toLowerCase()}`,
    href: `${
      import.meta.env.BASE_URL
    }linked-responses?response=${encodeURIComponent(reference.id)}`,
  };
};

function ResponseEditor({
  id,
  openResponse,
}: {
  id: ResponseId;
  openResponse: (id: ResponseId) => void;
}) {
  const config = responses[id];
  const rendererRef = useRef<EsheetRendererHandle>(null);
  const [initialResponses] = useState(() => readResponse(id));
  const draft = useRef(initialResponses);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const [saved, setSaved] = useState(initialResponses);
  const [message, setMessage] = useState(
    'Edit either response, then save or follow its link.'
  );
  const [saveError, setSaveError] = useState(false);

  const persist = useCallback(() => {
    localStorage.setItem(storageKey(id), JSON.stringify(draft.current));
  }, [id]);

  const save = useCallback(() => {
    try {
      persist();
      setSaved(draft.current);
      setMessage(`${config.title} saved in this browser.`);
      setSaveError(false);
      return true;
    } catch {
      setMessage(
        'The browser could not save this response. Keep this page open and allow local storage before navigating.'
      );
      setSaveError(true);
      return false;
    }
  }, [config.title, persist]);

  const onReady = useCallback(() => {
    const store = rendererRef.current?.getFormStore();
    if (!store) return;
    draft.current = store.getState().responses;
    unsubscribe.current?.();
    unsubscribe.current = store.subscribe((state) => {
      draft.current = state.responses;
    });
  }, []);

  useEffect(() => {
    const saveOnLeave = () => {
      try {
        persist();
      } catch {
        /* Explicit Save reports storage errors. */
      }
    };
    window.addEventListener('pagehide', saveOnLeave);
    return () => {
      window.removeEventListener('pagehide', saveOnLeave);
      unsubscribe.current?.();
      saveOnLeave();
    };
  }, [persist]);

  const providers = useMemo(
    () => [
      createResponseReferenceProvider(resolver, (reference) => {
        if (isResponseId(reference.id) && save()) openResponse(reference.id);
      }),
    ],
    [openResponse, save]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold">{config.title}</h2>
              <p className="mb-0 mt-1 text-sm text-muted-foreground">
                Response: {id}
              </p>
            </div>
            <Button onClick={save}>Save response</Button>
          </div>
          <p
            role={saveError ? 'alert' : 'status'}
            className={
              saveError ? 'text-destructive' : 'text-sm text-muted-foreground'
            }
          >
            {message}
          </p>
          <div
            onClickCapture={(event) => {
              // Preserve native modified clicks while saving before a new tab opens.
              if (
                (event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey) &&
                event.target instanceof Element &&
                event.target.closest('a[data-response-reference-state]') &&
                !save()
              )
                event.preventDefault();
            }}
            onAuxClickCapture={(event) => {
              if (
                event.button === 1 &&
                event.target instanceof Element &&
                event.target.closest('a[data-response-reference-state]') &&
                !save()
              )
                event.preventDefault();
            }}
          >
            <EsheetRenderer
              ref={rendererRef}
              formDataInput={config.definition}
              initialResponses={initialResponses}
              fieldProviders={providers}
              onReady={onReady}
            />
          </div>
        </CardContent>
      </Card>
      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="m-0 text-base font-semibold">
              Two independent responses
            </h2>
            <p className="text-sm text-muted-foreground">
              Each response uses its own YAML form and browser storage entry.
              Following a link saves your current edits and opens the other
              response.
            </p>
            <p className="text-sm text-muted-foreground">
              The link answer stores only a collection, response ID, and
              relationship. Changes to review notes stay in the review response.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (save()) openResponse(config.target);
              }}
            >
              Open {responses[config.target].title.toLowerCase()}
            </Button>
          </CardContent>
        </Card>
        <details className="rounded-lg border border-border bg-card p-5">
          <summary className="cursor-pointer font-medium">
            Saved response data
          </summary>
          <pre className="mt-4 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(saved, null, 2)}
          </pre>
        </details>
        <details className="rounded-lg border border-border bg-card p-5">
          <summary className="cursor-pointer font-medium">
            YAML form definition
          </summary>
          <pre className="mt-4 overflow-auto whitespace-pre-wrap text-xs">
            {config.definition}
          </pre>
        </details>
      </aside>
    </div>
  );
}

export function LinkedResponsesView() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('response');
  const id = isResponseId(requested) ? requested : 'overview-1';
  const openResponse = useCallback(
    (target: ResponseId) => setParams({ response: target }),
    [setParams]
  );
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <h1 className="m-0 text-3xl font-bold">Linked responses</h1>
        <p className="mb-8 mt-2 max-w-3xl text-muted-foreground">
          Edit an overview and its review as separate responses, and follow
          their links in either direction. This demo saves sample data in this
          browser.
        </p>
        <ResponseEditor key={id} id={id} openResponse={openResponse} />
      </main>
    </div>
  );
}
