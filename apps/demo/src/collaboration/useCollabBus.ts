import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CollabDecorations,
  FieldProposal,
  FormResponse,
} from '@esheet/core';
import type { EsheetRendererHandle } from '@esheet/renderer';
import { INITIAL_RESPONSES } from './collabPlaygroundData';

// ---------------------------------------------------------------------------
// localStorage-backed collaboration bus
//
// Same-page split view: shared React state drives both Alice and Bob panes.
// Cross-tab: the `storage` event propagates writes to all other same-origin
// tabs so a second browser window receives live updates automatically.
// ---------------------------------------------------------------------------

const LS_KEY = 'esheet-collab-bus-v1';

interface BusState {
  canonical: FormResponse;
  proposals: Record<string, FieldProposal[]>;
}

const DEFAULT_STATE: BusState = {
  canonical: INITIAL_RESPONSES,
  proposals: {},
};

function readState(): BusState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BusState;
      if (parsed.canonical && parsed.proposals) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_STATE;
}

function writeState(state: BusState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function useCollabBus() {
  const [busState, setBusState] = useState<BusState>(readState);

  const mainRef = useRef<EsheetRendererHandle>(null); // Main (source of truth)
  const consumerRef = useRef<EsheetRendererHandle>(null); // Consumer (suggests changes)
  // Prevents Main's subscription from reacting to programmatic setResponse calls
  const suppressMainSyncRef = useRef(false);

  const initialCanonical = useRef<FormResponse>(busState.canonical);
  const canonicalRef = useRef<FormResponse>(busState.canonical);
  useEffect(() => {
    canonicalRef.current = busState.canonical;
  }, [busState.canonical]);

  const [mainReady, setMainReady] = useState(false);
  const [consumerReady, setConsumerReady] = useState(false);
  // Count of Main's unsaved local edits
  const [mainLocalEditCount, setMainLocalEditCount] = useState(0);
  // Consumer's unsaved local edits (fieldId → value). Not sent until submitted.
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  // Fields where Main saved while Consumer had a local unsaved change.
  const [conflicts, setConflicts] = useState<
    Record<string, { localValue: string; newCanonical: string }>
  >({});
  const [presenceEnabled, setPresenceEnabled] = useState(true);
  const [canResolve, setCanResolve] = useState(true);
  const [conflicted, setConflicted] = useState(false);
  const [activity, setActivity] = useState(
    'Ready. Main saves to push canonical; Consumer submits changes as proposals.'
  );

  // ── Cross-tab sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== LS_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as BusState;
        if (!next.canonical || !next.proposals) return;
        setBusState(next);
        // Sync Main's store to incoming canonical
        const mainStore = mainRef.current?.getFormStore().getState();
        if (mainStore) {
          suppressMainSyncRef.current = true;
          for (const [fieldId, response] of Object.entries(next.canonical)) {
            mainStore.setResponse(fieldId, response);
          }
          suppressMainSyncRef.current = false;
        }
        // Sync Consumer's store to incoming canonical (skip fields with local edits)
        setLocalEdits((prevEdits) => {
          for (const [fieldId, response] of Object.entries(next.canonical)) {
            if (!(fieldId in prevEdits)) {
              consumerRef.current
                ?.getFormStore()
                .getState()
                .setResponse(fieldId, response);
            }
          }
          return prevEdits;
        });
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── State update helper ──────────────────────────────────────────────────
  const update = useCallback((updater: (prev: BusState) => BusState) => {
    setBusState((prev) => {
      const next = updater(prev);
      writeState(next);
      return next;
    });
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
      setActivity(
        next
          ? 'A simulated conflict was injected on patient-name.'
          : 'The simulated conflict was cleared.'
      );
      return next;
    });
  }, []);

  const onMainReady = useCallback(() => setMainReady(true), []);
  const onConsumerReady = useCallback(() => setConsumerReady(true), []);

  // ── Main's subscription: track local edit count only (no live sync) ──────
  useEffect(() => {
    if (!mainReady) return;
    const store = mainRef.current?.getFormStore();
    if (!store) return;

    return store.subscribe(() => {
      if (suppressMainSyncRef.current) return;
      const responses = store.getState().responses;
      const canonical = canonicalRef.current;
      let count = 0;
      for (const [fieldId, response] of Object.entries(responses)) {
        if (
          String(response.answer ?? '') !==
          String(canonical[fieldId]?.answer ?? '')
        ) {
          count++;
        }
      }
      setMainLocalEditCount(count);
    });
  }, [mainReady]);

  // ── Consumer's subscription: track local unsaved edits ──────────────────
  // Changes are NOT sent as proposals until Consumer clicks Submit.
  useEffect(() => {
    if (!consumerReady) return;
    const store = consumerRef.current?.getFormStore();
    if (!store) return;

    return store.subscribe(() => {
      const responses = store.getState().responses;
      const canonical = canonicalRef.current;
      const newLocalEdits: Record<string, string> = {};
      for (const [fieldId, response] of Object.entries(responses)) {
        const canonicalAnswer = String(canonical[fieldId]?.answer ?? '');
        const consumerAnswer = String(response.answer ?? '');
        if (consumerAnswer !== canonicalAnswer) {
          newLocalEdits[fieldId] = consumerAnswer;
        }
      }
      setLocalEdits(newLocalEdits);
    });
  }, [consumerReady]);

  // ── Main Save: advance canonical, sync Consumer (with conflict detection) ─
  const saveMain = useCallback(() => {
    const store = mainRef.current?.getFormStore();
    if (!store) return;
    const mainResponses = store.getState().responses;
    const canonical = canonicalRef.current;

    const updatedFields: Record<string, string> = {};
    for (const [fieldId, response] of Object.entries(mainResponses)) {
      const mainAnswer = String(response.answer ?? '');
      const canonicalAnswer = String(canonical[fieldId]?.answer ?? '');
      if (mainAnswer !== canonicalAnswer) updatedFields[fieldId] = mainAnswer;
    }
    if (Object.keys(updatedFields).length === 0) return;

    update((prev) => {
      const newCanonical = { ...prev.canonical };
      for (const [fieldId, value] of Object.entries(updatedFields)) {
        newCanonical[fieldId] = { answer: value };
      }
      return { ...prev, canonical: newCanonical };
    });

    // Update canonicalRef synchronously BEFORE pushing to Consumer's store so
    // Consumer's subscription sees no diff and won't show a spurious Submit button.
    for (const [fieldId, value] of Object.entries(updatedFields)) {
      canonicalRef.current = {
        ...canonicalRef.current,
        [fieldId]: { answer: value },
      };
    }

    setLocalEdits((prevEdits) => {
      const newEdits = { ...prevEdits };
      const newConflicts: Record<
        string,
        { localValue: string; newCanonical: string }
      > = {};
      for (const [fieldId, newValue] of Object.entries(updatedFields)) {
        if (fieldId in prevEdits) {
          newConflicts[fieldId] = {
            localValue: prevEdits[fieldId],
            newCanonical: newValue,
          };
          delete newEdits[fieldId];
        } else {
          consumerRef.current
            ?.getFormStore()
            .getState()
            .setResponse(fieldId, { answer: newValue });
        }
      }
      if (Object.keys(newConflicts).length > 0) {
        setConflicts((prev) => ({ ...prev, ...newConflicts }));
      }
      return newEdits;
    });

    setMainLocalEditCount(0);
    setActivity(
      `Main saved ${
        Object.keys(updatedFields).length
      } field(s) — synced to Consumer.`
    );
  }, [update]);

  // ── Submit: convert Consumer local edits → formal proposals for Main ─────
  const submitEdits = useCallback(() => {
    setLocalEdits((prevEdits) => {
      if (Object.keys(prevEdits).length === 0) return prevEdits;
      const newProposals: Record<string, FieldProposal[]> = {};
      for (const [fieldId, value] of Object.entries(prevEdits)) {
        const canonicalAnswer = String(
          canonicalRef.current[fieldId]?.answer ?? ''
        );
        newProposals[fieldId] = [
          {
            id: `proposal-consumer-${fieldId}-${Date.now()}`,
            proposedValue: value,
            baseValue: canonicalAnswer,
            actor: 'Consumer',
            status: 'proposed',
          },
        ];
      }
      update((prev) => ({
        ...prev,
        proposals: { ...prev.proposals, ...newProposals },
      }));
      setActivity(
        `Consumer submitted ${
          Object.keys(newProposals).length
        } change(s) for review.`
      );
      return {};
    });
  }, [update]);

  // ── Conflict resolution (Consumer side) ─────────────────────────────────
  const resolveConflict = useCallback(
    (fieldId: string, action: 'accept' | 'keep') => {
      setConflicts((prev) => {
        const conflict = prev[fieldId];
        if (!conflict) return prev;

        if (action === 'accept') {
          consumerRef.current
            ?.getFormStore()
            .getState()
            .setResponse(fieldId, { answer: conflict.newCanonical });
          setActivity("Accepted Main's change — local edit discarded.");
        } else {
          const canonicalAnswer = String(
            canonicalRef.current[fieldId]?.answer ?? ''
          );
          update((innerPrev) => ({
            ...innerPrev,
            proposals: {
              ...innerPrev.proposals,
              [fieldId]: [
                {
                  id: `proposal-consumer-${fieldId}-${Date.now()}`,
                  proposedValue: conflict.localValue,
                  baseValue: canonicalAnswer,
                  actor: 'Consumer',
                  status: 'proposed',
                },
              ],
            },
          }));
          consumerRef.current
            ?.getFormStore()
            .getState()
            .setResponse(fieldId, { answer: conflict.localValue });
          setActivity('Kept local change — submitted as proposal to Main.');
        }

        const { [fieldId]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [update]
  );

  // ── Main's proposal actions (accept / reject Consumer proposals) ─────────
  const onProposalAction = useCallback<
    NonNullable<CollabDecorations['onProposalAction']>
  >(
    (fieldId, proposalId, action) => {
      update((prev) => {
        const proposal = prev.proposals[fieldId]?.find(
          (p) => p.id === proposalId
        );
        let nextCanonical = prev.canonical;

        if (action !== 'reject' && proposal) {
          const newValue = String(proposal.proposedValue ?? '');
          nextCanonical = {
            ...prev.canonical,
            [fieldId]: { answer: newValue },
          };
          suppressMainSyncRef.current = true;
          mainRef.current
            ?.getFormStore()
            .getState()
            .setResponse(fieldId, { answer: newValue });
          suppressMainSyncRef.current = false;
        } else if (action === 'reject' && proposal) {
          const canonicalValue = String(prev.canonical[fieldId]?.answer ?? '');
          consumerRef.current
            ?.getFormStore()
            .getState()
            .setResponse(fieldId, { answer: canonicalValue });
        }

        const nextProposals = { ...prev.proposals };
        delete nextProposals[fieldId];
        return { canonical: nextCanonical, proposals: nextProposals };
      });
      setActivity(
        `A proposal was ${action === 'reject' ? 'rejected' : 'accepted'}.`
      );
    },
    [update]
  );

  // ── Main's collab decorations ────────────────────────────────────────────
  const mainCollab = useMemo<CollabDecorations>(() => {
    const baseProposals = { ...busState.proposals };

    if (conflicted) {
      const existing = baseProposals['patient-name']?.[0];
      baseProposals['patient-name'] = [
        {
          id: existing?.id ?? 'proposal-consumer-patient-name',
          proposedValue: existing?.proposedValue ?? 'John Smith',
          baseValue: existing?.baseValue ?? 'Jon Smith',
          actor: existing?.actor ?? 'Consumer',
          status: 'proposed',
          conflict: { currentValue: 'Jonathan Smith' },
        },
      ];
    }

    const presenceByField: Record<string, { name: string; color: string }[]> =
      {};
    if (presenceEnabled) {
      for (const fieldId of Object.keys(baseProposals)) {
        presenceByField[fieldId] = [{ name: 'Consumer', color: '#3b82f6' }];
      }
    }

    return {
      presenceByField: presenceEnabled ? presenceByField : undefined,
      proposalsByField: baseProposals,
      canResolve,
      onProposalAction,
      formatValue: (v) => String(v ?? ''),
    };
  }, [
    busState.proposals,
    presenceEnabled,
    canResolve,
    conflicted,
    onProposalAction,
  ]);

  const proposalCount = Object.values(busState.proposals).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  const localEditCount = Object.keys(localEdits).length;
  const conflictCount = Object.keys(conflicts).length;

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    const fresh: BusState = { ...DEFAULT_STATE };
    writeState(fresh);
    setBusState(fresh);
    setLocalEdits({});
    setConflicts({});
    setMainLocalEditCount(0);
    setConflicted(false);
    setActivity('Playground reset.');

    const seedConsumer = (handle: EsheetRendererHandle | null) => {
      if (!handle) return;
      const state = handle.getFormStore().getState();
      state.resetResponses();
      for (const [fieldId, response] of Object.entries(INITIAL_RESPONSES)) {
        state.setResponse(fieldId, response);
      }
    };
    const seedMain = (handle: EsheetRendererHandle | null) => {
      if (!handle) return;
      suppressMainSyncRef.current = true;
      const state = handle.getFormStore().getState();
      state.resetResponses();
      for (const [fieldId, response] of Object.entries(INITIAL_RESPONSES)) {
        state.setResponse(fieldId, response);
      }
      suppressMainSyncRef.current = false;
    };
    seedConsumer(consumerRef.current);
    seedMain(mainRef.current);
  }, []);

  return {
    mainRef,
    consumerRef,
    mainCollab,
    busState,
    initialCanonical: initialCanonical.current,
    proposalCount,
    mainLocalEditCount,
    localEditCount,
    localEdits,
    conflicts,
    conflictCount,
    activity,
    presenceEnabled,
    canResolve,
    conflicted,
    onMainReady,
    onConsumerReady,
    reset,
    saveMain,
    submitEdits,
    resolveConflict,
    togglePresence,
    toggleReviewerMode,
    toggleConflict,
  };
}
