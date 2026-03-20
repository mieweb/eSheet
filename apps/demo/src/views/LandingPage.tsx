import { Link } from 'react-router-dom';

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
    <Link to={to} className="demo-card-link block no-underline">
      <div className="demo-card group h-full p-8 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all duration-300 hover:-translate-y-1">
        <h3 className="demo-card-title m-0 mb-3 text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        <p className="demo-card-desc m-0 text-slate-600 leading-relaxed mb-4">
          {desc}
        </p>
        <div className="demo-card-arrow inline-flex items-center gap-2 text-blue-600 font-medium text-sm group-hover:gap-3 transition-all">
          Explore
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export function LandingPage() {
  return (
    <div className="demo-landing min-h-screen bg-slate-50">
      <div className="demo-landing-wrapper max-w-5xl mx-auto px-6 py-24">
        <div className="demo-landing-hero text-center mb-16">
          <h1 className="m-0 mb-4 text-5xl font-bold text-slate-900">
            mSheet Playground
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 leading-relaxed">
            Explore the form builder and renderer in action. Build
            questionnaires, preview them, and test form submissions.
          </p>
        </div>

        <div className="demo-landing-cards grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
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
        </div>
      </div>
    </div>
  );
}
