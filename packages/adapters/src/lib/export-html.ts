import { markdownToHtml } from '@mieweb/templit/markdown';
import sanitizeHtml from 'sanitize-html';

export interface ResponseHtmlOptions {
  readonly title?: string;
  readonly language?: string;
  readonly direction?: 'ltr' | 'rtl';
}

// Trusted, self-contained styles shared by preview, download, and printing.
// Never interpolate response data into this stylesheet.
const RESPONSE_DOCUMENT_CSS = `
.response-document {
  box-sizing: border-box;
  max-inline-size: 70ch;
  margin-inline: auto;
  padding: 1.5rem;
  color: #111;
  background: #fff;
  font: 1rem/1.6 system-ui, sans-serif;
  text-align: start;
  overflow-wrap: anywhere;
}
.response-document :is(h1, h2, h3, h4, h5, h6) {
  line-height: 1.25;
  break-after: avoid;
}
.response-document :is(p, li) { orphans: 3; widows: 3; }
.response-document :is(ul, ol) { padding-inline-start: 1.5rem; }
.response-document blockquote {
  margin-inline: 0;
  padding-inline-start: 1rem;
  border-inline-start: 0.2rem solid #777;
}
.response-document table {
  inline-size: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.response-document :is(th, td) {
  border: 1px solid #777;
  padding: 0.4rem;
  text-align: start;
  vertical-align: top;
}
.response-document thead { display: table-header-group; }
.response-document tr { break-inside: avoid; }
.response-document pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.response-document :is(pre, code) { font-family: monospace; }
.response-document a { color: #164e80; text-decoration: underline; }
.response-document a:focus-visible { outline: 2px solid currentColor; }
.response-document[dir="rtl"] { direction: rtl; }
@media print {
  .response-document {
    max-inline-size: none;
    margin: 0;
    padding: 0;
    font-size: 11pt;
  }
  .response-document a { color: inherit; }
}
`;

/**
 * Render a Markdown BODY, not an MDY file, into a standalone printable document.
 * templit/marked do not sanitize: every rendered byte passes through our explicit
 * allowlist. No images, remote assets, scripts, or user styles are embedded.
 * Links navigate only on activation; arbitrary URLs are never indexed as fields.
 */
export async function renderResponseHtml(
  markdown: string,
  options: ResponseHtmlOptions = {}
): Promise<string> {
  const body = sanitizeResponseHtml(await markdownToHtml(markdown));
  const title = escapeHtml(options.title ?? '');
  const language = escapeHtml(validLanguage(options.language));
  const direction = options.direction === 'rtl' ? 'rtl' : 'ltr';
  return `<!doctype html>
<html lang="${language}" dir="${direction}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${RESPONSE_DOCUMENT_CSS}</style>
</head>
<body>
<main class="response-document" lang="${language}" dir="${direction}">
${body}
</main>
</body>
</html>`;
}

function sanitizeResponseHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'hr',
      'blockquote',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'del',
      's',
      'pre',
      'code',
      'table',
      'caption',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'a',
    ],
    allowedAttributes: { a: ['href', 'title'], ol: ['start'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: [
      'script',
      'style',
      'textarea',
      'option',
      'iframe',
      'object',
      'svg',
      'math',
      'template',
      'noscript',
    ],
    transformTags: {
      a: (tagName, attributes) => {
        const { href, ...rest } = attributes;
        // sanitize-html permits relative URLs by default. Deny them as well
        // as protocol-relative URLs, controls, and browser-normalized slashes.
        const safeHref =
          href &&
          /^(?:https?:\/\/|mailto:|#)/i.test(href) &&
          !/[\u0000-\u0020\u007f\\]/.test(href);
        return { tagName, attribs: safeHref ? attributes : rest };
      },
    },
  });
}

function validLanguage(language: string | undefined): string {
  try {
    return Intl.getCanonicalLocales(language ?? 'en')[0] ?? 'en';
  } catch {
    return 'en';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
