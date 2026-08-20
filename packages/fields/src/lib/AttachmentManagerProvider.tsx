import React from 'react';
import type { AttachmentAnswer, AttachmentManager } from '@esheet/core';
import type { FieldProvider } from './FieldProviders.js';

// ---------------------------------------------------------------------------
// AttachmentManagerProvider — delivers the host's byte storage to the fields.
// ---------------------------------------------------------------------------

const AttachmentManagerContext = React.createContext<
  AttachmentManager | undefined
>(undefined);

export interface AttachmentManagerProviderProps {
  readonly manager: AttachmentManager;
  readonly children: React.ReactNode;
}

export function AttachmentManagerProvider({
  manager,
  children,
}: AttachmentManagerProviderProps): React.JSX.Element {
  return (
    <AttachmentManagerContext.Provider value={manager}>
      {children}
    </AttachmentManagerContext.Provider>
  );
}

/** Wraps a manager as a `fieldProviders` entry for the renderer. */
export function createAttachmentManagerProvider(
  manager: AttachmentManager
): FieldProvider {
  return (children) => (
    <AttachmentManagerProvider manager={manager}>
      {children}
    </AttachmentManagerProvider>
  );
}

/** The host's attachment storage, or `undefined` when it keeps bytes inline. */
export function useAttachmentManager(): AttachmentManager | undefined {
  return React.useContext(AttachmentManagerContext);
}

/**
 * `store` through the manager when there is one, unchanged when there is not —
 * the shape every field's upload path wants.
 */
export async function storeAttachments(
  manager: AttachmentManager | undefined,
  attachments: readonly AttachmentAnswer[]
): Promise<AttachmentAnswer[]> {
  if (!manager) return [...attachments];
  return Promise.all(
    attachments.map((attachment) => manager.store(attachment))
  );
}

/** Identity of a stored attachment: everything the host wrote, minus the bytes. */
function referenceKey({
  dataUrl: _dataUrl,
  ...rest
}: AttachmentAnswer): string {
  return JSON.stringify(rest);
}

/**
 * Hands back what the next response drops. Two uploads of the same bytes
 * usually store to the same reference, so what is compared is the reference,
 * not the array slot — removing one copy must not delete the other's bytes.
 *
 * Best effort: a field must not fail its own edit because storage did.
 */
export function removeUnreferenced(
  manager: AttachmentManager | undefined,
  before: readonly AttachmentAnswer[],
  after: readonly AttachmentAnswer[]
): void {
  if (!manager) return;
  const kept = new Set(after.map(referenceKey));
  for (const attachment of before) {
    if (kept.has(referenceKey(attachment))) continue;
    void manager.remove(attachment).catch(() => undefined);
  }
}
