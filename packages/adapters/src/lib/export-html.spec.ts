import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderResponseHtml } from './export-html.js';

function documentBody(html: string): string {
  return html.split('<body>')[1].split('</body>')[0];
}

afterEach(() => vi.unstubAllGlobals());

describe('renderResponseHtml', () => {
  it('renders semantic Markdown in a standalone document without a DOM', async () => {
    expect('document' in globalThis).toBe(false);
    const html = await renderResponseHtml(
      '# Report\n\n## Results\n\nA **strong** and *emphasized* paragraph.\n\n' +
        '> Quoted answer\n\n- First\n- Second\n\n3. Third\n\n' +
        '| Field | Value |\n| --- | --- |\n| Height | 180 |\n\n' +
        '```text\n<script>inert code</script>\n```\n\nInline `code`.',
      { title: 'Report' }
    );
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('<title>Report</title>');
    expect(html).toContain('<main class="response-document"');
    for (const tag of [
      'h1',
      'h2',
      'p',
      'strong',
      'em',
      'blockquote',
      'ul',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'pre',
      'code',
    ]) {
      expect(html).toContain(`<${tag}>`);
    }
    expect(html).toContain('<ol start="3">');
    expect(html).toContain('&lt;script&gt;inert code&lt;/script&gt;');
    expect(html).not.toMatch(/<(?:nav|button|input|form)\b/i);
  });

  it('removes active HTML, assets, events, user styles, and nested SVG', async () => {
    const fetch = vi.fn(() => {
      throw new Error('Exports must not fetch assets');
    });
    vi.stubGlobal('fetch', fetch);
    const html = await renderResponseHtml(`
<script>alert('script')</script>
<style>@import 'https://evil.test/style.css';</style>
<link rel="stylesheet" href="https://evil.test/style.css">
<base href="https://evil.test/">
<meta http-equiv="refresh" content="0;url=https://evil.test/">
<img src="https://evil.test/pixel" onerror="alert(1)">
<svg><a href="javascript:alert(1)">SVG</a><script>alert(1)</script></svg>
<iframe src="https://evil.test/frame"></iframe>
<object data="https://evil.test/object"></object>
<video autoplay src="https://evil.test/video"></video>
<audio autoplay src="https://evil.test/audio"></audio>
<form action="https://evil.test/submit"><input name="secret"><button>Send</button></form>
<p id="hijacked" class="app-chrome" style="background:url(https://evil.test/bg)" onclick="alert(1)">Kept text</p>
<a href="https://safe.test/" ping="https://evil.test/ping" target="_blank" onmouseover="alert(1)">Safe link</a>

![Markdown image](https://evil.test/markdown-image)
`);
    const body = documentBody(html);
    expect(body).not.toMatch(
      /<(?:script|style|link|meta|base|img|svg|iframe|object|video|audio|form|input|button)\b/i
    );
    expect(body).not.toMatch(/\s(?:on\w+|style|src|ping|target|id)=/i);
    expect(body).not.toContain('evil.test');
    expect(body).not.toContain('app-chrome');
    expect(body).toContain('<p>Kept text</p>');
    expect(body).toContain('<a href="https://safe.test/">Safe link</a>');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'jav&#x61;script:alert(1)',
    'java&#x09;script:alert(1)',
    'java&#x0a;script:alert(1)',
    'data:text/html,attack',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://evil.test/file',
    '//evil.test/path',
    '&#47;&#47;evil.test/path',
    '/relative',
    'relative',
    'mdy:field_id',
    ' https://evil.test',
    'https:\\evil.test',
    'https://safe.test/&#10;attack',
  ])('removes the unsafe link destination %s', async (href) => {
    const body = documentBody(
      await renderResponseHtml(`<a href="${href}">Answer</a>`)
    );
    expect(body).toContain('<a>Answer</a>');
    expect(body).not.toContain('href=');
  });

  it('also removes unsafe destinations originating in Markdown', async () => {
    const body = documentBody(
      await renderResponseHtml(
        '[Script](javascript:alert%281%29) [Data](data:text/html,attack) [Remote](//evil.test)'
      )
    );
    expect(body).not.toContain('href=');
    expect(body).toContain('Script');
    expect(body).toContain('Data');
    expect(body).toContain('Remote');
  });

  it('keeps only explicit web, email, and fragment links without inventing field targets', async () => {
    const body = documentBody(
      await renderResponseHtml(
        '[Secure](https://example.test/path) [Web](http://example.test/) ' +
          '[Mail](mailto:person@example.test) [Answer](#field_id) ' +
          '[Unrelated](https://example.test/#not-a-field)'
      )
    );
    for (const href of [
      'https://example.test/path',
      'http://example.test/',
      'mailto:person@example.test',
      '#field_id',
      'https://example.test/#not-a-field',
    ]) {
      expect(body).toContain(`href="${href}"`);
    }
    expect(body).not.toContain(' id=');
  });

  it('escapes the title and validates language and direction at runtime', async () => {
    const html = await renderResponseHtml('Safe', {
      title: '</title><script>"&\'</script>',
      language: 'en" onload="alert(1)',
      direction: 'rtl" onload="alert(1)' as 'rtl',
    });
    expect(html).toContain(
      '<title>&lt;/title&gt;&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;</title>'
    );
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onload=');
  });

  it('supports canonical language tags and RTL with scoped print layout', async () => {
    const html = await renderResponseHtml('# النتيجة\n\nإجابة', {
      language: 'ar-eg',
      direction: 'rtl',
    });
    expect(html).toContain('<html lang="ar-EG" dir="rtl">');
    expect(html).toContain(
      '<main class="response-document" lang="ar-EG" dir="rtl">'
    );
    expect(html).toContain('@media print');
    expect(html).toContain('break-after: avoid');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('overflow-wrap: anywhere');
    expect(html).toContain('white-space: pre-wrap');
    expect(html).toContain('padding-inline-start:');
    expect(html).toContain('text-align: start');
    expect(html).toContain('.response-document[dir="rtl"]');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('url(');
  });

  it('embeds a restrictive CSP before the only trusted inline stylesheet', async () => {
    const html = await renderResponseHtml('<style>body{display:none}</style>');
    expect(html).toContain(
      "content=\"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\""
    );
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(
      html.indexOf('<style>')
    );
    expect(html.match(/<style>/g)).toHaveLength(1);
    expect(html).not.toContain('display:none');
    expect(html).not.toContain('<script');
  });
});
