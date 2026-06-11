// @ts-check
import dotenv from 'dotenv';
import { resolve } from 'path';
import { themes as prismThemes } from 'prism-react-renderer';

// Load .env.local from workspace root — try __dirname-relative first,
// then fall back to CWD-relative (handles nx run-many from repo root).
dotenv.config({ path: resolve(__dirname, '../../.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const isDev = process.env.NODE_ENV !== 'production';
const siteOrigin =
  process.env.ESHEET_SITE_ORIGIN || 'https://esheet.os.mieweb.org';
const baseUrl = '/';
const demoUrl = isDev ? 'http://localhost:3001/' : `${siteOrigin}/demo/`;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'eSheet Documentation',
  tagline: 'Modular form builder & renderer for React',
  favicon: 'img/favicon.ico',

  future: {
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
      useCssCascadeLayers: true,
      siteStorageNamespacing: true,
      // fasterByDefault: false — @swc/html native Linux binary not in lockfile (generated on
      // Windows). Disabling prevents @docusaurus/faster from being auto-enabled, which would
      // trigger require('@swc/html') and fail on Linux CI with MODULE_NOT_FOUND.
      fasterByDefault: false,
      mdx1CompatDisabledByDefault: true,
    },
  },

  url: siteOrigin,
  baseUrl,

  organizationName: 'mieweb',
  projectName: 'mSheet',

  onBrokenLinks: isDev ? 'throw' : 'warn',

  customFields: {
    demoUrl,
  },

  // Ozwell chat widget — Schemie agent key (agnt_key- prefix, safe to embed publicly).
  // System prompt and tools are managed server-side via the agent definition.
  headTags: [
    {
      tagName: 'style',
      innerHTML:
        '#loco-lang-widget { bottom: 88px !important; z-index: 9997 !important; }',
      attributes: {},
    },
    {
      tagName: 'script',
      attributes: { src: '/loco.min.js' },
    },
    {
      tagName: 'script',
      innerHTML: `Loco.init({ apiUrl: 'https://loco.os.mieweb.org', apiKey: '202337e52dff4fb69e97857d' }); Loco.widget({ position: 'bottom-right' });`,
      attributes: {},
    },
    {
      tagName: 'script',
      innerHTML: `window.OzwellChatConfig={apiKey:'agnt_key-mq5nmgl81f6785d0d6da3dd0',title:'Schemie',welcomeMessage:'Hi! Ask me anything about eSheet \u2014 the builder, renderer, fields, or any package.',debug:true};`,
      attributes: { type: 'text/javascript' },
    },
  ],
  scripts: [
    {
      src: 'https://ozwellapi.os.mieweb.org/embed/ozwell-loader.js',
      async: true,
    },
    { src: '/js/ozwell-tools.js', async: true },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/mieweb/mSheet/tree/main/apps/docs/',
        },
        blog: false,
        theme: {
          customCss: ['./src/css/custom.css'],
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'eSheet',
        logo: {
          alt: 'eSheet logo',
          src: 'img/eSheet-modern.svg',
          style: { height: '20px', width: 'auto' },
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: demoUrl,
            prependBaseUrlToHref: false,
            target: '_self',
            className: 'header-live-demo-link',
            label: 'Demo',
            position: 'left',
          },
          {
            href: 'https://github.com/mieweb/mSheet',
            label: 'GitHub',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub Repository',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/intro',
              },
              {
                label: 'Builder',
                to: '/docs/builder/overview',
              },
              {
                label: 'Renderer',
                to: '/docs/renderer/overview',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/mieweb/mSheet',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Medical Informatics Engineering, LLC.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['json', 'bash', 'yaml'],
      },
    }),
};

export default config;
