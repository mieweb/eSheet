// @vitest-environment jsdom
import React from 'react';
import { render, act, cleanup, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
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
  it('stamps notes authorship from the identity prop', () => {
    const ref = React.createRef<EsheetRendererHandle>();
    const notesForm = {
      id: 'identity-form',
      pages: [
        {
          id: 'page-1',
          fields: [{ id: 'journal', fieldType: 'notes' }],
        },
      ],
    };
    const { getByRole } = render(
      <EsheetRenderer
        formDataInput={notesForm}
        identity={{ name: 'Dr. Demo' }}
        ref={ref}
      />
    );

    fireEvent.click(getByRole('button', { name: 'Add note' }));
    fireEvent.change(getByRole('textbox', { name: 'Note text' }), {
      target: { value: 'Stamped note' },
    });
    fireEvent.click(getByRole('button', { name: 'Save' }));

    const notes = getRendererHandle(ref).getRawResponse()['journal']?.notes;
    expect(notes).toHaveLength(1);
    expect(notes?.[0].author).toBe('Dr. Demo');
  });

  it('saves notes unstamped when no identity is provided', () => {
    const ref = React.createRef<EsheetRendererHandle>();
    const { getByRole } = render(
      <EsheetRenderer
        formDataInput={{
          id: 'no-identity-form',
          pages: [
            { id: 'page-1', fields: [{ id: 'journal', fieldType: 'notes' }] },
          ],
        }}
        ref={ref}
      />
    );

    fireEvent.click(getByRole('button', { name: 'Add note' }));
    fireEvent.change(getByRole('textbox', { name: 'Note text' }), {
      target: { value: 'Anonymous note' },
    });
    fireEvent.click(getByRole('button', { name: 'Save' }));

    const notes = getRendererHandle(ref).getRawResponse()['journal']?.notes;
    expect(notes?.[0].author).toBeUndefined();
    expect(notes?.[0].markdown).toBe('Anonymous note');
  });

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

  it('uses a section row width for all of its children', () => {
    const { container } = render(
      <EsheetRenderer
        formDataInput={{
          id: 'section-width-form',
          pages: [
            {
              id: 'page-1',
              fields: [
                {
                  id: 'section',
                  fieldType: 'section',
                  width: 'half',
                  fields: [{ id: 'child', fieldType: 'text', width: 'third' }],
                },
              ],
            },
          ],
        }}
      />
    );

    expect(
      container.querySelector<HTMLElement>('[data-field-id="child"]')?.style
        .gridColumn
    ).toBe('span 3');
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

  it('loads a YAML string definition', async () => {
    const ref = React.createRef<EsheetRendererHandle>();
    await act(async () => {
      render(
        <EsheetRenderer
          ref={ref}
          formDataInput={`
id: yaml-form
title: YAML Form
pages:
  - id: page-1
    fields:
      - id: q1
        fieldType: text
        question: Name?
        width: full
`}
        />
      );
    });

    const definition = getRendererHandle(ref)
      .getFormStore()
      .getState()
      .hydrateDefinition();

    expect(definition).toMatchObject({
      id: 'yaml-form',
      title: 'YAML Form',
      pages: [{ id: 'page-1', fields: [{ id: 'q1' }] }],
    });
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

  it('renders independently configured top and bottom navigation', async () => {
    const formDataInput = {
      id: 'navigation-visibility',
      pages: [
        { id: 'page-1', title: 'Case', fields: [] },
        { id: 'page-2', title: 'Absence & Restrictions', fields: [] },
      ],
    };

    const { container, rerender } = render(
      <EsheetRenderer
        formDataInput={formDataInput}
        topNavigation
        bottomNavigation={false}
      />
    );

    expect(container.querySelector('.pages-nav-top')).not.toBeNull();
    expect(container.querySelector('.pages-nav-footer')).toBeNull();

    rerender(
      <EsheetRenderer
        formDataInput={formDataInput}
        topNavigation={false}
        bottomNavigation={false}
      />
    );

    expect(container.querySelector('.pages-nav-top')).toBeNull();
    expect(container.querySelector('.pages-nav-footer')).toBeNull();
  });

  // Issue #147 — the active page is host-addressable.
  describe('page routing (initialPageId / onPageChange / handle)', () => {
    const routedForm = {
      id: 'page-routing',
      pages: [
        {
          id: 'case',
          title: 'Case',
          fields: [{ id: 'first-field', fieldType: 'text', question: 'One' }],
        },
        {
          id: 'assessment',
          title: 'Assessment',
          fields: [{ id: 'second-field', fieldType: 'text', question: 'Two' }],
        },
        {
          id: 'documents',
          title: 'Documents',
          fields: [{ id: 'third-field', fieldType: 'text', question: 'Three' }],
        },
      ],
    };

    it('seeds the initial page from initialPageId without firing onPageChange', async () => {
      const onPageChange = vi.fn();
      const { container } = render(
        <EsheetRenderer
          formDataInput={routedForm}
          topNavigation
          initialPageId="documents"
          onPageChange={onPageChange}
        />
      );

      await waitFor(() =>
        expect(
          container.querySelector('[data-field-id="third-field"]')
        ).not.toBeNull()
      );
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('falls back to the first page for an unknown initialPageId', async () => {
      const { container } = render(
        <EsheetRenderer
          formDataInput={routedForm}
          topNavigation
          initialPageId="bogus"
        />
      );

      await waitFor(() =>
        expect(
          container.querySelector('[data-field-id="first-field"]')
        ).not.toBeNull()
      );
    });

    it('reports user tab clicks through onPageChange', async () => {
      const onPageChange = vi.fn();
      const { container } = render(
        <EsheetRenderer
          formDataInput={routedForm}
          topNavigation
          validateNavigation={false}
          onPageChange={onPageChange}
        />
      );
      await waitFor(() =>
        expect(container.querySelector('.pages-nav-top')).not.toBeNull()
      );

      const assessmentTab = Array.from(
        container.querySelectorAll('.pages-nav-top button')
      ).find((button) => button.textContent === 'Assessment');
      await act(async () => {
        fireEvent.click(assessmentTab as HTMLButtonElement);
      });

      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith('assessment', 1);
    });

    it('exposes getCurrentPageId and setCurrentPage on the handle', async () => {
      const onPageChange = vi.fn();
      const ref = React.createRef<EsheetRendererHandle>();
      const { container } = render(
        <EsheetRenderer
          formDataInput={routedForm}
          topNavigation
          onPageChange={onPageChange}
          ref={ref}
        />
      );
      await waitFor(() =>
        expect(getRendererHandle(ref).getCurrentPageId()).toBe('case')
      );

      await act(async () => {
        getRendererHandle(ref).setCurrentPage('documents');
      });
      expect(getRendererHandle(ref).getCurrentPageId()).toBe('documents');
      expect(
        container.querySelector('[data-field-id="third-field"]')
      ).not.toBeNull();

      // Programmatic moves and unknown targets are silent.
      await act(async () => {
        getRendererHandle(ref).setCurrentPage('bogus');
        getRendererHandle(ref).setCurrentPage(99);
      });
      expect(getRendererHandle(ref).getCurrentPageId()).toBe('documents');
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  it('uses page titles and shares navigation validation across both controls', async () => {
    const formDataInput = {
      id: 'navigation-validation',
      pages: [
        {
          id: 'page-1',
          title: 'Case',
          fields: [
            {
              id: 'required-field',
              fieldType: 'text',
              question: 'Required field',
              required: true,
            },
          ],
        },
        {
          id: 'page-2',
          title: 'Absence & Restrictions',
          fields: [
            { id: 'second-field', fieldType: 'text', question: 'Second' },
          ],
        },
        { id: 'page-3', fields: [] },
      ],
    };

    const { container, rerender } = render(
      <EsheetRenderer
        formDataInput={formDataInput}
        topNavigation
        bottomNavigation
        validateNavigation
      />
    );

    const topNavigationButton = container.querySelector(
      '.pages-nav-top button:nth-child(2)'
    );
    expect(topNavigationButton?.textContent).toBe('Absence & Restrictions');

    await act(async () => {
      fireEvent.click(topNavigationButton as HTMLButtonElement);
    });

    expect(
      container.querySelector('[data-field-id="required-field"]')
    ).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      '1 required field'
    );

    const bottomNextButton = Array.from(
      container.querySelectorAll('.pages-nav-footer button')
    ).find((button) => button.textContent?.includes('Next'));

    await act(async () => {
      fireEvent.click(bottomNextButton as HTMLButtonElement);
    });

    expect(
      container.querySelector('[data-field-id="required-field"]')
    ).not.toBeNull();

    rerender(
      <EsheetRenderer
        formDataInput={formDataInput}
        topNavigation
        bottomNavigation
        validateNavigation={false}
      />
    );

    const nextButtonWithoutValidation = Array.from(
      container.querySelectorAll('.pages-nav-footer button')
    ).find((button) => button.textContent?.includes('Next'));

    await act(async () => {
      fireEvent.click(nextButtonWithoutValidation as HTMLButtonElement);
    });

    expect(
      container.querySelector('[data-field-id="second-field"]')
    ).not.toBeNull();

    await act(async () => {
      fireEvent.click(
        container.querySelector(
          '.pages-nav-top button:first-child'
        ) as HTMLButtonElement
      );
    });

    expect(
      container.querySelector('[data-field-id="required-field"]')
    ).not.toBeNull();
  });

  it('keeps submit validation independent from navigation validation', async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <EsheetRenderer
        formDataInput={{
          id: 'submit-validation',
          pages: [
            {
              id: 'page-1',
              fields: [
                {
                  id: 'required-field',
                  fieldType: 'text',
                  question: 'Required field',
                  required: true,
                },
              ],
            },
          ],
        }}
        validateNavigation={false}
        onSubmit={onSubmit}
      />
    );

    await act(async () => {
      fireEvent.click(
        container.querySelector('.renderer-submit button') as HTMLButtonElement
      );
    });

    expect(onSubmit).not.toHaveBeenCalled();
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
