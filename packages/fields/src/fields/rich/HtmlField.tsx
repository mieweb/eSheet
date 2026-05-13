import React from 'react';
import type { FieldComponentProps, HtmlFieldDefinition } from '@esheet/core';

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Read the resolved --mieweb-* CSS custom properties from a DOM element
 * so they can be forwarded into the sandboxed iframe (which cannot inherit
 * parent-page variables across the frame boundary).
 */
const MIEWEB_VARS = [
  '--mieweb-background',
  '--mieweb-foreground',
  '--mieweb-card',
  '--mieweb-card-foreground',
  '--mieweb-muted',
  '--mieweb-muted-foreground',
  '--mieweb-border',
  '--mieweb-input',
  '--mieweb-ring',
  '--mieweb-primary-50',
  '--mieweb-primary-100',
  '--mieweb-primary-200',
  '--mieweb-primary-300',
  '--mieweb-primary-400',
  '--mieweb-primary-500',
  '--mieweb-primary-600',
  '--mieweb-primary-700',
  '--mieweb-primary-800',
  '--mieweb-primary-900',
  '--mieweb-primary-950',
  '--mieweb-destructive',
  '--mieweb-destructive-foreground',
  '--mieweb-success',
  '--mieweb-success-foreground',
  '--mieweb-warning',
  '--mieweb-warning-foreground',
  '--mieweb-font-sans',
  '--mieweb-font-mono',
  '--mieweb-radius-none',
  '--mieweb-radius-sm',
  '--mieweb-radius-md',
  '--mieweb-radius-lg',
  '--mieweb-radius-xl',
] as const;

// Read --mieweb-* CSS vars at call time from the nearest themed root element.
// Reading at render time (not in state) ensures values are always current,
// including after dark mode toggles.
function getThemeVars(): string {
  const root = document.querySelector(
    '.esheet-renderer-root, .ms-builder-root'
  );
  if (!root) return '';
  const computed = getComputedStyle(root);
  return MIEWEB_VARS.map(
    (v) => `${v}: ${computed.getPropertyValue(v).trim()};`
  ).join('\n    ');
}

function getFontFamily(): string {
  const root = document.querySelector(
    '.esheet-renderer-root, .ms-builder-root'
  );
  return root
    ? getComputedStyle(root).fontFamily || 'sans-serif'
    : 'sans-serif';
}

/**
 * Extract the first font name from a CSS font-family string and return a
 * Google Fonts <link> tag for it, or empty string if it's a system font.
 */
function buildFontLink(fontFamily: string): string {
  const first = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
  // Skip generic/system fonts
  if (
    !first ||
    /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|inherit)$/i.test(
      first
    )
  ) {
    return '';
  }
  const encoded = encodeURIComponent(first);
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap" />`;
}

/**
 * Wrap user-authored HTML in a minimal document shell that:
 *   - Sets UTF-8 charset and viewport meta
 *   - Forwards resolved --mieweb-* brand variables from the parent page
 *   - Applies base typography so content inherits the brand font / colors
 *   - Allows override by styles inside the HTML content itself
 *
 * The outer `<iframe sandbox="">` attribute already blocks script execution,
 * plug-ins, form submission, and navigation.
 */
