import React from 'react';
import { evaluateExpression, type FieldComponentProps } from '@msheet/core';

function formatComputedValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function interpolateExpressions(
  source: string,
  normalized: ReturnType<FieldComponentProps['form']['getState']>['normalized'],
  responses: ReturnType<FieldComponentProps['form']['getState']>['responses']
): string {
  if (!source) return '';
  // {field-id}   — simple field value lookup (consistent with schema convention)
  // <expression> — full expression, supports {ref} + arithmetic (e.g. <{a} * {b} + " pts">)
  return source.replace(/\{([^{}]+)\}|<([^>]+)>/g, (_match, fieldId: string | undefined, expr: string | undefined) => {
    if (fieldId !== undefined) {
      const id = fieldId.trim();
      if (!id) return '';
      return formatComputedValue(evaluateExpression(`{${id}}`, normalized, responses));
    }
    const e = expr?.trim();
    if (!e) return '';
    return formatComputedValue(evaluateExpression(e, normalized, responses));
  });
}

// Renders inline markdown with recursive nesting so formats can combine.
// Syntax: *bold*, -italic-, _underline_, ~strike~, bullets with `- ` at line start.
// Interpolation: {field-id} = field value, <expression> = computed result (e.g. <{a} + {b}>).
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
  // Italic — -text- (no leading/trailing space to avoid conflicting with bullet `- `)
  const italic = text.match(/^(.*?)-([^\s-][^-]*[^\s-]|[^\s-])-(.*)$/s);
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
        <span className="ms:underline">{renderInlineNode(under[2], `${key}b`)}</span>
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
        <span className="ms:line-through">{renderInlineNode(strike[2], `${key}b`)}</span>
        {strike[3] && renderInlineNode(strike[3], `${key}c`)}
      </React.Fragment>
    );
  }
  return <React.Fragment key={key}>{text}</React.Fragment>;
}

function renderInline(text: string): React.ReactNode[] {
  if (!text) return [];
  return [renderInlineNode(text, 'r')];
}

function renderContent(content: string): React.ReactNode {
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
            {renderInline(lines[i].replace(/^-\s+/, ''))}
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
          {renderInline(text)}
        </div>
      );
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="ms:my-1 ms:leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i += 1;
  }

  return <>{blocks}</>;
}

function wrapSelection(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  onChange: (next: string) => void,
  open: string,
  close: string
): void {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;
  const selected = value.slice(start, end) || 'text';
  const next = `${value.slice(0, start)}${open}${selected}${close}${value.slice(end)}`;
  onChange(next);
}

function prefixSelectionLines(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  onChange: (next: string) => void,
  prefix: string
): void {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end);
  const safeEnd = lineEnd === -1 ? value.length : lineEnd;
  const segment = value.slice(lineStart, safeEnd);
  const nextSegment = segment
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');

  onChange(`${value.slice(0, lineStart)}${nextSegment}${value.slice(safeEnd)}`);
}

export const DisplayField = React.memo(function DisplayField({
  field,
  form,
  isPreview,
  onUpdate,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;
  const { normalized, responses } = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState(),
    () => form.getState()
  );
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const source = def.content ?? '';
  const rendered = interpolateExpressions(source, normalized, responses);

  if (isPreview) {
    return (
      <div className="display-field-preview ms:text-mstext">
        {renderContent(rendered)}
      </div>
    );
  }

  const setContent = (next: string) => onUpdate({ content: next });

  return (
    <div className="display-field-edit ms:space-y-3">
      <div className="display-field-toolbar ms:flex ms:flex-wrap ms:gap-2">
        <button
          type="button"
          className="ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm"
          onClick={() => wrapSelection(textareaRef, setContent, '*', '*')}
        >
          Bold
        </button>
        <button
          type="button"
          className="ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm"
          onClick={() => wrapSelection(textareaRef, setContent, '-', '-')}
        >
          Italic
        </button>
        <button
          type="button"
          className="ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm"
          onClick={() => wrapSelection(textareaRef, setContent, '_', '_')}
        >
          Underline
        </button>
        <button
          type="button"
          className="ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm"
          onClick={() => wrapSelection(textareaRef, setContent, '~', '~')}
        >
          Strike
        </button>
        <button
          type="button"
          className="ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm"
          onClick={() => prefixSelectionLines(textareaRef, setContent, '- ')}
        >
          Bullet
        </button>
        <button
          type="button"
          className="ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm"
          onClick={() => prefixSelectionLines(textareaRef, setContent, '# ')}
        >
          Heading
        </button>
        <button
          type="button"
          className="ms:px-2 ms:py-1 ms:rounded ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm"
          onClick={() => wrapSelection(textareaRef, setContent, '<', '>')}
        >
          Expr
        </button>
      </div>

      <div>
        <label
          htmlFor={`${instanceId}-canvas-display-content-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Display Content
        </label>
        <textarea
          id={`${instanceId}-canvas-display-content-${def.id}`}
          ref={textareaRef}
          aria-label="Display content"
          value={source}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={'Hello {name}, your BMI is <{weight-kg} / (({height-cm}/100) * ({height-cm}/100))>\n- {field-id} = field value  |  <expr> = computed result'}
          className="display-field-textarea ms:px-3 ms:py-2 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors ms:font-mono ms:text-sm ms:resize-y"
        />
      </div>

      <div>
        <div className="ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1">Live Preview</div>
        <div className="display-field-live-preview ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-4 ms:text-mstext">
          {renderContent(rendered)}
        </div>
      </div>
    </div>
  );
});
