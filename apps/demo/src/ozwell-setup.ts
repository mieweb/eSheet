declare global {
  interface Window {
    OzwellChatConfig: Record<string, unknown>;
    OzwellChat?: {
      iframe: HTMLIFrameElement | null;
      isOpen: boolean;
      hasUnread: boolean;
      mount(options?: Record<string, unknown>): HTMLIFrameElement;
      configure(config: Record<string, unknown>): void;
      open(): void;
      close(): void;
      ready(): Promise<void>;
    };
  }
}

const FORMIE_KEY = 'agnt_key-mq5nn2ov8299ccaecdbcdde4';
const FLOWIE_KEY = 'agnt_key-mq5nm09n3c1945f5835bf1d2';

window.OzwellChatConfig = { apiKey: FORMIE_KEY };

let widgetLoad: Promise<void> | undefined;

function injectWidget(): Promise<void> {
  if (window.OzwellChat) return Promise.resolve();
  if (widgetLoad) return widgetLoad;

  widgetLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://ozwellapi.os.mieweb.org/embed/ozwell-loader.js';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Ozwell failed to load')),
      { once: true }
    );
    document.head.appendChild(script);
  });

  const style = document.createElement('style');
  style.textContent =
    'html:not([data-ozwell-active]) :is(.ozwell-chat-button, .ozwell-chat-wrapper), .ozwell-chat-wrapper.hidden{display:none!important;}';
  document.head.appendChild(style);

  return widgetLoad;
}

/**
 * Call on view mount to enable chat and switch the active agent; return its cleanup.
 * Pass FORMIE_KEY for the builder view, FLOWIE_KEY for the renderer view.
 */
export { FORMIE_KEY, FLOWIE_KEY };

export async function openOzwellChat(): Promise<void> {
  await injectWidget();
  await window.OzwellChat?.ready();
  window.OzwellChat?.open();
}

export function updateOzwellTools(agentKey: string): () => void {
  document.documentElement.setAttribute('data-ozwell-active', '');
  window.OzwellChatConfig = { ...window.OzwellChatConfig, apiKey: agentKey };
  if (window.OzwellChat) {
    window.OzwellChat.configure({ apiKey: agentKey });
  } else {
    void injectWidget().catch((error: unknown) => console.warn(error));
  }

  return () => {
    document.documentElement.removeAttribute('data-ozwell-active');
    window.OzwellChat?.close();
  };
}
