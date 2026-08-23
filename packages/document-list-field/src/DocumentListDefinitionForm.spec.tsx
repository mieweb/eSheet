import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { FormDefinition } from '@esheet/core';
import { DocumentListComposePanel } from './DocumentListWorkflows.js';
import { parseMdy } from './mdy.js';
import type { DocumentListRuntimeState } from './document-list-runtime.js';
import type {
  DocumentListContentInput,
  DocumentListDocument,
  DocumentListWorkflowMode,
} from './types.js';

/**
 * The renderer is tested in `@esheet/renderer`. This stand-in drives the real
 * `FormStore` — the part `DocumentListDefinitionForm` actually reads — through
 * plain inputs, so normalization, body extraction and validation stay honest
 * without mounting every field component in jsdom.
 */
vi.mock('@esheet/renderer', async () => {
  const { createElement, forwardRef, useEffect, useImperativeHandle, useMemo, useReducer } =
    await import('react');
  const { createFormStore, validateForm } = await import('@esheet/core');

  const EsheetRenderer = forwardRef(function EsheetRenderer(
    { formDataInput, onReady }: { formDataInput: unknown; onReady?: () => void },
    ref
  ) {
    const store = useMemo(() => createFormStore(), []);
    const [, rerender] = useReducer((count: number) => count + 1, 0);

    useEffect(() => {
      store.getState().loadDefinition(formDataInput as FormDefinition);
      onReady?.();
      rerender();
      return store.subscribe(() => rerender());
      // Mount only: the compose panel remounts the form when the type changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      getFormStore: () => store,
      getValidResponse: () => {
        const { normalized, responses } = store.getState();
        return { response: responses, errors: validateForm(normalized, responses) };
      },
    }));

    const { normalized, responses } = store.getState();
    return createElement(
      'div',
      null,
      normalized.pages.flatMap((page) =>
        page.fieldIds.map((fieldId) =>
          createElement(
            'label',
            { key: fieldId },
            normalized.byId[fieldId].definition.question ?? fieldId,
            createElement('input', {
              value: responses[fieldId]?.answer ?? '',
              onChange: (event: { target: { value: string } }) =>
                store
                  .getState()
                  .setResponse(fieldId, { answer: event.target.value }),
            })
          )
        )
      )
    );
  });

  return { EsheetRenderer };
});

const acknowledgement = {
  id: 'acknowledgement',
  pages: [
    {
      id: 'letter',
      fields: [
        { id: 'title', fieldType: 'text', question: 'Title', required: true },
        { id: 'recipient', fieldType: 'text', question: 'Recipient' },
        { id: 'body', fieldType: 'richtext', question: 'Letter' },
      ],
    },
  ],
} as unknown as FormDefinition;

function createRuntime(): DocumentListRuntimeState {
  return {
    saveDocument: vi.fn(async (savedDocument) => savedDocument),
    loadContent: async () => undefined,
  } as unknown as DocumentListRuntimeState;
}

function renderCompose(runtime: DocumentListRuntimeState): void {
  render(<ComposeHarness runtime={runtime} />);
}

/** Stands in for the composer session: owns the dock mode. */
function ComposeHarness({
  runtime,
}: {
  runtime: DocumentListRuntimeState;
}): React.JSX.Element {
  const [mode, setMode] = useState<DocumentListWorkflowMode>('full');
  return (
    <DocumentListComposePanel
      open
      onOpenChange={vi.fn()}
      runtime={runtime}
      inputPrefix="form-1-letters"
      noun="letter"
      mode={mode}
      onModeChange={setMode}
      docTypes={[
        {
          id: 'acknowledgement',
          label: 'Acknowledgement',
          definition: acknowledgement,
          definitionVersion: '1',
        },
        { id: 'note' },
      ]}
    />
  );
}

function savedCall(
  runtime: DocumentListRuntimeState
): [DocumentListDocument, DocumentListContentInput] {
  return (runtime.saveDocument as ReturnType<typeof vi.fn>).mock.calls[0] as [
    DocumentListDocument,
    DocumentListContentInput,
  ];
}

describe('a document type with a definition', () => {
  it('fills the type\u2019s form instead of the bare title and subject inputs', async () => {
    renderCompose(createRuntime());

    await waitFor(() => expect(screen.getByLabelText('Recipient')).toBeTruthy());
    // The definition owns Title, so the panel drops its own copy.
    expect(screen.queryByLabelText('Subject')).toBeNull();
    expect(
      globalThis.document.querySelector('.document-list-compose-editor')
    ).toBeNull();
    // The type picker stays: it is what chooses the form.
    expect(screen.getByLabelText('Document type')).toBeTruthy();
  });

  it('saves the answers as front matter and the richtext field as the body', async () => {
    const runtime = createRuntime();
    renderCompose(runtime);

    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: 'Claim acknowledged' },
    });
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: 'Lisa Ryan' },
    });
    fireEvent.change(screen.getByLabelText('Letter'), {
      target: { value: 'We have received your claim.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save letter' }));

    await waitFor(() => expect(runtime.saveDocument).toHaveBeenCalledOnce());
    const [savedDocument, content] = savedCall(runtime);

    expect(savedDocument.title).toBe('Claim acknowledged');
    expect(savedDocument.docType).toBe('acknowledgement');

    const saved = parseMdy(content.content as string);
    expect(saved.body).toBe('We have received your claim.');
    expect(saved.frontMatter).toEqual({
      docType: 'acknowledgement',
      definition: 'acknowledgement',
      definitionVersion: '1',
      response: {
        title: { answer: 'Claim acknowledged' },
        recipient: { answer: 'Lisa Ryan' },
      },
    });
  });

  it('reports the definition\u2019s own validation instead of saving', async () => {
    const runtime = createRuntime();
    renderCompose(runtime);

    await waitFor(() => expect(screen.getByLabelText('Recipient')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Save letter' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(runtime.saveDocument).not.toHaveBeenCalled();
  });

  it('marks the dock unsaved once the form has an answer', async () => {
    renderCompose(createRuntime());

    await waitFor(() => expect(screen.getByLabelText('Recipient')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Recipient'), {
      target: { value: 'Lisa Ryan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse to dock' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Unsaved changes')).toBeTruthy()
    );
  });

  it('falls back to the note tier for a type without a definition', async () => {
    renderCompose(createRuntime());

    await waitFor(() => expect(screen.getByLabelText('Recipient')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Document type'), {
      target: { value: 'note' },
    });

    expect(screen.queryByLabelText('Recipient')).toBeNull();
    // @mieweb/ui's Input appends a required marker, so match the label's start.
    expect(screen.getByLabelText(/^Title/)).toBeTruthy();
    expect(screen.getByLabelText(/^Subject/)).toBeTruthy();
  });
});
