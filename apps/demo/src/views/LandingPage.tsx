import { Link } from 'react-router-dom';
import { Card, CardContent } from '@mieweb/ui';
import { ChevronRight } from 'lucide-react';

function DemoCard({
  title,
  desc,
  to,
}: {
  title: string;
  desc: string;
  to: string;
}) {
  return (
    <Link to={to} className="demo-card-link block no-underline group">
      <Card className="demo-card h-full hover:shadow-xl hover:border-primary-500 transition-all duration-300 hover:-translate-y-1">
        <CardContent className="p-8">
          <h3 className="demo-card-title m-0 mb-3 text-2xl font-bold text-foreground group-hover:text-primary-600 transition-colors">
            {title}
          </h3>
          <p className="demo-card-desc m-0 text-muted-foreground leading-relaxed mb-4">
            {desc}
          </p>
          <div className="demo-card-arrow inline-flex items-center gap-2 text-primary-600 font-medium text-sm group-hover:gap-3 transition-all">
            Explore
            <ChevronRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function LandingPage() {
  return (
    <div className="demo-landing min-h-screen bg-background">
      <div className="demo-landing-wrapper max-w-5xl mx-auto px-6 py-24">
        <div className="demo-landing-hero text-center mb-16">
          <h1 className="m-0 mb-4 text-5xl font-bold text-foreground">
            eSheet Playground
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Explore the form builder and renderer in action. Build
            questionnaires, preview them, and test form submissions.
          </p>
        </div>

        <div className="demo-landing-cards grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <DemoCard
            title="Form Builder"
            desc="Build and modify questionnaire structures with an intuitive visual editor."
            to="/builder"
          />
          <DemoCard
            title="Form Renderer"
            desc="Fill out questionnaires and see collected form responses."
            to="/renderer"
          />
          <DemoCard
            title="Form Renderer PDF"
            desc="Complete imported PDF forms with editable AcroForm fields."
            to="/renderer-pdf"
          />
          <DemoCard
            title="Collaboration"
            desc="Explore simulated presence, proposals, conflicts, and review actions."
            to="/collab-live"
          />
        </div>
      </div>
    </div>
  );
}
