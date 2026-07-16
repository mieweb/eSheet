import { EsheetRenderer } from '@esheet/renderer';
import { Alert, AlertDescription, Button, Card, CardContent } from '@mieweb/ui';
import {
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Wifi,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import {
  COLLAB_FORM,
  INITIAL_RESPONSES,
} from '../collaboration/collabPlaygroundData';
import { useMockCollaborationHost } from '../collaboration/useMockCollaborationHost';

export function CollabPlaygroundView() {
  const {
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
  } = useMockCollaborationHost();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-sm font-medium text-primary-600">
              <Wifi size={14} />
              Simulated collaboration
            </div>
            <h1 className="m-0 text-3xl font-bold text-foreground">
              Collaboration Playground
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              See how a host application can add presence and proposal-review
              controls to the eSheet Renderer. No live server is used here.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <Users size={16} className="text-primary-600" />
              {presenceEnabled ? '3 collaborators' : 'Presence hidden'}
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              <CheckCircle2 size={16} className="text-primary-600" />
              {proposalCount} pending
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-5">
                <div>
                  <h2 className="m-0 text-base font-semibold text-foreground">
                    Host controls
                  </h2>
                  <p className="mb-0 mt-1 text-sm text-muted-foreground">
                    These controls change the data passed through the Renderer’s
                    collab property.
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
                  onClick={resetDemo}
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

          <Card>
            <CardContent className="p-5 sm:p-8">
              <EsheetRenderer
                ref={rendererRef}
                formDataInput={COLLAB_FORM}
                initialResponses={INITIAL_RESPONSES}
                collab={collab}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
