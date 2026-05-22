// eslint-disable-next-line @nx/enforce-module-boundaries
import { BUILDER_SYSTEM_PROMPT } from '@esheet/builder';

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

const apiKey = import.meta.env['OZWELL_API_KEY'] as string | undefined;
// eslint-disable-next-line no-console
console.log('[Ozwell] apiKey present:', !!apiKey, '| prefix:', apiKey?.slice(0, 7));

window.OzwellChatConfig = {
  apiKey: apiKey ?? '',
  title: 'Schemie',
  welcomeMessage:
    'Hi! Ask me to create, update, or remove fields — or describe a whole form and I will build it.',
  system: BUILDER_SYSTEM_PROMPT,
  debug: true,
};

// Dynamically inject the CDN widget script so it reads the config set above.
const script = document.createElement('script');
script.src =
  'https://ozwellapi.os.mieweb.org/embed/ozwell-loader.js';
document.head.appendChild(script);

// Inject custom chat bubble icon and apply app branding to the widget button/header.
const style = document.createElement('style');
style.textContent =
  '.ozwell-chat-icon{display:none!important;}' +
  ".ozwell-chat-button::after{content:'';display:block;width:32px;height:32px;background:url(\"data:image/svg+xml,%3Csvg width='512' height='512' viewBox='0 0 128 128' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='20' y='16' width='88' height='96' rx='14' stroke='white' stroke-width='8'/%3E%3Crect x='34' y='34' width='56' height='12' rx='6' fill='white'/%3E%3Crect x='34' y='58' width='40' height='12' rx='6' fill='white'/%3E%3Crect x='34' y='82' width='56' height='12' rx='6' fill='white'/%3E%3C/svg%3E\") center/contain no-repeat}" +
  '.ozwell-chat-button{background:var(--mieweb-primary-500,#27aae1)!important;box-shadow:0 4px 16px color-mix(in srgb,var(--mieweb-primary-500,#27aae1) 30%,transparent)!important;}' +
  '.ozwell-chat-button:hover{box-shadow:0 6px 20px color-mix(in srgb,var(--mieweb-primary-500,#27aae1) 40%,transparent)!important;}' +
  '.ozwell-chat-header{background:var(--mieweb-primary-500,#27aae1)!important;}';
document.head.appendChild(style);

/**
 * Swap the active tool set and system prompt in the Ozwell widget.
 * Call this on mount in each view so the AI uses the right tools for the current page.
 */
export function updateOzwellTools(tools: unknown[], system: string): void {
  window.OzwellChatConfig = { ...window.OzwellChatConfig, tools, system };
  window.OzwellChat?.configure({ tools, system });
}

// Inject brand colors into the widget iframe (Send button, user messages, input focus).
// The iframe is same-origin (srcdoc + allow-same-origin) so we can access its document.
document.addEventListener('ozwell:ready', () => {
  const iframe = window.OzwellChat?.iframe;
  if (!iframe?.contentDocument) return;
  const primary =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--mieweb-primary-500')
      .trim() || '#27aae1';
  const s = iframe.contentDocument.createElement('style');
  s.textContent =
    `.chat-submit{background:${primary}!important}` +
    `.chat-submit:hover{background:color-mix(in srgb,${primary} 85%,black)!important}` +
    `.message.user{background:${primary}!important}` +
    `.message.queued{color:${primary}!important;border-color:${primary}!important}` +
    `.message.queued.editing{background:color-mix(in srgb,${primary} 8%,white)!important;border-color:${primary}!important}` +
    `.chat-input:focus{border-color:${primary}!important;box-shadow:0 0 0 3px color-mix(in srgb,${primary} 10%,transparent)!important}`;
  iframe.contentDocument.head.appendChild(s);
});
