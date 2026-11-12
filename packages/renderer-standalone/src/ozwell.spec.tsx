// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { mountStandaloneRenderer, getOzwellChatConfig } from './index.js';

const formDataInput = {
  id: 'ozwell-form',
  pages: [
    {
      id: 'page-1',
      fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
    },
  ],
};

function dispatchToolCall(name: string, args: Record<string, unknown>) {
  return new Promise<unknown>((resolve) => {
    document.dispatchEvent(
      new CustomEvent('ozwell-tool-call', {
        detail: { name, arguments: args, respond: resolve },
      })
    );
  });
}

describe('Ozwell bridge', () => {
  it('fills a field from an ozwell-tool-call event and detaches on unmount', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let handle!: ReturnType<typeof mountStandaloneRenderer>;
    act(() => {
      handle = mountStandaloneRenderer(container, {
        formDataInput,
        ozwell: true,
      });
    });
    await waitFor(() =>
      expect(container.querySelector('input')).not.toBeNull()
    );

    await act(async () => {
      await dispatchToolCall('fill_field', { fieldId: 'q1', value: 'Jane' });
    });
    expect(handle.getResponse()).toMatchObject({ q1: { answer: 'Jane' } });
    expect(container.querySelector('input')?.value).toBe('Jane');

    act(() => handle.unmount());
    const timedOut = await Promise.race([
      dispatchToolCall('get_form', {}).then(() => false),
      new Promise((r) => setTimeout(() => r(true), 50)),
    ]);
    expect(timedOut).toBe(true);
  });

  it('exposes tool definitions and a system prompt for the widget config', () => {
    const config = getOzwellChatConfig();
    expect(config.tools.map((t) => t.function.name)).toContain('fill_field');
    expect(config.system.length).toBeGreaterThan(0);
  });
});
