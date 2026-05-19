import { BUILDER_TOOL_DEFINITIONS } from '@esheet/builder';

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

window.OzwellChatConfig = {
  apiKey: apiKey ?? '',
  endpoint: 'https://ozwellapi.opensource.mieweb.org/v1/chat/completions',
  title: 'Schemie',
  welcomeMessage:
    'Hi! Ask me to create, update, or remove fields — or describe a whole form and I will build it.',
  system:
    'Form builder assistant. Field types: text, longtext, multitext, radio, check, boolean, dropdown, multiselectdropdown, rating, ranking, slider, singlematrix, multimatrix, image, html, signature, diagram, display, section. ' +
    'STRICT WORKFLOW: Before editing options/rows/columns on any field, call get_form_summary first to confirm the fieldType. ' +
    'singlematrix and multimatrix fields are created empty (no default rows or columns) — after creating one, use add_row/add_column to populate it. Use update_row/remove_row for rows and update_column/remove_column for columns — NEVER use add_option on matrix fields. ' +
    'add_option is ONLY for: radio, check, boolean, dropdown, multiselectdropdown, rating, ranking, slider, multitext. ' +
    'IMPORTANT: When building a new form or questionnaire from scratch, ALWAYS call reset_form first to clear placeholder fields before adding new ones. ' +
    'When using sections: first create the section field, then pass its ID as parentId on each subsequent create_field call to place fields inside it. ' +
    'For conversational questions reply in plain text without calling a tool.',
  tools: BUILDER_TOOL_DEFINITIONS,
  max_tokens: 4096,
};

// Dynamically inject the CDN widget script so it reads the config set above.
const script = document.createElement('script');
script.src =
  'https://ozwell-dev-refserver.opensource.mieweb.org/embed/ozwell-loader.js';
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

// Inject brand colors into the widget iframe (Send button, user messages, input focus).
// The iframe is same-origin (srcdoc + allow-same-origin) so we can access its document.
document.addEventListener('ozwell-chat-ready', () => {
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
