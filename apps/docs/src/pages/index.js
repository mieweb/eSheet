import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

const features = [
  {
    title: 'Visual Builder',
    description:
      'Drag-and-drop form editor with 19 field types, conditional logic builder, and live preview. Switch between build, code, and preview modes.',
  },
  {
    title: 'Form Renderer',
    description:
      'Lightweight form renderer with real-time conditional logic, response collection via ref API, and pre-fill support.',
  },
  {
    title: 'Extensible Architecture',
    description:
      'Register custom field types, extend the component registry, and build on a vanilla TypeScript core with React UI layers.',
  },
];

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', 'heroBanner')}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            href={siteConfig.customFields.demoUrl}
            target="_blank"
          >
            Live Demo
          </Link>
        </div>
      </div>
    </header>
  );
}

function Feature({ title, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md padding-vert--lg">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section style={{ padding: '2rem 0' }}>
      <div className="container">
        <div className="row">
          {features.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
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
      </main>
    </Layout>
  );
}
