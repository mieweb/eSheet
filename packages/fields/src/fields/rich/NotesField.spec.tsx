import { render, screen, fireEvent } from '@testing-library/react';
import type { FieldComponentProps, NoteEntry } from '@esheet/core';
import { NotesField } from './NotesField.js';

const note = (
  id: string,
  createdAt: string,
  overrides: Partial<NoteEntry> = {}
): NoteEntry => ({
  id,
  createdAt,
  markdown: `Body of ${id}`,
  ...overrides,
});

function createProps(
  definition: Record<string, unknown>,
  overrides: Partial<FieldComponentProps> = {}
): FieldComponentProps {
  return {
    field: { definition: { fieldType: 'notes', id: 'case-notes', ...definition } },
    form: {
      getState: () => ({
        instanceId: 'test',
        identity: { name: 'Dr. Demo' },
      }),
    },
    isPreview: true,
    isEnabled: true,
    isReadOnly: false,
    isRequired: false,
    isSoftRequired: false,
    onResponse: vi.fn(),
    onUpdate: vi.fn(),
    ...overrides,
  } as unknown as FieldComponentProps;
}

describe('NotesField', () => {
  it('renders entries newest first by default with author and markdown body', () => {
    render(
      <NotesField
        {...createProps(
          { question: 'Case notes' },
          {
            response: {
              notes: [
                note('old', '2026-01-01T10:00:00Z', {
                  author: 'Alice',
                  markdown: 'First *bold* note',
                }),
                note('new', '2026-02-01T10:00:00Z', { author: 'Bob' }),
              ],
            },
          }
        )}
      />
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Bob');
    expect(items[1].textContent).toContain('Alice');
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  it('respects sortOrder oldest', () => {
    render(
      <NotesField
        {...createProps(
          { sortOrder: 'oldest' },
          {
            response: {
              notes: [
                note('old', '2026-01-01T10:00:00Z', { author: 'Alice' }),
                note('new', '2026-02-01T10:00:00Z', { author: 'Bob' }),
              ],
            },
          }
        )}
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Alice');
  });

  it('adds a note stamped with GUID, createdAt, and identity author', () => {
    const onResponse = vi.fn();
    render(<NotesField {...createProps({}, { onResponse })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), {
      target: { value: 'A new *note*' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onResponse).toHaveBeenCalledTimes(1);
    const saved = onResponse.mock.calls[0][0].notes as NoteEntry[];
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toMatch(/[0-9a-f-]{36}/);
    expect(saved[0].markdown).toBe('A new *note*');
    expect(saved[0].author).toBe('Dr. Demo');
    expect(saved[0].createdAt).toBeTruthy();
    expect(saved[0].updatedAt).toBeUndefined();
  });

  it('edits a note in place and stamps updatedAt', () => {
    const onResponse = vi.fn();
    const existing = note('n1', '2026-01-01T10:00:00Z');
    render(
      <NotesField
        {...createProps({}, { onResponse, response: { notes: [existing] } })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), {
      target: { value: 'Edited body' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const saved = onResponse.mock.calls[0][0].notes as NoteEntry[];
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('n1');
    expect(saved[0].markdown).toBe('Edited body');
    expect(saved[0].updatedAt).toBeTruthy();
  });

  it('deletes a note only after confirmation', () => {
    const onResponse = vi.fn();
    render(
      <NotesField
        {...createProps(
          {},
          { onResponse, response: { notes: [note('n1', '2026-01-01T10:00:00Z')] } }
        )}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(onResponse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onResponse.mock.calls[0][0].notes).toEqual([]);
  });

  it('hides the add button at maxNotes', () => {
    render(
      <NotesField
        {...createProps(
          { maxNotes: 1 },
          { response: { notes: [note('n1', '2026-01-01T10:00:00Z')] } }
        )}
      />
    );
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
  });

  it('renders read-only (no compose/edit/delete) when not enabled', () => {
    render(
      <NotesField
        {...createProps(
          {},
          {
            isEnabled: false,
            response: { notes: [note('n1', '2026-01-01T10:00:00Z')] },
          }
        )}
      />
    );
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull();
    expect(screen.getByText('Body of n1')).toBeTruthy();
  });

  it('respects a canModify hook', () => {
    render(
      <NotesField
        {...createProps(
          { canModify: (n: NoteEntry) => n.author === 'Dr. Demo' },
          {
            response: {
              notes: [
                note('mine', '2026-01-01T10:00:00Z', { author: 'Dr. Demo' }),
                note('theirs', '2026-01-02T10:00:00Z', { author: 'Other' }),
              ],
            },
          }
        )}
      />
    );
    expect(screen.getAllByRole('button', { name: 'Edit note' })).toHaveLength(1);
  });

  it('uses entryLabel for actions and empty state', () => {
    render(<NotesField {...createProps({ entryLabel: 'Letter' })} />);
    expect(
      screen.getByRole('button', { name: 'Add letter' })
    ).toBeTruthy();
    expect(screen.getByText('No letters yet')).toBeTruthy();
  });

  it('toggles write/preview in the composer', () => {
    render(<NotesField {...createProps({})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note text' }), {
      target: { value: 'Show *this* rendered' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText('this').tagName).toBe('STRONG');
  });

  it('shows the attach control only when allowAttachments', () => {
    const { rerender } = render(<NotesField {...createProps({})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.queryByText('Attach file')).toBeNull();

    rerender(<NotesField {...createProps({ allowAttachments: true })} />);
    expect(screen.getByText('Attach file')).toBeTruthy();
  });

  it('lists attachments on saved notes', () => {
    render(
      <NotesField
        {...createProps(
          { allowAttachments: true },
          {
            response: {
              notes: [
                note('n1', '2026-01-01T10:00:00Z', {
                  attachments: [
                    {
                      contentType: 'application/pdf',
                      dataUrl: 'data:...',
                      title: 'report.pdf',
                      size: 2048,
                    },
                  ],
                }),
              ],
            },
          }
        )}
      />
    );
    expect(screen.getByText('report.pdf')).toBeTruthy();
    expect(screen.getByText('(2 KB)')).toBeTruthy();
  });

  it('builder mode edits definition properties', () => {
    const onUpdate = vi.fn();
    render(
      <NotesField {...createProps({}, { isPreview: false, onUpdate })} />
    );
    fireEvent.change(screen.getByLabelText('Entry label'), {
      target: { value: 'Comment' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ entryLabel: 'Comment' });
  });
});
