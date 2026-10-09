import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackModal } from './FeedbackModal.js';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('FeedbackModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    container = document.createElement('div');
    trigger = document.createElement('button');
    document.body.append(trigger, container);
    trigger.focus();
    root = createRoot(container);
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: vi.fn(function (this: HTMLDialogElement) {
          this.open = true;
        }),
      },
      close: {
        configurable: true,
        value: vi.fn(function (this: HTMLDialogElement) {
          this.open = false;
        }),
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    trigger.remove();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    vi.restoreAllMocks();
  });

  it('focuses Cancel, describes the dialog and cancels on Escape', () => {
    const onClose = vi.fn();
    act(() =>
      root.render(
        <FeedbackModal
          open
          title="Unsaved note"
          message="Leave this case?"
          showCancel
          cancelLabel="Stay"
          confirmLabel="Leave case"
          onClose={onClose}
        />
      )
    );
    const dialog = container.querySelector('dialog');
    if (!dialog) throw new Error('Expected an open feedback dialog');
    expect(dialog.open).toBe(true);
    expect(document.activeElement?.textContent).toBe('Stay');
    expect(
      document.getElementById(dialog.getAttribute('aria-describedby') ?? '')
        ?.textContent
    ).toBe('Leave this case?');
    const underlyingKeyHandler = vi.fn();
    document.addEventListener('keydown', underlyingKeyHandler);
    try {
      act(() =>
        dialog.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        )
      );
      expect(underlyingKeyHandler).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', underlyingKeyHandler);
    }
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();
    const cancel = new Event('cancel', { cancelable: true });
    act(() => dialog.dispatchEvent(cancel));
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.render(null));
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps confirm and backdrop cancellation separate', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    act(() =>
      root.render(
        <FeedbackModal
          open
          title="Warning"
          message="Continue?"
          showCancel
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )
    );
    const buttons = container.querySelectorAll('button');
    act(() => buttons[1].click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    const dialog = container.querySelector('dialog');
    if (!dialog) throw new Error('Expected an open feedback dialog');
    act(() => dialog.click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing while closed', () => {
    act(() =>
      root.render(
        <FeedbackModal
          open={false}
          title="Hidden"
          message="Hidden"
          onClose={() => {}}
        />
      )
    );
    expect(container.childElementCount).toBe(0);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });
});
