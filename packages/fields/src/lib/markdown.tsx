import React from 'react';

// ---------------------------------------------------------------------------
// Shared markdown-lite rendering pipeline.
//
// Used by DisplayField after expression interpolation. Renders inline markdown
// with recursive nesting so formats can combine. Syntax: *bold*, -italic-,
// _underline_, ~strike~, `#`..`######` headings, bullets with `- ` at line
// start.
// ---------------------------------------------------------------------------

function renderInlineNode(text: string, key: string): React.ReactNode {
  // Bold — *text* (single asterisk)
  const bold = text.match(/^(.*?)\*([^*]+)\*(.*)$/s);
  if (bold) {
    return (
      <React.Fragment key={key}>
        {bold[1] && renderInlineNode(bold[1], `${key}a`)}
        <strong>{renderInlineNode(bold[2], `${key}b`)}</strong>
        {bold[3] && renderInlineNode(bold[3], `${key}c`)}
      </React.Fragment>
    );
  }
  // Italic — -text- (no leading/trailing space to avoid conflicting with bullet `- `).
  // Digit-flanked hyphens are skipped so ISO dates (2026-01-31), ranges, and
  // negative numbers from computed expressions are not mangled into <em>.
  const italic = text.match(
    /^(.*?)(?<!\d)-([^\s-][^-]*[^\s-]|[^\s-])-(?!\d)(.*)$/s
  );
  if (italic) {
    return (
      <React.Fragment key={key}>
        {italic[1] && renderInlineNode(italic[1], `${key}a`)}
        <em>{renderInlineNode(italic[2], `${key}b`)}</em>
        {italic[3] && renderInlineNode(italic[3], `${key}c`)}
      </React.Fragment>
    );
  }
  // Underline — _text_ (single underscore)
  const under = text.match(/^(.*?)_([^_]+)_(.*)$/s);
  if (under) {
    return (
      <React.Fragment key={key}>
        {under[1] && renderInlineNode(under[1], `${key}a`)}
        <span className="ms:underline">
          {renderInlineNode(under[2], `${key}b`)}
        </span>
        {under[3] && renderInlineNode(under[3], `${key}c`)}
      </React.Fragment>
    );
  }
  // Strikethrough — ~text~
  const strike = text.match(/^(.*?)~(.+?)~(.*)$/s);
  if (strike) {
    return (
      <React.Fragment key={key}>
        {strike[1] && renderInlineNode(strike[1], `${key}a`)}
        <span className="ms:line-through">
          {renderInlineNode(strike[2], `${key}b`)}
        </span>
        {strike[3] && renderInlineNode(strike[3], `${key}c`)}
      </React.Fragment>
    );
  }
  return <React.Fragment key={key}>{text}</React.Fragment>;
}

/** Render one line of inline markdown (no block structure). */
export function renderMarkdownInline(text: string): React.ReactNode[] {
  if (!text) return [];
  return [renderInlineNode(text, 'r')];
}

/** Render a block of markdown-lite content (headings, bullets, paragraphs). */
export function renderMarkdownContent(content: string): React.ReactNode {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      blocks.push(<div key={`sp-${i}`} className="ms:h-3" />);
      i += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(
          <li key={`li-${i}`} className="ms:ml-4 ms:list-disc">
            {renderMarkdownInline(lines[i].replace(/^-\s+/, ''))}
          </li>
        );
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="ms:my-2">
          {items}
        </ul>
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const headingClass =
        level === 1
          ? 'ms:text-2xl ms:font-semibold'
          : level === 2
          ? 'ms:text-xl ms:font-semibold'
          : level === 3
          ? 'ms:text-lg ms:font-semibold'
          : 'ms:text-base ms:font-semibold';
      blocks.push(
        <div key={`h-${i}`} className={`ms:my-1 ${headingClass}`}>
          {renderMarkdownInline(text)}
        </div>
      );
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="ms:my-1 ms:leading-relaxed">
        {renderMarkdownInline(line)}
      </p>
    );
    i += 1;
  }

  return <>{blocks}</>;
}
