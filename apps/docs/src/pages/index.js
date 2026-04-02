import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

const features = [
  {
    title: 'Visual Builder',
    description:
      'Drag and drop field authoring with logic controls, schema editing, and live preview in one flow.',
  },
  {
    title: 'Runtime Renderer',
    description:
      'Render dynamic forms with conditional interactions and response capture for production workflows.',
  },
  {
    title: 'Extensible Core',
    description:
      'Compose package layers with a TypeScript core and React UI packages for custom field ecosystems.',
  },
];

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

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  const demoUrl = resolveDemoUrl(siteConfig);
  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-blue-50 to-white text-slate-900 dark:from-sky-50 dark:via-blue-50 dark:to-white dark:text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute bottom-8 right-24 h-40 w-40 rounded-full bg-indigo-300/15 blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-20 lg:pb-20">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-700">
              Documentation
            </p>
            <h1 className="m-0 text-5xl font-black leading-[0.95] tracking-[-0.04em] text-slate-950 dark:text-slate-950 sm:text-6xl lg:text-7xl">
              {siteConfig.title}
            </h1>
            <p className="mt-4 max-w-xl text-xl leading-snug text-slate-700 dark:text-slate-700">
              {siteConfig.tagline}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-600">
              Build schema-driven forms with modular packages for authoring and
              runtime rendering.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center rounded-full bg-blue-700 px-7 py-3 text-base font-bold text-white no-underline shadow-[0_12px_28px_rgba(29,78,216,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                to="/docs/intro"
              >
                Get Started
              </Link>
              <a
                className="inline-flex items-center rounded-full border border-blue-600/60 bg-blue-100/70 px-7 py-3 text-base font-bold text-blue-800 no-underline backdrop-blur transition hover:-translate-y-0.5 hover:bg-blue-200/80 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-600/60 dark:bg-blue-100/70 dark:text-blue-800 dark:hover:bg-blue-200/80"
                href={demoUrl}
              >
                Live Demo
              </a>
            </div>

            <a
              className="mt-5 inline-block font-semibold text-blue-700 no-underline transition hover:text-blue-800 hover:underline dark:text-blue-700 dark:hover:text-blue-800"
              href="#docs-packages"
            >
              Explore Packages
            </a>

            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { value: 'Builder', label: 'authoring surface' },
                { value: 'Renderer', label: 'runtime delivery' },
                { value: 'Core', label: 'shared schema model' },
              ].map((entry) => (
                <div
                  key={entry.value}
                  className="rounded-2xl border border-blue-300/50 bg-white/70 p-4 backdrop-blur dark:border-blue-300/50 dark:bg-white/70"
                >
                  <dt className="text-sm font-bold text-slate-900 dark:text-slate-900">
                    {entry.value}
                  </dt>
                  <dd className="mt-1 text-xs text-slate-600 dark:text-slate-600">
                    {entry.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative min-h-[24rem]">
            <div className="absolute left-0 top-4 w-[78%] rounded-3xl border border-blue-300/60 bg-white/75 p-5 shadow-xl backdrop-blur dark:border-blue-300/60 dark:bg-white/75">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700 dark:text-blue-700">
                System Flow
              </p>
              <div className="mt-3 grid gap-2">
                {['authoring', 'schema', 'runtime'].map((item) => (
                  <span
                    key={item}
                    className="inline-flex w-fit min-w-36 items-center rounded-full bg-blue-100/90 px-4 py-2 text-sm font-semibold text-slate-900 dark:bg-blue-100/90 dark:text-slate-900"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="absolute right-0 top-24 w-[82%] rounded-3xl border border-blue-300/60 bg-white/80 p-5 shadow-xl backdrop-blur dark:border-blue-300/60 dark:bg-white/80">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700 dark:text-blue-700">
                Package Map
              </p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-100/90 p-3 text-sm leading-7 text-slate-700 dark:bg-slate-100/90 dark:text-slate-700">
                <code>
                  {
                    'schema -> builder -> renderer\nlogic -> response -> export\nmodular packages -> practical docs'
                  }
                </code>
              </pre>
            </div>

            <div className="absolute bottom-0 left-6 w-[72%] rounded-3xl border border-blue-300/60 bg-gradient-to-br from-blue-100/80 to-sky-100/70 p-5 shadow-xl backdrop-blur dark:border-blue-300/60 dark:from-blue-100/80 dark:to-sky-100/70 dark:bg-transparent">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700 dark:text-blue-700">
                Focus
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-700">
                Builder and renderer lead the path, while supporting packages
                stay visible as implementation detail.
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Feature({ title, description }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-200 dark:bg-white">
      <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-900">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-600">
        {description}
      </p>
    </article>
  );
}

function QuickStartSection() {
  return (
    <section className="bg-white py-14 dark:bg-white">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-700">
          Install
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-900">
          Quick Start
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-600">
          Start with builder and renderer first, then add runtime variants when
          needed.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {quickStarts.map((entry, index) => (
            <Link
              key={entry.title}
              to={entry.href}
              className={`group relative block rounded-2xl border p-5 no-underline transition hover:-translate-y-0.5 hover:shadow-lg ${
                index < 2
                  ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-white dark:border-blue-300 dark:from-blue-50 dark:to-white'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-200 dark:bg-slate-50'
              }`}
            >
              <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
                {entry.level}
              </p>
              <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-900">
                {entry.title}
              </h3>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-200 dark:bg-white dark:text-slate-700">
                <code>{entry.install}</code>
              </pre>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-600">
                {entry.description}
              </p>
              <span className="absolute right-4 top-4 text-blue-700 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-blue-700">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomepageFeatures() {
  return (
    <section className="bg-slate-50 py-14 dark:bg-slate-50">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-700">
          Overview
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-900">
          Key Features
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-600">
          Everything needed to design, integrate, and run forms in modern app
          flows.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {features.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PackagesSection() {
  return (
    <section id="docs-packages" className="bg-white py-14 dark:bg-white">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-700">
          Modules
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-900">
          NPM Packages
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((entry) => (
            <a
              key={entry.name}
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-slate-200 bg-white p-5 no-underline transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-200 dark:bg-white"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500 group-hover:text-blue-700">
                {entry.type}
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-900 group-hover:text-blue-700 dark:text-slate-900">
                {entry.name}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-600">
                {entry.summary}
              </p>
              <span className="mt-3 inline-flex items-center font-semibold text-blue-700 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-blue-700">
                View on npm →
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResourcesSection() {
  return (
    <section className="bg-slate-50 py-14 dark:bg-slate-50">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-700">
          Learn More
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-900">
          Resources
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {resources.map((resource) => (
            <article
              key={resource.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-200 dark:bg-white"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
                {resource.type}
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-900">
                {resource.label}
              </h3>
              {isExternalLink(resource.href) ? (
                <a
                  href={resource.href}
                  className="mt-3 inline-block font-semibold text-blue-700 no-underline hover:underline dark:text-blue-700"
                >
                  Open Resource
                </a>
              ) : (
                <Link
                  to={resource.href}
                  className="mt-3 inline-block font-semibold text-blue-700 no-underline hover:underline dark:text-blue-700"
                >
                  Open Resource
                </Link>
              )}
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
    <section className="bg-slate-50 py-14 dark:bg-slate-50">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-6 rounded-3xl border border-blue-300/60 bg-gradient-to-br from-white to-blue-50 p-7 shadow-lg dark:border-blue-300/60 dark:from-white dark:to-blue-50 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-700">
              Experience
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-900">
              Try It Live
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-600">
              Open the live demo to test schema rendering, conditional behavior,
              and response flow.
            </p>
            <a
              className="mt-6 inline-flex items-center rounded-full bg-blue-700 px-7 py-3 text-base font-bold text-white no-underline shadow-[0_12px_28px_rgba(29,78,216,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              href={demoUrl}
            >
              Try Live Demo
            </a>
          </div>

          <div className="grid gap-4">
            <div className="min-h-[9rem] rounded-2xl border border-blue-300/60 bg-white/70 p-5 backdrop-blur dark:border-blue-300/60 dark:bg-white/70">
              <strong className="text-base text-slate-900 dark:text-slate-900">
                Build
              </strong>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-600">
                Author visually, refine in code.
              </p>
            </div>
            <div className="min-h-[9rem] rounded-2xl border border-blue-300/60 bg-white/70 p-5 backdrop-blur dark:border-blue-300/60 dark:bg-white/70">
              <strong className="text-base text-slate-900 dark:text-slate-900">
                Render
              </strong>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-600">
                Run conditional flows with response capture.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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
