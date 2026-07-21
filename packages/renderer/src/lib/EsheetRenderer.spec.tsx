// @vitest-environment jsdom
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
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
  it('uses builder row widths to lay fields out on a six-column grid', async () => {
    const { container } = render(
      <EsheetRenderer
        formDataInput={{
          id: 'row-width-form',
          pages: [
            {
              id: 'page-1',
              fields: [
                { id: 'full', fieldType: 'text', width: 'full' },
                { id: 'half', fieldType: 'text', width: 'half' },
                { id: 'third', fieldType: 'text', width: 'third' },
              ],
            },
          ],
        }}
      />
    );

    const body = container.querySelector<HTMLElement>('.renderer-body');
    expect(body?.style.gridTemplateColumns).toBe('repeat(6, minmax(0, 1fr))');
    expect(
      container.querySelector<HTMLElement>('[data-field-id="full"]')?.style
        .gridColumn
    ).toBe('span 6');
    expect(
      container.querySelector<HTMLElement>('[data-field-id="half"]')?.style
        .gridColumn
    ).toBe('span 3');
    expect(
      container.querySelector<HTMLElement>('[data-field-id="third"]')?.style
        .gridColumn
    ).toBe('span 2');
  });

  it('mounts and exposes ref handle', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={{
            id: 'test-form-1',
            title: 'Test',
            pages: [
              {
                id: 'page-1',
                fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
              },
            ],
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
            pages: [
              {
                id: 'page-1',
                fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
              },
            ],
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
            pages: [
              {
                id: 'page-1',
                fields: [{ id: 'f1', fieldType: 'text', question: 'Q?' }],
              },
            ],
          }}
        />
      );
    });

    const normalized = getRendererHandle(ref)
      .getFormStore()
      .getState().normalized;
    expect(normalized.pages[0].fieldIds).toContain('f1');
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
            pages: [
              {
                id: 'page-1',
                fields: [{ id: 'q1', fieldType: 'text', question: 'Q?' }],
              },
            ],
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
            pages: [
              {
                id: 'page-1',
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
            pages: [
              {
                id: 'page-1',
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
            pages: [
              {
                id: 'page-1',
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
            pages: [
              {
                id: 'page-1',
                fields: [{ id: 'note', fieldType: 'display', content }],
              },
            ],
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

describe('EsheetRenderer collab decorations', () => {
  const FORM = {
    id: 'collab-form',
    title: 'Test',
    pages: [
      {
        id: 'page-1',
        fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
      },
    ],
  };

  async function renderWithCollab(
    collab: React.ComponentProps<typeof EsheetRenderer>['collab']
  ) {
    await act(async () => {
      render(<EsheetRenderer formDataInput={FORM} collab={collab} />);
    });
    return document.body as HTMLElement;
  }

  it('renders presence dots for peers focused on a field', async () => {
    const body = await renderWithCollab({
      presenceByField: {
        q1: [
          { name: 'Ada', color: '#ff0000' },
          { name: 'Grace', color: '#00ff00' },
        ],
      },
    });
    const presence = body.querySelector('.collab-presence');
    expect(presence).not.toBeNull();
    expect(presence?.getAttribute('aria-label')).toBe('Ada, Grace');
    expect(presence?.querySelectorAll('span')).toHaveLength(2);
    expect(presence?.querySelector('span[title="Ada"]')).not.toBeNull();
  });

  it('renders a proposal adornment linked from the input, without buttons when canResolve is false', async () => {
    const body = await renderWithCollab({
      proposalsByField: {
        q1: [
          {
            id: 'p1',
            proposedValue: ['Ada', 'Marie'],
            actor: 'User 7',
            status: 'proposed',
          },
        ],
      },
      formatValue: (value) =>
        Array.isArray(value) ? value.join(' ') : String(value),
    });
    const adornment = body.querySelector('.collab-proposals');
    expect(adornment).not.toBeNull();
    expect(adornment?.textContent).toContain('Ada Marie');
    expect(adornment?.textContent).toContain('by User 7');
    expect(adornment?.querySelector('button')).toBeNull();
    // aria-describedby links the answer input to the adornment.
    const input = body.querySelector('input[id$="-answer-q1"]');
    expect(input?.getAttribute('aria-describedby')).toBe(adornment?.id);
    expect(adornment?.id).toMatch(/-proposal-q1$/);
  });

  it('fires onProposalAction with accept and reject from the adornment buttons', async () => {
    const actions: unknown[] = [];
    const body = await renderWithCollab({
      proposalsByField: {
        q1: [
          {
            id: 'p1',
            proposedValue: 'Ada',
            actor: 'User 7',
            status: 'proposed',
          },
        ],
      },
      canResolve: true,
      onProposalAction: (...args) => actions.push(args),
    });
    const accept = body.querySelector<HTMLButtonElement>(
      'button[aria-label="Accept proposal for Name?"]'
    );
    const reject = body.querySelector<HTMLButtonElement>(
      'button[aria-label="Reject proposal for Name?"]'
    );
    expect(accept?.textContent).toBe('Accept');
    await act(async () => accept?.click());
    await act(async () => reject?.click());
    expect(actions).toEqual([
      ['q1', 'p1', 'accept'],
      ['q1', 'p1', 'reject'],
    ]);
  });

  it('offers Accept anyway and shows the current value on conflicted proposals', async () => {
    const actions: unknown[] = [];
    const body = await renderWithCollab({
      proposalsByField: {
        q1: [
          {
            id: 'p1',
            proposedValue: 'Ada',
            actor: 'User 7',
            status: 'proposed',
            conflict: { currentValue: 'Grace' },
          },
        ],
      },
      canResolve: true,
      onProposalAction: (...args) => actions.push(args),
    });
    expect(
      body.querySelector('.collab-proposal-conflict')?.textContent
    ).toContain('Grace');
    const accept = body.querySelector<HTMLButtonElement>(
      'button[aria-label="Accept anyway proposal for Name?"]'
    );
    expect(accept?.textContent).toBe('Accept anyway');
    await act(async () => accept?.click());
    expect(actions).toEqual([['q1', 'p1', 'accept-anyway']]);
  });
});
