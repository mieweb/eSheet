import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';
import type {
  FieldPresence,
  FieldResponse,
  FormResponse,
  FormStore,
  NormalizedDefinition,
  ValidationError,
} from '@esheet/core';
import type { MdyFrontMatter } from './mdy.js';
import type { DocumentDraft } from './draftChannel.js';
import { bindDraftAnswers } from './draftBinding.js';

/**
 * The field type `@esheet/field-kerebron` registers for prose. A document type
 * that declares one gets its markdown from that field; the rest of the form is
 * the data layer.
 */
const BODY_FIELD_TYPE = 'richtext';

export interface DocumentListDefinitionDraft {
  /** The MDY data layer: everything except the prose. */
  readonly frontMatter: MdyFrontMatter;
  /** The markdown the body field holds. */
  readonly body: string;
  /** Every answer, body included — what a column projection reads. */
  readonly responses: FormResponse;
}

export interface DocumentListDefinitionFormHandle {
  /** The document as it stands, or the errors that block saving it. */
  collect: () => {
    readonly draft: DocumentListDefinitionDraft | null;
    readonly errors: readonly ValidationError[];
  };
}

export interface DocumentListDefinitionFormProps {
  /** A FormDefinition source — object or YAML/JSON string, as the renderer takes it. */
  readonly definition: unknown;
  /** The doc type this definition belongs to, recorded in the front matter. */
  readonly docType: string;
  /** The definition's version, so a document keeps rendering after an edit. */
  readonly definitionVersion?: string;
  /** Fires whenever the form goes from empty to answered, or back. */
  readonly onDirtyChange?: (dirty: boolean) => void;
  /** Binds every answer to the shared draft (ED.37); local-only when absent. */
  readonly draft?: DocumentDraft;
  /** Answers from the last saved revision, applied on ready (ED.40). */
  readonly initialResponses?: Readonly<Record<string, unknown>>;
  /** The saved body, loaded into the definition's `richtext` field (ED.40). */
  readonly initialBody?: string;
}

/** Ordered field ids: pages, then each page's fields and their children. */
function fieldIdsInOrder(normalized: NormalizedDefinition): string[] {
  const ordered: string[] = [];
  const visit = (fieldId: string): void => {
    ordered.push(fieldId);
    for (const childId of normalized.byId[fieldId]?.childIds ?? [])
      visit(childId);
  };
  for (const page of normalized.pages)
    for (const id of page.fieldIds) visit(id);
  return ordered;
}

/** The first `richtext` field is the body; a type without one is all data. */
function bodyFieldId(normalized: NormalizedDefinition): string | null {
  return (
    fieldIdsInOrder(normalized).find((id) => {
      // `richtext` comes from @esheet/field-kerebron, so it is outside the
      // built-in fieldType union — compare as a plain string.
      const fieldType: string = normalized.byId[id]?.definition.fieldType ?? '';
      return fieldType === BODY_FIELD_TYPE;
    }) ?? null
  );
}

function isAnswered(response: FieldResponse | undefined): boolean {
  if (!response) return false;
  if (typeof response.answer === 'string' && response.answer.trim())
    return true;
  return response.selected != null;
}

export function hasAnswers(responses: FormResponse): boolean {
  return Object.values(responses).some(isAnswered);
}

/**
 * One answer as the list would print it: the text a field holds, or the
 * display value(s) of what was selected. Matrix answers have no single
 * reading, so they stay out of columns.
 */
export function answerText(response: FieldResponse | undefined): string {
  if (!response) return '';
  if (typeof response.answer === 'string') return response.answer;
  const { selected } = response;
  if (!selected) return '';
  if (Array.isArray(selected))
    return selected.map((one) => one.value).join(', ');
  if ('value' in selected && typeof selected.value === 'string') {
    return selected.value;
  }
  return '';
}

/**
 * A document type whose shape is an eSheet form: meta fields plus a `richtext`
 * body. The compose panel portals out of the case form, so this renderer gets
 * its own store — it never nests inside the one the case is bound to.
 */
export const DocumentListDefinitionForm = forwardRef<
  DocumentListDefinitionFormHandle,
  DocumentListDefinitionFormProps
