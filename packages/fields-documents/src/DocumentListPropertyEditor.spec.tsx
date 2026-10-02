import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getFieldPropertyEditor,
  type FieldPropertyEditorProps,
} from '@esheet/fields';
import { DOCUMENT_LIST_COLUMNS } from './data.js';
import { DocumentListPropertyEditor } from './DocumentListPropertyEditor.js';
import { registerDocumentListFieldType } from './index.js';

const baseDefinition = {
  id: 'documents',
  fieldType: 'documentList',
  question: 'Documents',
};

function renderEditor(
  overrides: Record<string, unknown> = {},
  onUpdate = vi.fn()
) {
  render(
    <DocumentListPropertyEditor
      fieldId="documents"
      instanceId="test-builder"
      def={
        {
          ...baseDefinition,
          ...overrides,
        } as unknown as FieldPropertyEditorProps['def']
      }
      onUpdate={onUpdate as FieldPropertyEditorProps['onUpdate']}
    />
  );
  return onUpdate;
}

describe('DocumentListPropertyEditor', () => {
  it('is discoverable after the document list field type is registered', () => {
    registerDocumentListFieldType();

    expect(getFieldPropertyEditor('documentList')).toBe(
      DocumentListPropertyEditor
    );
  });

  it('shows both workflows and every column when configuration is absent', () => {
    renderEditor();

    expect(
      (screen.getByRole('checkbox', { name: 'Compose' }) as HTMLInputElement)
        .checked
    ).toBe(true);
    expect(
      (screen.getByRole('checkbox', { name: 'Upload' }) as HTMLInputElement)
        .checked
    ).toBe(true);
    for (const column of DOCUMENT_LIST_COLUMNS) {
      expect(
        (
          screen.getByRole('checkbox', {
            name: column.header,
          }) as HTMLInputElement
        ).checked
      ).toBe(true);
    }
  });

  it('materializes workflow and column defaults when they are changed', () => {
    const onUpdate = renderEditor();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Upload' }));
    expect(onUpdate).toHaveBeenLastCalledWith({ workflows: ['compose'] });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Title' }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      columns: DOCUMENT_LIST_COLUMNS.map((column) => column.field).filter(
        (field) => field !== 'title'
      ),
    });
  });

  it('allows an explicit empty workflow and column list', () => {
    const onUpdate = renderEditor({ workflows: [], columns: [] });

    expect(
      (screen.getByRole('checkbox', { name: 'Compose' }) as HTMLInputElement)
        .checked
    ).toBe(false);
    expect(
      (screen.getByRole('checkbox', { name: 'Upload' }) as HTMLInputElement)
        .checked
    ).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Date' }));
    expect(onUpdate).toHaveBeenLastCalledWith({ columns: ['date'] });
  });

  it('updates display, PDF, and upload settings', () => {
    const onUpdate = renderEditor();

    fireEvent.change(screen.getByLabelText('Singular name'), {
      target: { value: 'letter' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith({ noun: 'letter' });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Expand row details initially',
      })
    );
    expect(onUpdate).toHaveBeenLastCalledWith({ expandDetails: true });

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Preview and download PDF' })
    );
    expect(onUpdate).toHaveBeenLastCalledWith({ actions: ['downloadPdf'] });

    fireEvent.change(screen.getByLabelText('Accepted file types'), {
      target: { value: 'application/pdf' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith({
      accept: 'application/pdf',
    });

    fireEvent.change(screen.getByLabelText('Maximum file size (bytes)'), {
      target: { value: '1024' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith({ maxFileSize: 1024 });
  });

  it('reorders columns and restores the default declaration', () => {
    const onUpdate = renderEditor({ columns: ['date', 'title'] });

    fireEvent.click(
      screen.getByRole('button', { name: 'Move Title column up' })
    );
    expect(onUpdate).toHaveBeenLastCalledWith({
      columns: ['title', 'date'],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Default' }));
    expect(onUpdate).toHaveBeenLastCalledWith({ columns: undefined });
  });

  it('edits simple document type properties without losing advanced values', () => {
    const onUpdate = renderEditor({
      workflows: ['compose'],
      docTypes: [
        {
          id: 'acknowledgement',
          label: 'Acknowledgement',
          inline: true,
          template: 'templates/acknowledgement.mdyt',
          mergeContext: { employeeName: 'subjectName' },
        },
      ],
    });

    fireEvent.change(screen.getByLabelText('Display label'), {
      target: { value: 'Acknowledgement letter' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith({
      docTypes: [
        expect.objectContaining({
          id: 'acknowledgement',
          label: 'Acknowledgement letter',
          inline: true,
          template: 'templates/acknowledgement.mdyt',
          mergeContext: { employeeName: 'subjectName' },
        }),
      ],
    });

    fireEvent.change(screen.getByLabelText('Storage'), {
      target: { value: 'inherit' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith({
      docTypes: [
        expect.objectContaining({
          id: 'acknowledgement',
          template: 'templates/acknowledgement.mdyt',
        }),
      ],
    });
    expect(
      (onUpdate.mock.lastCall?.[0].docTypes as Record<string, unknown>[])[0]
    ).not.toHaveProperty('inline');
  });

  it('adds a deterministic document type ID', () => {
    const onUpdate = renderEditor({
      workflows: ['compose'],
      docTypes: [{ id: 'type-2', label: 'Existing' }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add document type' }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      docTypes: [
        { id: 'type-2', label: 'Existing' },
        { id: 'type-3', label: 'New type' },
      ],
    });
  });

  it('reorders and removes document types', () => {
    const onUpdate = renderEditor({
      workflows: ['compose'],
      docTypes: [
        { id: 'first', label: 'First' },
        { id: 'second', label: 'Second' },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Move Second up' }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      docTypes: [
        { id: 'second', label: 'Second' },
        { id: 'first', label: 'First' },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove First' }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      docTypes: [{ id: 'second', label: 'Second' }],
    });
  });
});
