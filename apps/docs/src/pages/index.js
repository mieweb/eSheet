import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

const features = [
  {
    icon: '🔧',
    title: 'Visual Builder',
    description:
      'Drag and drop field authoring with logic controls, schema editing, and live preview in one flow.',
  },
  {
    icon: '⚡',
    title: 'Runtime Renderer',
    description:
      'Render dynamic forms with conditional interactions and response capture for production workflows.',
  },
  {
    icon: '🧩',
    title: 'Extensible Core',
    description:
      'Compose package layers with a TypeScript core and React UI packages for custom field ecosystems.',
  },
];

// ─── Shared primitives ───────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
      {children}
    </p>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="m-0 mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
      {children}
    </h2>
  );
}

function SectionSubtext({ children }) {
  return (
    <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
      {children}
    </p>
  );
}

// ─── Hero code mockup ─────────────────────────────────────────────────────────

function WindowChrome({ label }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-white/8 dark:bg-[#111113]">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
      <span className="ml-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
        {label}
      </span>
    </div>
  );
}

function CodeMockup() {
  return (
    <div className="flex flex-col gap-3 lg:max-w-none">
      {/* Schema window */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-white/10 dark:bg-[#2a2a2d]">
        <WindowChrome label="new-case.esheet.yaml" />
        <pre className="m-0 overflow-x-auto bg-transparent p-4 text-[12.5px] leading-[1.7]">
          <code className="font-mono text-slate-600 dark:text-slate-300">
            {`id: new-case
title: New Case
pages:
  - id: details
    fields:
      # Capture the details needed to route the case.
      - id: name
        fieldType: text
        question: Full Name
        required: true
      - id: status
        fieldType: radio
        question: Status
        options:
          - id: active
            value: Active
          - id: inactive
            value: Inactive`}
          </code>
        </pre>
      </div>

      {/* Connector */}
      <div className="flex items-center gap-3 px-1">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        <code className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
          {'<EsheetRenderer />'}
        </code>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>

      {/* Preview window */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-white/10 dark:bg-[#2a2a2d]">
        <WindowChrome label="Preview" />
        <div className="flex flex-col gap-4 p-4">
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Full Name <span className="text-red-400">*</span>
            </p>
            <div className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#1b1b1d]" />
          </div>
          <div>
            <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Status
            </p>
            <div className="flex gap-5">
              <span className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-blue-600 dark:border-blue-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                </span>
                Active
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                Inactive
              </span>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-white/5">
            <span className="rounded-md bg-blue-600 px-4 py-1.5 text-[11px] font-semibold text-white dark:bg-blue-500">
              Submit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const quickStarts = [
  {
    level: 'Primary path',
    title: '@esheet/builder',
    description: 'Create and manage schemas with the visual editor package.',
    install: 'npm install @esheet/builder',
    href: '/docs/getting-started/quickstart-builder',
  },
  {
    level: 'Primary path',
    title: '@esheet/renderer',
    description: 'Run schema-driven forms and collect responses at runtime.',
    install: 'npm install @esheet/renderer',
    href: '/docs/getting-started/quickstart-renderer',
  },
  {
    level: 'Runtime option',
    title: '@esheet/renderer-standalone',
    description:
      'Use a drop-in runtime when you need a simple integration path.',
    install: 'npm install @esheet/renderer-standalone',
    href: '/docs/getting-started/quickstart-standalone',
  },
  {
    level: 'Runtime option',
    title: '@esheet/renderer-blaze',
    description:
      'Use the Blaze runtime package for Blaze template environments.',
    install: 'npm install @esheet/renderer-blaze',
    href: '/docs/getting-started/quickstart-blaze',
  },
];

const packages = [
  {
    name: '@esheet/core',
    type: 'Foundation',
    summary:
      'Core types, schema models, validation helpers, and logic primitives.',
    url: 'https://www.npmjs.com/package/@esheet/core',
  },
  {
    name: '@esheet/builder',
    type: 'Authoring',
    summary: 'Visual editing package for schema authoring and workflow design.',
    url: 'https://www.npmjs.com/package/@esheet/builder',
  },
  {
    name: '@esheet/renderer',
    type: 'Runtime',
    summary:
      'Runtime package for interaction handling and response collection.',
    url: 'https://www.npmjs.com/package/@esheet/renderer',
  },
  {
    name: '@esheet/fields',
    type: 'Field Layer',
    summary: 'Reusable field implementations and rendering building blocks.',
    url: 'https://www.npmjs.com/package/@esheet/fields',
  },
  {
    name: '@esheet/adapters',
    type: 'Adapters',
    summary:
      'Bidirectional converters between eSheet schemas and SurveyJS, MCP, and other formats.',
    url: 'https://www.npmjs.com/package/@esheet/adapters',
  },
  {
    name: '@esheet/renderer-blaze',
    type: 'Runtime',
    summary: 'Blaze template runtime package for form rendering.',
    url: 'https://www.npmjs.com/package/@esheet/renderer-blaze',
  },
  {
    name: '@esheet/renderer-standalone',
    type: 'Runtime',
    summary: 'Standalone drop-in runtime for simple integration paths.',
    url: 'https://www.npmjs.com/package/@esheet/renderer-standalone',
  },
];

const resources = [
  {
    type: 'Community',
    label: 'GitHub Repository',
    href: 'https://github.com/mieweb/mSheet',
  },
  {
    type: 'Community',
    label: 'Report an Issue',
    href: 'https://github.com/mieweb/mSheet/issues/new',
  },
  {
    type: 'Docs',
    label: 'Docs Introduction',
    href: '/docs/intro',
  },
  {
    type: 'Docs',
    label: 'Builder Quick Start',
    href: '/docs/getting-started/quickstart-builder',
  },
  {
    type: 'Docs',
    label: 'Renderer Quick Start',
    href: '/docs/getting-started/quickstart-renderer',
  },
];

function isExternalLink(href) {
  return href.startsWith('http://') || href.startsWith('https://');
}

function resolveDemoUrl(siteConfig) {
  return siteConfig.customFields?.demoUrl || '/demo/';
}

// ─── Sections ────────────────────────────────────────────────────────────────

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  const demoUrl = resolveDemoUrl(siteConfig);
  return (
    <header className="bg-white pb-20 pt-16 dark:bg-[#1b1b1d]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Left: content */}
          <div>
            <p className="m-0 mb-3 text-xs font-bold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
              Open Source · TypeScript · React
            </p>
            <h1 className="m-0 text-5xl font-black leading-[1.05] tracking-[-0.04em] text-slate-900 dark:text-slate-50 sm:text-6xl">
              {siteConfig.title}
            </h1>
            <p className="mt-5 text-xl leading-relaxed text-slate-600 dark:text-slate-400">
              {siteConfig.tagline}
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-slate-500 dark:text-slate-500">
              Build schema-driven forms with modular packages for visual
              authoring and runtime rendering.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white no-underline shadow-sm transition hover:-translate-y-px hover:bg-blue-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
                to="/docs/intro"
              >
                Get Started{' '}
                <span aria-hidden="true" className="opacity-70">
                  →
                </span>
              </Link>
              <a
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 no-underline shadow-sm transition hover:-translate-y-px hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/8 dark:hover:text-slate-100"
                href={demoUrl}
              >
                Live Demo
              </a>
            </div>

            {/* Package trio */}
            <div className="mt-10 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
              {[
                { value: 'Builder', label: 'visual authoring' },
                { value: 'Renderer', label: 'runtime delivery' },
                { value: 'Core', label: 'shared schema' },
              ].map((entry) => (
                <div
                  key={entry.value}
                  className="bg-slate-50 px-4 py-3 dark:bg-white/5"
                >
                  <p className="m-0 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {entry.value}
                  </p>
                  <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {entry.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: code mockup */}
          <CodeMockup />
        </div>
      </div>
    </header>
  );
}

function HomepageFeatures() {
  return (
    <section className="bg-slate-50 py-16 dark:bg-[#242526]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel>Overview</SectionLabel>
        <SectionHeading>Key Features</SectionHeading>
        <SectionSubtext>
          Everything needed to design, integrate, and run forms in modern
          application workflows.
        </SectionSubtext>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-white/10 dark:bg-[#2a2a2d] dark:hover:border-blue-500/20"
            >
              <span
                className="text-2xl leading-none"
                role="img"
                aria-hidden="true"
              >
                {feature.icon}
              </span>
              <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
                {feature.title}
              </h3>
              <p className="m-0 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TryLiveSection() {
  const { siteConfig } = useDocusaurusContext();
  const demoUrl = resolveDemoUrl(siteConfig);
  return (
    <section className="bg-white py-16 dark:bg-[#1b1b1d]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 dark:border-blue-500/15 dark:from-blue-500/8 dark:to-transparent dark:bg-[#242526]">
          <div className="grid gap-8 p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
            <div>
              <SectionLabel>Experience</SectionLabel>
              <SectionHeading>Try It Live</SectionHeading>
              <SectionSubtext>
                Open the live demo to test schema rendering, conditional
                behavior, and response flow without any setup.
              </SectionSubtext>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white no-underline shadow-sm transition hover:-translate-y-px hover:bg-blue-700 hover:text-white dark:bg-blue-500 dark:hover:bg-blue-400"
                  href={demoUrl}
                >
                  Open Live Demo{' '}
                  <span aria-hidden="true" className="opacity-70">
                    →
                  </span>
                </a>
                <Link
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-700 no-underline shadow-sm transition hover:-translate-y-px hover:border-blue-300 hover:text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15 dark:hover:text-blue-200"
                  to="/docs/intro"
                >
                  Read the Docs
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-56">
              {[
                {
                  step: '01',
                  label: 'Author',
                  desc: 'Build visually or in code',
                },
                {
                  step: '02',
                  label: 'Preview',
                  desc: 'Test conditions live',
                },
                {
                  step: '03',
                  label: 'Collect',
                  desc: 'Capture form responses',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#2a2a2d]"
                >
                  <span className="text-xs font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {item.step}
                  </span>
                  <div>
                    <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.label}
                    </p>
                    <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickStartSection() {
  return (
    <section className="bg-slate-50 py-16 dark:bg-[#242526]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel>Install</SectionLabel>
        <SectionHeading>Quick Start</SectionHeading>
        <SectionSubtext>
          Start with builder and renderer first, then add runtime variants when
          needed.
        </SectionSubtext>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {quickStarts.map((entry, index) => (
            <Link
              key={entry.title}
              to={entry.href}
              className={`group flex flex-col gap-3 rounded-xl border p-5 no-underline transition hover:-translate-y-0.5 hover:shadow-md ${
                index < 2
                  ? 'border-blue-200 bg-white hover:border-blue-400 dark:border-blue-500/20 dark:bg-[#2a2a2d] dark:hover:border-blue-500/40'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-[#2a2a2d] dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                    index < 2
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {entry.level}
                </span>
                <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400">
                  →
                </span>
              </div>

              <h3 className="m-0 font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                {entry.title}
              </h3>

              <pre className="m-0 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[12px] leading-none dark:border-white/8 dark:bg-[#1b1b1d]">
                <code className="font-mono text-slate-600 dark:text-slate-300">
                  {entry.install}
                </code>
              </pre>

              <p className="m-0 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {entry.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PackagesSection() {
  const typeColors = {
    Foundation:
      'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10',
    Authoring:
      'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
    Runtime:
      'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10',
    'Field Layer':
      'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  };

  return (
    <section id="docs-packages" className="bg-white py-16 dark:bg-[#1b1b1d]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel>Modules</SectionLabel>
        <SectionHeading>NPM Packages</SectionHeading>
        <SectionSubtext>
          Each package is independently installable and serves a distinct role
          in the ecosystem.
        </SectionSubtext>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((entry) => (
            <a
              key={entry.name}
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-[#2a2a2d] dark:hover:border-white/20"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    typeColors[entry.type] ??
                    'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-white/10'
                  }`}
                >
                  {entry.type}
                </span>
                <span className="text-[11px] font-semibold text-blue-600 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-blue-400">
                  npm →
                </span>
              </div>

              <h3 className="m-0 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                {entry.name}
              </h3>

              <p className="m-0 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {entry.summary}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResourcesSection() {
  const typeColors = {
    Community:
      'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
    Docs: 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-white/8',
  };

  return (
    <section className="bg-slate-50 py-16 dark:bg-[#242526]">
      <div className="mx-auto max-w-6xl px-6">
        <SectionLabel>Learn More</SectionLabel>
        <SectionHeading>Resources</SectionHeading>
        <SectionSubtext>
          Documentation, community links, and quick references to get you
          moving.
        </SectionSubtext>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <article
              key={resource.label}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#2a2a2d]"
            >
              <span
                className={`w-fit rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  typeColors[resource.type] ??
                  'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-white/10'
                }`}
              >
                {resource.type}
              </span>
              <h3 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                {resource.label}
              </h3>
              {isExternalLink(resource.href) ? (
                <a
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 no-underline transition hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Open{' '}
                  <span aria-hidden="true" className="text-xs opacity-60">
                    ↗
                  </span>
                </a>
              ) : (
                <Link
                  to={resource.href}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 no-underline transition hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Read{' '}
                  <span aria-hidden="true" className="text-xs opacity-60">
                    →
                  </span>
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <TryLiveSection />
        <QuickStartSection />
        <PackagesSection />
        <ResourcesSection />
      </main>
    </Layout>
  );
}
