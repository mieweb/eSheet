import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createFormStore, createUIStore } from '@esheet/core';
import { vi } from 'vitest';
import { CodeView } from './CodeView.js';

vi.mock('@monaco-editor/react', () => ({
  Editor: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Form definition"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}));

afterEach(cleanup);

describe('CodeView', () => {
  it.each(['clear', 'reset', 'saved'] as const)(
    'preserves responses after %s when saving definition edits',
    (action) => {
      const form = createFormStore({
        id: 'defaults',
        pages: [
          {
            id: 'main',
            fields: [
              { id: 'text', fieldType: 'text', defaultAnswer: 'Default' },
            ],
          },
        ],
      });
      if (action === 'clear') form.getState().clearResponse('text');
      if (action === 'reset') form.getState().resetResponses();
      if (action === 'saved') {
        form.getState().setResponse('text', { answer: 'Saved answer' });
      }
      const expected = form.getState().responses;
      const view = render(<CodeView form={form} ui={createUIStore()} />);
      fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
      fireEvent.change(screen.getByLabelText('Form definition'), {
        target: {
          value: JSON.stringify({
            ...form.getState().hydrateDefinition(),
            title: 'Edited title',
          }),
        },
      });
      view.unmount();

      expect(form.getState().formTitle).toBe('Edited title');
      expect(form.getState().responses).toEqual(expected);
    }
  );
});
