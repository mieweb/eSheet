// @vitest-environment jsdom
import React from 'react';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import { EsheetRenderer, type EsheetRendererHandle } from './EsheetRenderer.js';

afterEach(cleanup);

function getRendererHandle(ref: React.RefObject<EsheetRendererHandle | null>) {
  expect(ref.current).not.toBeNull();

  if (!ref.current) {
    throw new Error('Expected renderer ref to be available');
  }

  return ref.current;
}

describe('EsheetRenderer', () => {
  it('mounts and exposes ref handle', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-1',
            title: 'Test',
            fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
          }}
        />
      );
    });

    const renderer = getRendererHandle(ref);

    expect(typeof renderer.getRawResponse).toBe('function');
    expect(typeof renderer.getValidResponse).toBe('function');
    expect(typeof renderer.getFormStore).toBe('function');
    expect(typeof renderer.getUIStore).toBe('function');
  });

  it('getRawResponse() returns initialResponses after mount', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-2',
            title: 'Test',
            fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
          }}
          initialResponses={{ q1: { answer: 'Alice' } }}
        />
      );
    });

    const responses = getRendererHandle(ref).getRawResponse();
    expect(responses['q1']).toMatchObject({ answer: 'Alice' });
  });

  it('getFormStore() has the loaded definition', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-3',
            title: 'Test Form',
            fields: [{ id: 'f1', fieldType: 'text', question: 'Q?' }],
          }}
        />
      );
    });

    const normalized = getRendererHandle(ref)
      .getFormStore()
      .getState().normalized;
    expect(normalized.rootIds).toContain('f1');
  });

  it('getUIStore() is in preview mode after mount', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-4',
            title: 'Test',
            fields: [{ id: 'q1', fieldType: 'text', question: 'Q?' }],
          }}
        />
      );
    });

    const mode = getRendererHandle(ref).getUIStore().getState().mode;
    expect(mode).toBe('preview');
  });

  it('getValidResponse() returns errors and null response when a required field is unanswered', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-5',
            title: 'Test',
            fields: [
              {
                id: 'q1',
                fieldType: 'text',
                question: 'Name?',
                required: true,
              },
            ],
          }}
        />
      );
    });

    const result = getRendererHandle(ref).getValidResponse();

    expect(result.errors).toEqual([
      {
        fieldId: 'q1',
        rule: 'required',
        message: 'This field is required',
        severity: 'hard',
      },
    ]);
    expect(result.response).toBeNull();
  });

  it('getValidResponse() returns the raw response and no errors when valid', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-6',
            title: 'Test',
            fields: [
              {
                id: 'q1',
                fieldType: 'text',
                question: 'Name?',
                required: true,
              },
            ],
          }}
          initialResponses={{ q1: { answer: 'Alice' } }}
        />
      );
    });

    const result = getRendererHandle(ref).getValidResponse();

    expect(result.errors).toEqual([]);
    expect(result.response).toEqual({ q1: { answer: 'Alice' } });
  });

  it('getValidResponse() skips required fields inside disabled sections', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-7',
            title: 'Test',
            fields: [
              {
                id: 'trigger',
                fieldType: 'text',
                question: 'Trigger?',
              },
              {
                id: 'sec',
                fieldType: 'section',
                title: 'Section',
                rules: [
                  {
                    effect: 'enable',
                    logic: 'AND',
                    conditions: [
                      {
                        targetId: 'trigger',
                        operator: 'equals',
                        expected: 'enabled',
                      },
                    ],
                  },
                ],
                fields: [
                  {
                    id: 'q1',
                    fieldType: 'text',
                    question: 'Name?',
                    required: true,
                  },
                ],
              },
            ],
          }}
          initialResponses={{ trigger: { answer: 'disabled' } }}
        />
      );
    });

    const result = getRendererHandle(ref).getValidResponse();

    expect(result.errors).toEqual([]);
    expect(result.response).toEqual({ trigger: { answer: 'disabled' } });
  });
});

describe('EsheetRenderer display markdown', () => {
  async function renderDisplay(content: string) {
    await act(async () => {
      render(
        <EsheetRenderer
          formDataInput={{
            id: 'display-form',
            title: 'Test',
            fields: [{ id: 'note', fieldType: 'display', content }],
          }}
        />
      );
    });
    return document.body as HTMLElement;
  }

  it('does not italicize digit-flanked hyphens (ISO dates)', async () => {
    const body = await renderDisplay('Return date: 2026-01-31');
    expect(body?.textContent).toContain('Return date: 2026-01-31');
    // The date must render as plain text, not split across an <em> element.
    expect(body?.querySelector('em')).toBeNull();
  });

  it('still renders -word- as italic', async () => {
    const body = await renderDisplay('this is -fancy- text');
    const em = body?.querySelector('em');
    expect(em).not.toBeNull();
    expect(em?.textContent).toBe('fancy');
  });
});
