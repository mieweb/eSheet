// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createOzwellBridge,
  mountStandaloneRenderer,
  getOzwellChatConfig,
} from './index.js';

const formDataInput = {
  id: 'ozwell-form',
  pages: [
    {
      id: 'page-1',
      fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
    },
  ],
};

function dispatchToolCall(
  name: string,
  args: Record<string, unknown>,
  target: EventTarget = document
) {
  return new Promise<unknown>((resolve) => {
    target.dispatchEvent(
      new CustomEvent('ozwell-tool-call', {
        detail: { name, arguments: args, respond: resolve },
      })
    );
  });
}

describe('Ozwell bridge', () => {
  it('disposes the bridge when root creation fails', () => {
    expect(() =>
      mountStandaloneRenderer(null as unknown as Element, {
        formDataInput,
        ozwell: true,
      })
    ).toThrow(/container/i);
    const bridge = createOzwellBridge();
    const respond = vi.fn();
    try {
      document.dispatchEvent(
        new CustomEvent('ozwell-tool-call', {
          detail: { name: 'get_form', arguments: {}, respond },
        })
      );
      expect(respond).toHaveBeenCalledOnce();
    } finally {
      bridge.dispose();
    }
  });

  it('initializes tools before a synchronous tool call from onReady', async () => {
    let initialFill: Promise<unknown> | undefined;
    const onRendererToolsReady = vi.fn();
    const onReady = vi.fn(() => {
      expect(onRendererToolsReady).toHaveBeenCalledOnce();
      initialFill = dispatchToolCall('postMessage:fill_field', {
        fieldId: 'q1',
        value: 'Jane',
      });
    });
    let handle!: ReturnType<typeof mountStandaloneRenderer>;
    act(() => {
      handle = mountStandaloneRenderer(document.createElement('div'), {
        formDataInput,
        ozwell: true,
        onReady,
        onRendererToolsReady,
      });
    });
    try {
      await initialFill;
      expect(onReady).toHaveBeenCalledOnce();
      expect(handle.getResponse()).toMatchObject({ q1: { answer: 'Jane' } });
    } finally {
      act(() => handle.unmount());
    }
  });

  it('rejects duplicate bridges and releases registration only once', () => {
    const bridge = createOzwellBridge();
    try {
      expect(() => createOzwellBridge()).toThrow('already exists');
    } finally {
      bridge.dispose();
    }
    const replacement = createOzwellBridge();
    try {
      bridge.dispose();
      expect(() => createOzwellBridge()).toThrow('already exists');
      const separateEvent = createOzwellBridge({ eventName: 'other-tools' });
      separateEvent.dispose();
    } finally {
      replacement.dispose();
    }
  });

  it('isolates renderers with overlapping field IDs on separate targets', async () => {
    const firstTarget = new EventTarget();
    const secondTarget = new EventTarget();
    let first!: ReturnType<typeof mountStandaloneRenderer>;
    let second!: ReturnType<typeof mountStandaloneRenderer>;
    act(() => {
      first = mountStandaloneRenderer(document.createElement('div'), {
        formDataInput,
        ozwell: { target: firstTarget },
      });
      second = mountStandaloneRenderer(document.createElement('div'), {
        formDataInput,
        ozwell: { target: secondTarget },
      });
    });
    try {
      await act(async () => {
        await dispatchToolCall(
          'fill_field',
          { fieldId: 'q1', value: 'Jane' },
          firstTarget
        );
      });
      expect(first.getResponse()).toMatchObject({ q1: { answer: 'Jane' } });
      expect(second.getResponse()).not.toHaveProperty('q1');
      await act(async () => {
        await dispatchToolCall(
          'fill_field',
          { fieldId: 'q1', value: 'John' },
          secondTarget
        );
        await dispatchToolCall('clear_responses', {}, firstTarget);
      });
      expect(first.getResponse()).not.toHaveProperty('q1');
      expect(second.getResponse()).toMatchObject({ q1: { answer: 'John' } });
    } finally {
      act(() => {
        first.unmount();
        second.unmount();
      });
    }
  });

  it('ignores tools owned by other integrations before the renderer is ready', () => {
    const bridge = createOzwellBridge();
    const respond = vi.fn();
    try {
      document.dispatchEvent(
        new CustomEvent('ozwell-tool-call', {
          detail: { name: 'postMessage:search_docs', arguments: {}, respond },
        })
      );
      expect(respond).not.toHaveBeenCalled();
    } finally {
      bridge.dispose();
    }
  });

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

    const respond = vi.fn();
    document.dispatchEvent(
      new CustomEvent('ozwell-tool-call', {
        detail: { name: 'search_docs', arguments: {}, respond },
      })
    );
    expect(respond).not.toHaveBeenCalled();

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
    expect(config.system).toContain(
      'supplied or explicitly confirmed by the user'
    );
    expect(config.system).toContain('Ask the user for missing information');
    expect(config.system).toContain('Never fabricate, guess, or generate mock');
    expect(config.system).not.toContain('generate a realistic mock value');
  });
});
