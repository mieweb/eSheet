// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { registerResponseReferenceFieldType } from '@esheet/fields';
import { LinkedResponsesView } from './LinkedResponsesView';

vi.mock('../components/Navbar', () => ({ Navbar: () => null }));

beforeEach(() => {
  localStorage.clear();
  registerResponseReferenceFieldType();
});
afterEach(cleanup);

function readSavedResponse(key: string) {
  const saved = localStorage.getItem(key);
  if (saved === null) throw new Error(`Response was not saved: ${key}`);
  return JSON.parse(saved);
}

it('saves each response independently and restores edits after following links in both directions', async () => {
  render(
    <MemoryRouter initialEntries={['/linked-responses']}>
      <LinkedResponsesView />
    </MemoryRouter>
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Request title' }),
    { target: { value: 'Equipment request' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save response' }));
  const overviewKey = 'esheet-linked-responses-v1:overview-1';
  expect(readSavedResponse(overviewKey)).toMatchObject({
    request_title: { answer: 'Equipment request' },
  });

  fireEvent.click(
    await screen.findByRole('link', { name: 'Open request review' })
  );
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Review notes' }),
    { target: { value: 'Approved for purchase' } }
  );
  fireEvent.click(
    await screen.findByRole('link', { name: 'Open request overview' })
  );
  expect(
    (
      (await screen.findByRole('textbox', {
        name: 'Request title',
      })) as HTMLInputElement
    ).value
  ).toBe('Equipment request');
  const overview = readSavedResponse(overviewKey);
  const review = readSavedResponse('esheet-linked-responses-v1:review-1');
  expect(overview.review_notes).toBeUndefined();
  expect(review.review_notes).toEqual({ answer: 'Approved for purchase' });
  expect(JSON.parse(overview.linked_review.answer)).toEqual({
    collection: 'demo-responses',
    id: 'review-1',
    relationship: 'review',
  });
  expect(JSON.parse(review.linked_overview.answer)).toEqual({
    collection: 'demo-responses',
    id: 'overview-1',
    relationship: 'overview',
  });
});
