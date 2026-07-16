import { useCallback, useMemo, useRef, useState } from 'react';
import type { CollabDecorations } from '@esheet/core';
import type { EsheetRendererHandle } from '@esheet/renderer';
import {
  createMockProposals,
  INITIAL_RESPONSES,
  MOCK_PRESENCE,
} from './collabPlaygroundData';

/**
 * Simulates the responsibilities of an application hosting EsheetRenderer.
 * A production host would replace this local state with data and mutations
 * from WebSockets, Yjs, or its own collaboration API.
 */
export function useMockCollaborationHost() {
  const rendererRef = useRef<EsheetRendererHandle>(null);
  const [presenceEnabled, setPresenceEnabled] = useState(true);
  const [canResolve, setCanResolve] = useState(true);
  const [conflicted, setConflicted] = useState(false);
  const [proposals, setProposals] = useState(() => createMockProposals(false));
  const [activity, setActivity] = useState(
    'Two teammates joined the shared review.'
  );

  const resetDemo = useCallback(() => {
    rendererRef.current?.getFormStore().getState().resetResponses();
    for (const [fieldId, response] of Object.entries(INITIAL_RESPONSES)) {
      rendererRef.current
        ?.getFormStore()
        .getState()
        .setResponse(fieldId, response);
    }
    setConflicted(false);
    setProposals(createMockProposals(false));
    setActivity('Playground reset. Two proposals are ready for review.');
  }, []);

  const togglePresence = useCallback(() => {
    setPresenceEnabled((current) => {
      setActivity(
        current
          ? 'Presence decorations were hidden.'
          : 'Presence decorations were restored.'
      );
      return !current;
    });
  }, []);

  const toggleReviewerMode = useCallback(() => {
    setCanResolve((current) => {
      setActivity(
        current
          ? 'Viewer mode enabled. Proposal actions are hidden.'
          : 'Reviewer mode enabled. Proposals can be resolved.'
      );
      return !current;
    });
  }, []);

  const toggleConflict = useCallback(() => {
    setConflicted((current) => {
      const next = !current;
      setProposals(createMockProposals(next));
      setActivity(
        next
          ? 'A remote edit created a conflict on Patient name.'
          : 'The conflict was cleared.'
      );
      return next;
    });
  }, []);

  /**
   * Processes the decision emitted by EsheetRenderer. A production host would
   * normally send this command to its collaboration service and then consume
   * the updated canonical response and proposal snapshots.
   */
  const resolveProposal = useCallback<
    NonNullable<CollabDecorations['onProposalAction']>
  >(
    (fieldId, proposalId, action) => {
      const proposal = proposals[fieldId]?.find(
        (item) => item.id === proposalId
      );

      if (action !== 'reject' && proposal) {
        rendererRef.current
          ?.getFormStore()
          .getState()
          .setResponse(fieldId, {
            answer: String(proposal.proposedValue ?? ''),
          });
      }

      setProposals((current) => ({
        ...current,
        [fieldId]: (current[fieldId] ?? []).filter(
          (item) => item.id !== proposalId
        ),
      }));
      setActivity(
        `${proposal?.actor ?? 'A teammate'}'s proposal was ${
          action === 'reject' ? 'rejected' : 'accepted'
        }.`
      );
    },
    [proposals]
  );

  /** The exact integration object consumed by EsheetRenderer. */
  const collab = useMemo<CollabDecorations>(
    () => ({
      presenceByField: presenceEnabled ? MOCK_PRESENCE : undefined,
      proposalsByField: proposals,
      canResolve,
      formatValue: (value) => String(value ?? ''),
      onProposalAction: resolveProposal,
    }),
    [canResolve, presenceEnabled, proposals, resolveProposal]
  );

  const proposalCount = Object.values(proposals).reduce(
    (total, items) => total + items.length,
    0
  );

  return {
    rendererRef,
    collab,
    presenceEnabled,
    canResolve,
    conflicted,
    proposalCount,
    activity,
    togglePresence,
    toggleReviewerMode,
    toggleConflict,
    resetDemo,
  };
}
