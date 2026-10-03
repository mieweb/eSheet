import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { documentPdfBlob } from './DocumentListPdfPreview.js';
import type { DocumentListRuntimeState } from './document-list-runtime.js';
import type { DocumentListDocument } from './types.js';

const rendererState = vi.hoisted(() => ({ document: undefined as unknown }));

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: () => null,
  Page: () => null,
}));

vi.mock('@react-pdf/renderer', () => ({
  Document: 'pdf-document',
  Page: 'pdf-page',
  Text: 'pdf-text',
  View: 'pdf-view',
  Link: 'pdf-link',
  pdf: (document: unknown) => {
    rendererState.document = document;
    return { toBlob: async () => new Blob(['%PDF-rendered']) };
  },
}));

const document: DocumentListDocument = {
  id: 'letter-1',
  date: '2026-10-02',
  title: 'Return to work letter',
  subject: 'Return to work',
  docType: 'return-to-work',
  docId: 'letter-1',
  source: 'Compose',
  file: 'letter-1.md',
};

function runtimeWith(text: string): DocumentListRuntimeState {
  return {
    loadContent: vi.fn(async () => ({
      text,
      contentType: 'text/x-markdown',
    })),
  } as unknown as DocumentListRuntimeState;
}

function renderedText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderedText).join('');
  if (!isValidElement<{ children?: ReactNode }>(node)) return '';
  return renderedText(node.props.children);
}

function countElements(node: ReactNode, type: string): number {
  if (Array.isArray(node)) {
    return node.reduce((count, child) => count + countElements(child, type), 0);
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return 0;
  return (
    (node.type === type ? 1 : 0) + countElements(node.props.children, type)
  );
}

describe('document PDF content', () => {
  it('preserves list starts, hard breaks, and image alternatives', async () => {
    await documentPdfBlob(
      document,
      runtimeWith(
        [
          '5. Fifth',
          '6. Sixth',
          '',
          'First line  ',
          'Second line',
          '',
          '![Threshold chart](chart.png)',
        ].join('\n')
      )
    );

    const text = renderedText(rendererState.document as ReactNode);
    expect(text).toContain('5.Fifth');
    expect(text).toContain('6.Sixth');
    expect(text).toContain('First line\nSecond line');
    expect(text).toContain('[Image: Threshold chart]');
  });

  it('normalizes Kerebron pipe tables before rendering', async () => {
    await documentPdfBlob(
      document,
      runtimeWith('| Frequency | Left |\n| 500 Hz | 10 dB |')
    );

    expect(countElements(rendererState.document as ReactNode, 'pdf-view')).toBe(
      3
    );
    expect(renderedText(rendererState.document as ReactNode)).toContain(
      'FrequencyLeft500 Hz10 dB'
    );
  });

  it('strips front matter from inline Markdown content', async () => {
    const inlineText =
      '---\ndocType: return-to-work\nresponse:\n  status:\n    answer: cleared\n---\n# Cleared for duty';
    await documentPdfBlob(
      { ...document, body: inlineText },
      runtimeWith(inlineText)
    );

    const text = renderedText(rendererState.document as ReactNode);
    expect(text).toContain('Cleared for duty');
    expect(text).not.toContain('return-to-work');
    expect(text).not.toContain('response');
  });
});
