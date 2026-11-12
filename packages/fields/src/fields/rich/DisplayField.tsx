import React from 'react';
import {
  evaluateExpression,
  evaluateJsExpression,
  type FieldComponentProps,
  type DisplayFieldDefinition,
} from '@esheet/core';
import { renderMarkdownContent } from '../../lib/markdown.js';

function formatComputedValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value)
      ? String(value)
      : String(Math.round(value * 100) / 100);
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
  responses: ReturnType<FieldComponentProps['form']['getState']>['responses'],
  dangerouslyAllowJS: boolean
): string {
  if (!source) return '';
  // {field-id}        — simple field value lookup
  // <expression>      — safe AST expression ({ref} + arithmetic/functions)
  //                     closing > is paren-depth-aware so >= inside args works
  // [[js expression]] — arbitrary JS (only when dangerouslyAllowJS is true)
  let result = '';
  let i = 0;

  while (i < source.length) {
    // [[js expression]]
    if (source[i] === '[' && source[i + 1] === '[') {
      const end = source.indexOf(']]', i + 2);
      if (end === -1) {
        result += source[i++];
        continue;
      }
      const jsExpr = source.slice(i + 2, end).trim();
      if (jsExpr && dangerouslyAllowJS) {
        result += formatComputedValue(
          evaluateJsExpression(jsExpr, normalized, responses)
        );
      }
      i = end + 2;
      continue;
    }

    // {field-id}
    if (source[i] === '{') {
      const end = source.indexOf('}', i + 1);
      if (end === -1) {
        result += source[i++];
        continue;
      }
      const fieldId = source.slice(i + 1, end).trim();
      if (fieldId) {
        result += formatComputedValue(
          evaluateExpression(`{${fieldId}}`, normalized, responses)
        );
      }
      i = end + 1;
      continue;
    }

    // <expression> — scan for closing > at paren depth 0 so >= doesn't close early
    if (source[i] === '<') {
      let depth = 0;
      let j = i + 1;
      while (j < source.length) {
        const ch = source[j];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === '>' && depth === 0) break;
        j++;
      }
      if (j < source.length && source[j] === '>') {
        const expr = source.slice(i + 1, j).trim();
        if (expr) {
          result += formatComputedValue(
            evaluateExpression(expr, normalized, responses)
          );
        }
        i = j + 1;
        continue;
      }
      // No matching > found — emit literal <
      result += source[i++];
      continue;
    }

    result += source[i++];
  }

  return result;
}

// Markdown-lite rendering (bold/italic/underline/strike, headings, bullets)
// lives in the shared lib/markdown.tsx pipeline; this file only adds
// expression interpolation on top of it.

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
  const next = `${value.slice(0, start)}${open}${selected}${close}${value.slice(
    end
  )}`;
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
  const def = field.definition as DisplayFieldDefinition;
  const instanceId = form.getState().instanceId;
  const { normalized, responses, dangerouslyAllowJS } =
    React.useSyncExternalStore(
      (cb) => form.subscribe(cb),
      () => form.getState(),
      () => form.getState()
    );
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const source = def.content ?? '';
  const rendered = interpolateExpressions(
    source,
    normalized,
    responses,
    dangerouslyAllowJS
  );

  if (isPreview) {
    return (
      <div className="display-field-preview ms:text-mstext">
        {renderMarkdownContent(rendered)}
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
          placeholder={
            'Hello {name}, your BMI is <{weight-kg} / (({height-cm}/100) * ({height-cm}/100))>\n- {field-id} = field value  |  <expr> = computed result'
          }
          className="display-field-textarea ms:px-3 ms:py-2 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors ms:font-mono ms:text-sm ms:resize-y"
        />
      </div>

      <div>
        <div className="ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1">
          Live Preview
        </div>
        <div className="display-field-live-preview ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:p-4 ms:text-mstext">
          {renderMarkdownContent(rendered)}
        </div>
      </div>
    </div>
  );
});
