// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createFormStore, type FormDefinition } from '@esheet/core';
import { RendererView } from './RendererView.js';
import {
  responseDocumentLabels as labels,
  type ResponseDocumentSnapshot,
} from '../components/ResponseDocumentPreview.js';

const harness = vi.hoisted(() => ({
  store: null as unknown as ReturnType<typeof createFormStore>,
  snapshot: null as ResponseDocumentSnapshot | null,
  validate: vi.fn(),
}));

vi.mock('../components/Navbar', () => ({ Navbar: () => null }));
vi.mock('../ozwell-setup.js', () => ({
  updateOzwellTools: vi.fn(),
  FLOWIE_KEY: '',
}));
vi.mock('@esheet/fields', () => ({ createFileStoreProvider: vi.fn() }));
vi.mock('@esheet/fields-documents', () => ({
  createDocumentListFieldProvider: vi.fn(),
  permissiveDocumentListCapabilities: {},
}));
vi.mock('../document-list-demo-repository.js', () => ({
  createDemoDocumentListRepository: vi.fn(),
  createDemoFileStore: vi.fn(),
}));
vi.mock('@esheet/renderer', async () => {
  const React = await import('react');
  return {
    useRendererMcpToolHandler: vi.fn(),
    EsheetRenderer: React.forwardRef(function FakeRenderer(_props, ref) {
      React.useImperativeHandle(ref, () => ({
        getFormStore: () => harness.store,
        getValidResponse: harness.validate,
      }));
      return null;
    }),
  };
});
vi.mock('../components/ResponseDocumentPreview.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('../components/ResponseDocumentPreview.js')
  >();
  return {
    ...original,
    ResponseDocumentPreview: ({
      snapshot,
      onClose,
    }: {
      snapshot: ResponseDocumentSnapshot | null;
      onClose: () => void;
    }) => {
      harness.snapshot = snapshot;
      return snapshot ? (
        <button onClick={onClose}>Close test preview</button>
      ) : null;
    },
  };
});
vi.mock('@esheet/adapters', () => ({ exportResponse: vi.fn() }));
vi.mock('@esheet/adapters/html', () => ({ renderResponseHtml: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('snapshots the latest real store including hidden/orphan answers without completion validation, then invalidates edits', async () => {
  const definition: FormDefinition = {
    id: 'live',
    title: 'Original',
    pages: [
      {
        id: 'page',
        fields: [
          {
            id: 'required',
            fieldType: 'text',
            question: 'Required',
            required: true,
          },
          {
            id: 'hidden',
            fieldType: 'text',
            question: 'Hidden',
            rules: [
              {
                effect: 'visible',
                logic: 'AND',
                conditions: [
                  { conditionType: 'expression', expression: 'false' },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  harness.store = createFormStore(definition);
  render(<RendererView />);
  const open = screen.getByRole('button', { name: labels.open });
  expect((open as HTMLButtonElement).disabled).toBe(true);
  // Use a real schema-selection action to mount the renderer handle.
  fireEvent.click(screen.getByRole('button', { name: 'Paste YAML/JSON' }));
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: JSON.stringify(definition) },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false));
  act(() => {
    harness.store.getState().setFormTitle('Latest title');
    harness.store.getState().setResponse('hidden', { answer: 'Secret' });
    harness.store.getState().setResponse('orphan', { answer: 'Retained' });
  });
  fireEvent.click(open);
  expect(harness.snapshot?.form).toEqual(
    harness.store.getState().hydrateDefinition()
  );
  expect(harness.snapshot?.form.title).toBe('Latest title');
  expect(harness.snapshot?.response).toEqual(
    harness.store.getState().responses
  );
  expect(harness.snapshot?.response).not.toBe(
    harness.store.getState().responses
  );
  expect(harness.snapshot?.response.hidden.answer).toBe('Secret');
  expect(harness.snapshot?.response.orphan.answer).toBe('Retained');
  expect(harness.validate).not.toHaveBeenCalled();
  const previous = harness.snapshot;
  act(() =>
    harness.store.getState().setResponse('hidden', { answer: 'Updated' })
  );
  expect(harness.snapshot).toBeNull();
  expect(previous?.response.hidden.answer).toBe('Secret');
  fireEvent.click(open);
  expect(harness.snapshot?.response.hidden.answer).toBe('Updated');
  act(() => harness.store.getState().setFormTitle('New schema title'));
  expect(harness.snapshot).toBeNull();
  fireEvent.click(open);
  fireEvent.click(screen.getByRole('button', { name: 'Close test preview' }));
  expect(harness.snapshot).toBeNull();
});
