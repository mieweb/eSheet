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
    v4: true,
  },

  url: siteOrigin,
  baseUrl,

  organizationName: 'mieweb',
  projectName: 'mSheet',

  onBrokenLinks: isDev ? 'throw' : 'warn',

  customFields: {
    demoUrl,
  },

  // Ozwell chat widget — CDN embed approach.
  // The API key is injected at build time from OZWELL_API_KEY env var so it
  // is never committed to source. Set it in .env.local or CI secrets.
  headTags: [
    {
      tagName: 'script',
      innerHTML: `window.OzwellChatConfig = ${JSON.stringify({
        apiKey: process.env.OZWELL_API_KEY ?? '',
        endpoint: 'https://ozwellapi.opensource.mieweb.org/v1/chat/completions',
        system:
          'You are a documentation assistant for eSheet, a modular questionnaire/form builder and renderer for React. You have one tool: search_docs. To answer ANY question, invoke search_docs with a short plain-text keyword query string — for example, to answer "how many field types?" call search_docs with query="field types". NEVER output JSON, NEVER write a function call as text. Just invoke the tool silently, then answer using only the content it returns. If the content does not confirm the answer, say "I could not find that in the eSheet docs".',
        welcomeMessage:
          'Hi! Ask me anything about eSheet — the builder, renderer, fields, or any package.',
        title: 'Schemie',
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_docs',
              description:
                'Search the eSheet documentation. Pass a short keyword query (e.g. "field types", "installation", "renderer responses") and receive the most relevant page content.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description:
                      'A short plain-text keyword query, e.g. "field types", "installation", "renderer responses". Must be a string — not a schema object.',
                  },
                },
                required: ['query'],
              },
            },
          },
        ],
      })};`,
      attributes: {},
    },
  ],
  scripts: [
    {
      src: 'https://ozwell-dev-refserver.opensource.mieweb.org/embed/ozwell-loader.js',
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
        respectPrefersColorScheme: true,
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
