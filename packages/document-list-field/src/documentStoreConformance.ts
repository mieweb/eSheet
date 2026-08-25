/**
 * ED.50 — one conformance scenario for every DocumentStore backend:
 * save → revise → blank → append → remove → restore → listRevisions,
 * asserting the *model's* semantics. Where backends legitimately differ the
 * caller documents the policy and the scenario asserts that policy, not a
 * shared answer. The server-side WebChart adapter runs the same steps in
 * eCase's suite (apps/server/src/webchartDocumentStore.test.ts mirrors this
 * file — keep the steps in lockstep).
 */
import type { DocumentStore } from './documentStore.js';
import type { DocumentListAuthor } from './types.js';

export interface DocumentStorePolicies {
  /** Does removed content stay readable? (blob/inline: yes; WebChart: no.) */
  readonly retainsContentAfterRemove: boolean;
  /** Can prior revisions' content be read back through `read(id, rev)`? */
  readonly priorContentAddressable: boolean;
}

const casey: DocumentListAuthor = { id: 'u-casey', name: 'Casey Manager' };
const riley: DocumentListAuthor = { id: 'u-riley', name: 'Riley Reviewer' };

/** Throws on the first divergence from the model; resolves when conformant. */
export async function runDocumentStoreConformance(
  store: DocumentStore,
  policies: DocumentStorePolicies
): Promise<void> {
  const equal = (actual: unknown, expected: unknown, what: string): void => {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
  };

  // create — rev 0, attributed
  const created = await store.save(null, {
    action: 'create',
    bytes: 'first prose',
    columns: { title: 'Conformance note', docType: 'progress-note' },
    author: casey,
  });
  equal(created.rev ?? 0, 0, 'a created document counts saves from 0');
  equal(created.author, casey, 'the creator is the author');
  equal(created.title, 'Conformance note', 'declared columns land on the row');

  // revise — rev 1, saver owns it
  const revised = await store.save(created.id, {
    action: 'edit',
    bytes: 'second prose',
    author: riley,
  });
  equal(revised.rev, 1, 'a save is a revision: rev + 1');
  equal(revised.author, riley, 'the saver owns the revision');
  equal(
    (await store.read(created.id)).text,
    'second prose',
    'read() returns the head'
  );
  if (policies.priorContentAddressable) {
    equal(
      (await store.read(created.id, 0)).text,
      'first prose',
      'prior content stays addressable'
    );
  }

  // blank — a revision, never a lost document
  const blanked = await store.save(created.id, {
    action: 'blank',
    bytes: '',
    author: riley,
  });
  equal(blanked.rev, 2, 'blank is a revision');
  equal(
    (await store.read(created.id)).text ?? '',
    '',
    'blank content is empty'
  );

  // append — the next revision of the same document
  const appended = await store.save(created.id, {
    action: 'append',
    bytes: 'appended prose',
    author: casey,
  });
  equal(appended.rev, 3, 'append-as-revision is the next revision');

  // linked addendum — a second document pointing back
  const addendum = await store.save(null, {
    action: 'create',
    bytes: 'further information',
    columns: { title: 'Addendum', docType: 'progress-note' },
    author: casey,
  });
  await store.link(addendum.id, created.id, 'addendum');
  const linked = (await store.list()).find((row) => row.id === addendum.id);
  equal(
    linked?.linkedTo,
    { id: created.id, linkType: 'addendum' },
    'the addendum names its target'
  );

  // remove — reasoned, attributed, and a save of its own kind
  let refusedEmptyReason = false;
  try {
    await store.remove(created.id, '   ', casey);
  } catch {
    refusedEmptyReason = true;
  }
  equal(refusedEmptyReason, true, 'removal requires a reason');
  const removed = await store.remove(created.id, 'wrong patient', casey);
  equal(removed.rev, 4, 'remove is a revision');
  equal(
    removed.removed?.reason,
    'wrong patient',
    'the tombstone carries the reason'
  );
  if (policies.retainsContentAfterRemove) {
    equal(
      (await store.read(created.id)).text,
      'appended prose',
      'removed content is retained (documented policy)'
    );
  }

  // restore — the same grant, the next revision
  const restored = await store.restore(created.id, casey);
  equal(restored.rev, 5, 'restore is a revision');
  equal(restored.removed ?? null, null, 'restore clears the tombstone');

  // history — the whole story, newest first
  const revisions = await store.listRevisions(created.id);
  equal(
    revisions.map((revision) => `${revision.rev}:${revision.action}`),
    ['5:restore', '4:remove', '3:append', '2:blank', '1:edit', '0:create'],
    'listRevisions tells the whole story, newest first'
  );
}
