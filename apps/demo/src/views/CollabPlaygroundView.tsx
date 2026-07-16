import { EsheetRenderer } from '@esheet/renderer';
import { Alert, AlertDescription, Button, Card, CardContent } from '@mieweb/ui';
import {
  ArrowLeftRight,
  CheckCircle2,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
  UserRound,
  Users,
  Wifi,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { COLLAB_FORM } from '../collaboration/collabPlaygroundData';
import { useCollabBus } from '../collaboration/useCollabBus';

export function CollabPlaygroundView() {
  const {
    mainRef,
    consumerRef,
    mainCollab,
    initialCanonical,
    proposalCount,
    mainLocalEditCount,
    localEditCount,
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
  } = useCollabBus();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {/* ── Header ── */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700">
              <ArrowLeftRight size={14} />
              localStorage transport (demo only)
            </div>
            <h1 className="m-0 text-3xl font-bold text-foreground">
              Live Collaboration
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Main saves to push canonical to Consumer. Consumer submits changes
              as proposals for Main to accept or reject.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <Users size={16} className="text-primary-600" />
              {presenceEnabled ? '2 collaborators' : 'Presence hidden'}
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <CheckCircle2 size={16} className="text-primary-600" />
              {proposalCount} pending
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* ── Sidebar: Host controls ── */}
          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-5">
                <div>
                  <h2 className="m-0 text-base font-semibold text-foreground">
                    Host controls
                  </h2>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">
                    These controls change the collab props passed to the Main
                    renderer.
                  </p>
                </div>

                <Button
                  variant={presenceEnabled ? 'primary' : 'outline'}
                  className="w-full justify-start"
                  onClick={togglePresence}
                >
                  <UserRound size={16} />
                  {presenceEnabled ? 'Presence on' : 'Presence off'}
                </Button>

                <Button
                  variant={canResolve ? 'primary' : 'outline'}
                  className="w-full justify-start"
                  onClick={toggleReviewerMode}
                >
                  <ShieldCheck size={16} />
                  {canResolve ? 'Reviewer mode' : 'Viewer mode'}
                </Button>

                <Button
                  variant={conflicted ? 'primary' : 'outline'}
                  className="w-full justify-start"
                  onClick={toggleConflict}
                >
                  <Wifi size={16} />
                  {conflicted ? 'Conflict simulated' : 'Simulate conflict'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={reset}
                >
                  <RefreshCw size={16} />
                  Reset playground
                </Button>
              </CardContent>
            </Card>

            <Alert>
              <AlertDescription>
                <strong className="block text-foreground">Activity</strong>
                <span className="text-sm">{activity}</span>
              </AlertDescription>
            </Alert>
          </aside>

          {/* ── Main: Split panes ── */}
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Main — left, source of truth */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                    <ShieldCheck size={14} />
                    Main
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Source of truth — save to push changes to Consumer
                  </span>
                </div>
                <EsheetRenderer
                  ref={mainRef}
                  formDataInput={COLLAB_FORM}
                  initialResponses={initialCanonical}
                  onReady={onMainReady}
                  collab={mainCollab}
                />
                {mainLocalEditCount > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="self-start"
                    onClick={saveMain}
                  >
                    <Send size={14} />
                    Save {mainLocalEditCount} change
                    {mainLocalEditCount !== 1 ? 's' : ''}
                  </Button>
                )}
              </div>

              {/* Consumer — right, submits proposals */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                    <User size={14} />
                    Consumer
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Suggests changes — edits are local until submitted
                  </span>
                </div>
                <EsheetRenderer
                  ref={consumerRef}
                  formDataInput={COLLAB_FORM}
                  initialResponses={initialCanonical}
                  onReady={onConsumerReady}
                />
                {/* Conflict alerts */}
                {conflictCount > 0 && (
                  <div className="space-y-2">
                    {Object.entries(conflicts).map(
                      ([fieldId, { localValue, newCanonical }]) => (
                        <Alert
                          key={fieldId}
                          className="border-amber-500/50 bg-amber-500/10"
                        >
                          <AlertDescription className="flex flex-col gap-2">
                            <div className="text-sm">
                              <strong className="text-foreground">
                                Conflict on “{fieldId}”
                              </strong>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Your draft:{' '}
                                <code className="rounded bg-muted px-1">
                                  {localValue}
                                </code>{' '}
                                → Main changed to:{' '}
                                <code className="rounded bg-muted px-1">
                                  {newCanonical}
                                </code>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  resolveConflict(fieldId, 'accept')
                                }
                              >
                                Accept Main’s
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => resolveConflict(fieldId, 'keep')}
                              >
                                Keep Mine
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )
                    )}
                  </div>
                )}
                {/* Submit button */}
                {localEditCount > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="self-start"
                    onClick={submitEdits}
                  >
                    <Send size={14} />
                    Submit {localEditCount} change
                    {localEditCount !== 1 ? 's' : ''} for review
                  </Button>
                )}
                {proposalCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {proposalCount} field{proposalCount !== 1 ? 's' : ''}{' '}
                    awaiting Main&apos;s review
                  </p>
                )}
              </div>
            </div>

            {/* How it works */}
            <details className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                How it works
              </summary>
              <div className="space-y-2 px-4 pb-4 pt-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Transport:</strong>{' '}
                  <code className="rounded bg-muted px-1 text-xs">
                    localStorage
                  </code>{' '}
                  stores canonical responses and proposals under{' '}
                  <code className="rounded bg-muted px-1 text-xs">
                    esheet-collab-bus-v1
                  </code>
                  .
                </p>
                <p>
                  <strong className="text-foreground">Same-page:</strong> both
                  renderers share a React state atom. The Patient&apos;s form
                  store diffs each response against the last canonical, turning
                  any change into a proposal on the Physician&apos;s{' '}
                  <code className="rounded bg-muted px-1 text-xs">collab</code>{' '}
                  prop.
                </p>
                <p>
                  <strong className="text-foreground">Cross-tab:</strong>{' '}
                  localStorage writes dispatch a{' '}
                  <code className="rounded bg-muted px-1 text-xs">storage</code>{' '}
                  event to all same-origin tabs. Each tab listens and
                  imperatively syncs the Physician renderer via{' '}
                  <code className="rounded bg-muted px-1 text-xs">
                    setResponse
                  </code>
                  .
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>
    </div>
  );
}
