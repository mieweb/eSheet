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

function injectWidget(): void {
  const script = document.createElement('script');
  script.src = 'https://ozwellapi.os.mieweb.org/embed/ozwell-loader.js';
  document.head.appendChild(script);

  const style = document.createElement('style');
  // Hide the favicon-based icon in the button and replace with a chat bubble SVG.
  style.textContent =
    '.ozwell-chat-icon{display:none!important;}' +
    ".ozwell-chat-button::after{content:'';display:block;width:24px;height:24px;background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath stroke='none' d='M0 0h24v24H0z' fill='none'/%3E%3Cpath d='M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10'/%3E%3Cpath d='M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'/%3E%3C/svg%3E\") center/contain no-repeat}";
  document.head.appendChild(style);
}

// Only inject the widget on builder/renderer views, not on the landing page.
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const currentPath = window.location.pathname;
if (currentPath !== basePath && currentPath !== basePath + '/') {
  injectWidget();
}

/**
 * Call on view mount to switch the active agent.
 * Pass FORMIE_KEY for the builder view, FLOWIE_KEY for the renderer view.
 */
export { FORMIE_KEY, FLOWIE_KEY };

export function updateOzwellTools(agentKey: string): void {
  window.OzwellChatConfig = { ...window.OzwellChatConfig, apiKey: agentKey };
  if (window.OzwellChat) {
    window.OzwellChat.configure({ apiKey: agentKey });
  } else {
    injectWidget();
  }
}
