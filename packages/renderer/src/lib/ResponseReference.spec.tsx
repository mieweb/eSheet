// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serializeResponseReference } from '@esheet/core';
import {
  createResponseReferenceProvider,
  registerResponseReferenceFieldType,
} from '@esheet/fields';
import { EsheetRenderer, type EsheetRendererHandle } from './EsheetRenderer.js';

afterEach(cleanup);

describe('response reference renderer integration', () => {
  it('registers a YAML field, resolves it through fieldProviders, and preserves only its pointer in read-only responses', async () => {
    registerResponseReferenceFieldType();
    const reference = {
      collection: 'reviews',
      id: 'review-7',
      relationship: 'review',
    };
    const answer = serializeResponseReference(reference);
    const resolver = vi.fn(() => ({
      status: 'available' as const,
      label: 'Open review',
      href: '/reviews/7',
    }));
    const ref = React.createRef<EsheetRendererHandle>();
    render(
      <EsheetRenderer
        ref={ref}
        readOnly
        formDataInput={`id: overview\npages:\n  - id: main\n    fields:\n      - id: review\n        fieldType: responseReference\n        question: Linked review\n`}
        initialResponses={{ review: { answer } }}
        fieldProviders={[createResponseReferenceProvider(resolver)]}
      />
    );
    const link = await screen.findByRole('link', { name: 'Open review' });
    expect(link.getAttribute('href')).toBe('/reviews/7');
    expect(resolver).toHaveBeenCalledWith(reference, expect.any(AbortSignal));
    expect(ref.current?.getRawResponse()).toEqual({ review: { answer } });
  });
});
