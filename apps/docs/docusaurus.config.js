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
  // ozwell-config.js sets window.OzwellChatConfig synchronously before the
  // loader runs, so no headTags trick is needed and it works in dev + prod.
  scripts: [
    { src: '/js/ozwell-config.js' },
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
