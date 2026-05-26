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

function getStoredKey(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { key: string; date: string };
    const today = new Date().toISOString().slice(0, 10);
    return parsed.date === today ? parsed.key : '';
  } catch {
    return '';
  }
}

function setStoredKey(key: string): void {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, date: today }));
}

function clearStoredKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

const storedKey = getStoredKey();
window.OzwellChatConfig = {};

function injectSetupCard(): void {
  // Floating bubble — sits in the same bottom-right spot Schemie would occupy.
  // Clicking it toggles the setup card.
  const bubble = document.createElement('button');
  bubble.id = 'ozwell-setup-bubble';
  bubble.title = 'Enable AI assistant';
  bubble.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:9999;width:56px;height:56px;border-radius:50%;' +
    'background:#2563eb;color:white;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.5);' +
    'display:flex;align-items:center;justify-content:center;';
  bubble.innerHTML =
    "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
    "<path stroke='none' d='M0 0h24v24H0z' fill='none'/>" +
    "<path d='M3 3l18 18'/>" +
    "<path d='M11 11a1 1 0 0 1 -1 -1m0 -3.968v-2.032a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10l-3 -3h-3'/>" +
    "<path d='M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'/>" +
    '</svg>';

  // Setup card — hidden until bubble is clicked.
  const card = document.createElement('div');
  card.id = 'ozwell-setup-card';
  card.style.cssText =
    'display:none;position:fixed;bottom:88px;right:20px;z-index:9998;background:#fff;' +
    'border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 4px 16px rgba(0,0,0,.15);' +
    'width:280px;font-family:system-ui,sans-serif;font-size:14px;';

  bubble.onclick = () => {
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  };

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

  const errorMsg = document.createElement('p');
  errorMsg.style.cssText =
    'margin:0 0 8px;color:#ef4444;font-size:12px;display:none;';

  const btn = document.createElement('button');
  btn.textContent = 'Enable AI assistant';
  btn.style.cssText =
    'background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer;width:100%;font-family:inherit;';
  btn.onclick = () => {
    const key = input.value.trim();
    errorMsg.style.display = 'none';
    input.style.borderColor = '#d1d5db';

    if (!key.startsWith('ozw_')) {
      input.style.borderColor = '#ef4444';
      errorMsg.textContent = 'Key must start with ozw_';
      errorMsg.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Validating…';

    fetch('https://ozwellapi.os.mieweb.org/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          throw new Error('invalid');
        }
        setStoredKey(key);
        window.location.reload();
      })
      .catch((err: unknown) => {
        btn.disabled = false;
        btn.textContent = 'Enable AI assistant';
        input.style.borderColor = '#ef4444';
        errorMsg.textContent =
          err instanceof Error && err.message === 'invalid'
            ? 'Invalid API key — not authorized.'
            : 'Could not reach Ozwell server. Check your connection.';
        errorMsg.style.display = 'block';
      });
  };

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(input);
  card.appendChild(errorMsg);
  card.appendChild(btn);
  document.body.appendChild(bubble);
  document.body.appendChild(card);
}

function injectWidget(): void {
  // Inject CDN widget — reads OzwellChatConfig set above.
  const script = document.createElement('script');
  script.src = 'https://ozwellapi.os.mieweb.org/embed/ozwell-loader.js';
  document.head.appendChild(script);

  // Swap the default Ozwell icon for the messages SVG directly in the DOM.
  // MutationObserver avoids CSP-blocked data: URIs in injected stylesheets.
  const observer = new MutationObserver(() => {
    const icon = document.querySelector<HTMLElement>('.ozwell-chat-icon');
    if (icon && !icon.dataset['custom']) {
      icon.dataset['custom'] = '1';
      icon.innerHTML =
        "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
        "<path stroke='none' d='M0 0h24v24H0z' fill='none'/>" +
        "<path d='M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10'/>" +
        "<path d='M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'/>" +
        '</svg>';
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (storedKey) {
  // Validate the stored key before showing the widget — prevents a stale/revoked
  // key from loading a broken widget. Widget is only injected after server confirms.
  fetch('https://ozwellapi.os.mieweb.org/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${storedKey}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    }),
  })
    .then((res) => {
      if (res.status === 401 || res.status === 403) {
        throw new Error('invalid');
      }
      window.OzwellChatConfig = {
        ...window.OzwellChatConfig,
        apiKey: storedKey,
        title: 'Schemie',
        welcomeMessage:
          'Hi! Ask me to create, update, or remove fields — or describe a whole form and I will build it.',
        debug: true,
      };
      injectWidget();
    })
    .catch(() => {
      // Key is invalid or server unreachable — clear it and show setup bubble.
      clearStoredKey();
      injectSetupCard();
    });
} else {
  // No key stored — show setup bubble, skip loading the widget entirely.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSetupCard);
  } else {
    injectSetupCard();
  }
}

// Call ozwellResetKey() in the browser console to clear the stored key.
(window as unknown as Record<string, unknown>).ozwellResetKey = () => {
  clearStoredKey();
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