function buildIframeDoc(html: string): string {
  if (!html) return '';
  const themeVars = getThemeVars();
  const fontFamily = getFontFamily();
  const fontLink = buildFontLink(fontFamily);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${fontLink}
  <style>
    :root {
    ${themeVars}
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 16px;
      font-family: ${fontFamily};
      font-size: 1rem;
      line-height: 1.5;
      color: var(--mieweb-foreground);
      background: transparent;
      overflow-x: hidden;
    }
    a { color: var(--mieweb-primary-500); }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--mieweb-border); padding: 6px 10px; text-align: left; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--mieweb-border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--mieweb-muted-foreground); }
    * { scrollbar-width: thin; scrollbar-color: var(--mieweb-border) transparent; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

export const HtmlField = React.memo(function HtmlField({
  field,
  form,
  isPreview,
  onUpdate,
}: FieldComponentProps) {
  const def = field.definition as HtmlFieldDefinition;
  const instanceId = form.getState().instanceId;

  const frameHeight = clamp(def.iframeHeight ?? 300, 50, 800);
  const [localHeight, setLocalHeight] = React.useState(frameHeight);
  const [autoHeight, setAutoHeight] = React.useState<number | null>(null);

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const doc = e.currentTarget.contentDocument;
    if (doc?.body) {
      setAutoHeight(doc.body.scrollHeight + 32); // +32 for body padding
    }
  };

  // Force re-render when dark mode toggles (data-theme on <html> or class on root)
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const targets: Element[] = [document.documentElement];
    const root = document.querySelector(
      '.esheet-renderer-root, .ms-builder-root'
    );
    if (root) targets.push(root);
    const observer = new MutationObserver(forceUpdate);
    targets.forEach((t) =>
      observer.observe(t, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      })
    );
    return () => observer.disconnect();
  }, []);

  // Keep local slider in sync if the stored value changes externally.
  React.useEffect(() => {
    setLocalHeight(clamp(def.iframeHeight ?? 300, 50, 800));
  }, [def.iframeHeight]);

  const commitHeight = (value: number) => {
    const h = clamp(value, 50, 800);
    setLocalHeight(h);
    onUpdate({ iframeHeight: h });
  };

  const iframeDoc = buildIframeDoc(def.htmlContent ?? '');

  // --- Preview (display) mode ---
  if (isPreview) {
    return (
      <div className="html-field-preview">
        <iframe
          srcDoc={iframeDoc}
          sandbox="allow-same-origin"
          title="HTML content"
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: `${autoHeight ?? frameHeight}px`,
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // --- Edit (canvas) mode ---
  return (
    <div className="html-field-edit ms:space-y-3">
      {/* HTML content textarea */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-html-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          HTML Content
        </label>
        <textarea
          id={`${instanceId}-canvas-html-${def.id}`}
          aria-label="HTML content"
          value={def.htmlContent ?? ''}
          onChange={(e) => onUpdate({ htmlContent: e.target.value })}
          placeholder="<p>Enter your HTML here...</p>"
          rows={8}
          spellCheck={false}
          className="html-field-textarea ms:px-3 ms:py-2 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors ms:font-mono ms:text-sm ms:resize-y"
        />
      </div>

      {/* Preview height control */}
      <div>
        <label
          htmlFor={`${instanceId}-canvas-iframe-height-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Preview Height (px)
        </label>
        <div className="ms:flex ms:items-center ms:gap-2">
          <input
            type="range"
            min={50}
            max={800}
            step={10}
            value={localHeight}
            onChange={(e) => setLocalHeight(Number(e.target.value))}
            onMouseUp={(e) =>
              commitHeight(Number((e.target as HTMLInputElement).value))
            }
            onTouchEnd={(e) =>
              commitHeight(Number((e.target as HTMLInputElement).value))
            }
            aria-label="Preview height slider"
            className="ms:flex-1 ms:accent-msprimary ms:cursor-pointer"
          />
          <input
            id={`${instanceId}-canvas-iframe-height-${def.id}`}
            type="number"
            min={50}
            max={800}
            step={10}
            value={localHeight}
            onChange={(e) => commitHeight(Number(e.target.value))}
            aria-label="Preview height in pixels"
            className="ms:w-20 ms:px-2 ms:py-1 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded ms:text-sm ms:text-center ms:outline-none ms:focus:border-msprimary"
          />
          <span className="ms:text-sm ms:text-mstextmuted ms:shrink-0">px</span>
        </div>
      </div>

      {/* Inline preview */}
      <div>
        <p className="ms:text-xs ms:font-medium ms:text-mstextmuted ms:mb-1">
          Preview
        </p>
        <div className="ms:rounded-lg ms:border ms:border-msborder ms:overflow-hidden">
          <iframe
            srcDoc={iframeDoc}
            sandbox="allow-same-origin"
            title="HTML preview"
            style={{
              width: '100%',
              height: `${localHeight}px`,
              border: 'none',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
});
