import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ResponseReferenceResolution,
  ResponseReferenceResolver,
} from '@esheet/core';
import {
  ResponseReferenceLink,
  ResponseReferenceProvider,
} from './ResponseReference.js';

afterEach(cleanup);

const reference = { collection: 'reviews', id: 'review-7' };
const available = {
  status: 'available',
  label: 'Open review',
  href: '/reviews/7',
} as const;

function deferred() {
  let resolve!: (result: ResponseReferenceResolution) => void;
  const promise = new Promise<ResponseReferenceResolution>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('ResponseReferenceLink', () => {
  it('renders an unavailable, disabled link without a host resolver', () => {
    render(<ResponseReferenceLink reference={reference} />);
    const link = screen.getByRole('link', {
      name: 'Linked response unavailable',
    });
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('href')).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///tmp/test',
    'https://user:password@example.com/review',
    '//user:password@example.com/review',
    '/review\n/7',
    ' /reviews/7',
    '\\evil.example/review',
  ])('disables unsafe resolver URLs: %s', async (href) => {
    render(
      <ResponseReferenceLink
        reference={reference}
        resolver={() => ({ ...available, href })}
      />
    );
    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBeNull();
    expect(link.getAttribute('aria-disabled')).toBe('true');
  });

  it.each([
    '/reviews/7',
    'https://example.com/reviews/7',
    'http://localhost/reviews/7',
  ])('keeps an approved browser URL: %s', async (href) => {
    render(
      <ResponseReferenceLink
        reference={reference}
        resolver={() => ({ ...available, href })}
      />
    );
    expect((await screen.findByRole('link')).getAttribute('href')).toBe(href);
  });

  it('supports a restricted explanatory destination without fetching target answers', async () => {
    const resolver = vi.fn<ResponseReferenceResolver>(() => ({
      status: 'restricted',
      label: 'Review access is required',
      href: '/access/reviews/7',
    }));
    render(
      <ResponseReferenceProvider resolver={resolver}>
        <ResponseReferenceLink reference={reference} />
      </ResponseReferenceProvider>
    );
    const link = await screen.findByRole('link', {
      name: 'Review access is required',
    });
    expect(link.getAttribute('href')).toBe('/access/reviews/7');
    expect(link.getAttribute('data-response-reference-state')).toBe(
      'restricted'
    );
    expect(resolver).toHaveBeenCalledWith(reference, expect.any(AbortSignal));
  });

  it('disables restricted references without a safe explanatory URL', async () => {
    render(
      <ResponseReferenceLink
        reference={reference}
        resolver={() => ({ status: 'restricted', href: 'javascript:alert(1)' })}
      />
    );
    const link = await screen.findByRole('link', {
      name: 'Restricted response',
    });
    expect(link.getAttribute('href')).toBeNull();
    expect(link.getAttribute('aria-disabled')).toBe('true');
  });

  it('preserves native navigation when the host does not intercept it', async () => {
    render(
      <ResponseReferenceLink reference={reference} resolver={() => available} />
    );
    const link = await screen.findByRole('link');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    // Prevent jsdom from trying to navigate after observing the component's decision.
    let preventedByComponent = true;
    document.addEventListener(
      'click',
      (click) => {
        preventedByComponent = click.defaultPrevented;
        click.preventDefault();
      },
      { once: true }
    );
    fireEvent(link, event);
    expect(preventedByComponent).toBe(false);
  });

  it('intercepts ordinary clicks while preserving modified and middle clicks', async () => {
    const onNavigate = vi.fn();
    render(
      <ResponseReferenceLink
        reference={reference}
        resolver={() => available}
        onNavigate={onNavigate}
      />
    );
    const link = await screen.findByRole('link');
    expect(fireEvent.click(link)).toBe(false);
    expect(onNavigate).toHaveBeenCalledWith(reference, available);
    onNavigate.mockClear();
    for (const modifier of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      let preventedByComponent = true;
      document.addEventListener(
        'click',
        (event) => {
          preventedByComponent = event.defaultPrevented;
          event.preventDefault();
        },
        { once: true }
      );
      fireEvent.click(link, modifier);
      expect(preventedByComponent).toBe(false);
    }
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('aborts on target change and ignores an older resolver completion', async () => {
    const old = deferred();
    const next = deferred();
    const resolver = vi
      .fn<ResponseReferenceResolver>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const { rerender } = render(
      <ResponseReferenceLink reference={reference} resolver={resolver} />
    );
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    const oldSignal = resolver.mock.calls[0][1];
    rerender(
      <ResponseReferenceLink
        reference={{ ...reference, id: 'review-8' }}
        resolver={resolver}
      />
    );
    expect(oldSignal.aborted).toBe(true);
    await act(async () => old.resolve(available));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Loading');
    await act(async () =>
      next.resolve({ ...available, label: 'Next review', href: '/reviews/8' })
    );
    expect(
      screen.getByRole('link', { name: 'Next review' }).getAttribute('href')
    ).toBe('/reviews/8');
  });

  it('immediately clears resolved metadata when the host session resolver changes', async () => {
    const next = deferred();
    const oldResolver = vi.fn<ResponseReferenceResolver>(() => available);
    const nextResolver = vi.fn<ResponseReferenceResolver>(() => next.promise);
    const { rerender, unmount } = render(
      <ResponseReferenceLink reference={reference} resolver={oldResolver} />
    );
    await screen.findByRole('link', { name: 'Open review' });
    rerender(
      <ResponseReferenceLink reference={reference} resolver={nextResolver} />
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(oldResolver.mock.calls[0][1].aborted).toBe(true);
    await waitFor(() => expect(nextResolver).toHaveBeenCalledOnce());
    await act(async () => next.resolve({ status: 'restricted' }));
    expect(
      screen
        .getByRole('link', { name: 'Restricted response' })
        .getAttribute('href')
    ).toBeNull();
    unmount();
    expect(nextResolver.mock.calls[0][1].aborted).toBe(true);
  });

  it('handles a failed resolution as unavailable', async () => {
    render(
      <ResponseReferenceLink
        reference={reference}
        resolver={() => Promise.reject(new Error('denied'))}
      />
    );
    expect(
      (
        await screen.findByRole('link', { name: 'Linked response unavailable' })
      ).getAttribute('aria-disabled')
    ).toBe('true');
  });
});