>(function DocumentListDefinitionForm(
  {
    definition,
    docType,
    definitionVersion,
    onDirtyChange,
    draft,
    initialResponses,
    initialBody,
  },
  handle
): React.JSX.Element {
  const renderer = useRef<EsheetRendererHandle>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const unbindDraft = useRef<(() => void) | null>(null);
  const [presenceByField, setPresenceByField] = useState<
    Record<string, FieldPresence[]>
  >({});

  // ED.38 — peers' focused fields become the renderer's presence dots, and
  // ours is published the same way; blur and unmount both say "nowhere".
  useEffect(() => {
    if (!draft) return;
    const off = draft.onPresence((present) => {
      const byField: Record<string, FieldPresence[]> = {};
      for (const entry of present) {
        if (!entry.fieldId) continue;
        (byField[entry.fieldId] ??= []).push({
          name: entry.user.name,
          color: entry.color ?? '#888',
        });
      }
      setPresenceByField(byField);
    });
    return () => {
      off();
      draft.publishFocus(null);
    };
  }, [draft]);

  const publishFocus = (target: EventTarget | null): void => {
    if (!draft || !(target instanceof Element)) return;
    draft.publishFocus(
      target.closest('[data-field-id]')?.getAttribute('data-field-id') ?? null
    );
  };

  useImperativeHandle(handle, () => ({
    collect: () => {
      const rendererHandle = renderer.current;
      if (!rendererHandle) return { draft: null, errors: [] };

      const { errors } = rendererHandle.getValidResponse();
      if (errors.length) return { draft: null, errors };

      const store: FormStore = rendererHandle.getFormStore();
      const { normalized, responses } = store.getState();
      const bodyId = bodyFieldId(normalized);
      const data: Record<string, FieldResponse> = { ...responses };
      // The prose lives in the body, not the front matter — MDY keeps one
      // source of truth for each layer.
      if (bodyId) delete data[bodyId];

      return {
        draft: {
          frontMatter: {
            docType,
            definition: store.getState().formId,
            ...(definitionVersion ? { definitionVersion } : {}),
            response: data,
          },
          body: bodyId ? responses[bodyId]?.answer ?? '' : '',
          responses,
        },
        errors: [],
      };
    },
  }));

  // Nothing else owns the subscriptions, so they have to end with the panel.
  useEffect(
    () => () => {
      unsubscribe.current?.();
      unbindDraft.current?.();
    },
    []
  );

  // The renderer has no onChange, so the dock's unsaved dot watches the store.
  // `onReady` fires after loadDefinition, which resets responses.
  const handleReady = (): void => {
    unsubscribe.current?.();
    unbindDraft.current?.();
    const store = renderer.current?.getFormStore();
    if (!store) return;
    // Prefill first (the reverse of the ED.30 save), so a brand-new draft is
    // seeded from the last saved revision when the binding attaches.
    if (initialResponses || initialBody != null) {
      const { setResponse, normalized } = store.getState();
      for (const [fieldId, response] of Object.entries(
        initialResponses ?? {}
      )) {
        setResponse(fieldId, response as FieldResponse);
      }
      const bodyId = bodyFieldId(normalized);
      if (bodyId && initialBody != null) {
        setResponse(bodyId, { answer: initialBody });
      }
    }
    // Bind next: a shared draft's answers must win over the fresh form
    // before the dirty watcher starts reporting.
    if (draft) unbindDraft.current = bindDraftAnswers(store, draft);
    let dirty = false;
    unsubscribe.current = store.subscribe((state, previous) => {
      if (state.responses === previous.responses) return;
      const next = hasAnswers(state.responses);
      if (next === dirty) return;
      dirty = next;
      onDirtyChange?.(next);
    });
  };

  return (
    <div
      className="document-list-workflow-panel__definition"
      onFocusCapture={(event) => publishFocus(event.target)}
      onBlurCapture={() => draft?.publishFocus(null)}
    >
      <EsheetRenderer
        ref={renderer}
        formDataInput={definition}
        onReady={handleReady}
        topNavigation={false}
        bottomNavigation={false}
        collab={draft ? { presenceByField } : undefined}
      />
    </div>
  );
});
