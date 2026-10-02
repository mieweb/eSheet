import { describe, expect, it, vi } from 'vitest';
import { documentPdfBlob } from './DocumentListPdfPreview.js';
import type { DocumentListRuntimeState } from './document-list-runtime.js';
import type { DocumentListDocument } from './types.js';

const document: DocumentListDocument = {
  id: 'letter-1',
  date: '2026-10-02',
  title: 'Return / work letter',
  subject: 'Return to work',
  docType: 'return-to-work',
  docId: 'letter-1',
  source: 'Compose',
  file: 'letter-1.md',
};

function runtimeWith(content: {
  text?: string;
  reference?: string;
  contentType?: string;
}): DocumentListRuntimeState {
  return {
    loadContent: vi.fn(async () => content),
  } as unknown as DocumentListRuntimeState;
}

describe('documentPdfBlob', () => {
  it('renders Markdown as a PDF', async () => {
    const blob = await documentPdfBlob(
      document,
      runtimeWith({
        text: '# Return to work\n\nThe employee **may return** Monday.',
        contentType: 'text/x-markdown',
      })
    );

    expect(blob.type).toBe('application/pdf');
    expect(
      new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5))
    ).toBe('%PDF-');
  });

  it('strips MDY front matter before rendering', async () => {
    const blob = await documentPdfBlob(
      document,
      runtimeWith({
        text: '---\ndocType: return-to-work\n---\n# Cleared for duty',
        contentType: 'text/x-mdy',
      })
    );

    expect(blob.size).toBeGreaterThan(100);
  });

  it('passes through an existing PDF', async () => {
    const source = new Blob(['%PDF-existing'], { type: 'application/pdf' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: async () => source,
      }))
    );

    const blob = await documentPdfBlob(
      document,
      runtimeWith({
        reference: 'blob:existing-pdf',
        contentType: 'application/pdf',
      })
    );

    expect(await blob.text()).toBe('%PDF-existing');
    vi.unstubAllGlobals();
  });
});
