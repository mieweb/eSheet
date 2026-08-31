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
  style.textContent = '.ozwell-chat-button{display:none!important;}';
  document.head.appendChild(style);

  return widgetLoad;
}

// Only inject the widget on builder/renderer views, not on the landing page.
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const currentPath = window.location.pathname;
if (currentPath !== basePath && currentPath !== basePath + '/') {
  void injectWidget().catch((error: unknown) => console.warn(error));
}

/**
 * Call on view mount to switch the active agent.
 * Pass FORMIE_KEY for the builder view, FLOWIE_KEY for the renderer view.
 */
export { FORMIE_KEY, FLOWIE_KEY };

export async function openOzwellChat(): Promise<void> {
  await injectWidget();
  await window.OzwellChat?.ready();
  window.OzwellChat?.open();
}

export function updateOzwellTools(agentKey: string): void {
  window.OzwellChatConfig = { ...window.OzwellChatConfig, apiKey: agentKey };
  if (window.OzwellChat) {
    window.OzwellChat.configure({ apiKey: agentKey });
  } else {
    void injectWidget().catch((error: unknown) => console.warn(error));
  }
}
