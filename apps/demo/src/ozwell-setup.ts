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

const STORAGE_KEY = 'ozwell_api_key';
const storedKey = localStorage.getItem(STORAGE_KEY) ?? '';

function injectSetupCard(): void {
  const card = document.createElement('div');
  card.id = 'ozwell-setup-card';
  card.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:9998;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 4px 16px rgba(0,0,0,.15);width:280px;font-family:system-ui,sans-serif;font-size:14px;';

  const title = document.createElement('p');
  title.style.cssText = 'margin:0 0 6px;color:#111827;font-weight:600;';
  title.textContent = '🔑 AI Assistant setup';

  const desc = document.createElement('p');
  desc.style.cssText =
    'margin:0 0 10px;color:#6b7280;font-size:12px;line-height:1.4;';
  desc.textContent =
    'Enter your Ozwell parent API key (ozw_…) to enable the AI chat widget.';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'ozw_...';
  input.style.cssText =
    'width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;padding:6px 10px;font-size:13px;margin-bottom:8px;outline:none;font-family:inherit;';

  const btn = document.createElement('button');
  btn.textContent = 'Enable AI assistant';
  btn.style.cssText =
    'background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer;width:100%;font-family:inherit;';
  btn.onclick = () => {
    const key = input.value.trim();
    if (!key.startsWith('ozw_')) {
      input.style.borderColor = '#ef4444';
      return;
    }
    localStorage.setItem(STORAGE_KEY, key);
    window.location.reload();
  };

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(input);
  card.appendChild(btn);
  document.body.appendChild(card);
}

if (storedKey) {
  window.OzwellChatConfig = {
    apiKey: storedKey,
    title: 'Schemie',
    welcomeMessage:
      'Hi! Ask me to create, update, or remove fields — or describe a whole form and I will build it.',
    debug: true,
  };

  // Inject CDN widget — reads OzwellChatConfig set above.
  const script = document.createElement('script');
  script.src = 'https://ozwellapi.os.mieweb.org/embed/ozwell-loader.js';
  document.head.appendChild(script);

  // Swap the default Ozwell icon for the eSheet logo.
  const style = document.createElement('style');
  style.textContent =
    '.ozwell-chat-icon{display:none!important;}' +
    ".ozwell-chat-button::after{content:'';display:block;width:32px;height:32px;background:url(\"data:image/svg+xml,%3Csvg width='512' height='512' viewBox='0 0 128 128' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='20' y='16' width='88' height='96' rx='14' stroke='white' stroke-width='8'/%3E%3Crect x='34' y='34' width='56' height='12' rx='6' fill='white'/%3E%3Crect x='34' y='58' width='40' height='12' rx='6' fill='white'/%3E%3Crect x='34' y='82' width='56' height='12' rx='6' fill='white'/%3E%3C/svg%3E\") center/contain no-repeat}";
  document.head.appendChild(style);
} else {
  // No key stored — show setup card, skip loading the widget entirely.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSetupCard);
  } else {
    injectSetupCard();
  }
}

// Call ozwellResetKey() in the browser console to clear the stored key.
(window as unknown as Record<string, unknown>).ozwellResetKey = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};

/**
 * Call on view mount to push the correct tool schemas and system prompt into the
 * widget for the active context (builder vs renderer). Handles both the case
 * where the widget is already initialised (configure()) and where it hasn't
 * loaded yet (updates OzwellChatConfig so the widget picks it up on init).
 */
export function updateOzwellTools(tools: unknown[], system: string): void {
  window.OzwellChatConfig = { ...window.OzwellChatConfig, tools, system };
  window.OzwellChat?.configure({ tools, system });
}
