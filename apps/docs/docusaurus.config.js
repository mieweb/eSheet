// @ts-check
import { themes as prismThemes } from 'prism-react-renderer';

const isDev = process.env.NODE_ENV === 'development';
const demoUrl = isDev
  ? 'http://localhost:4200'
  : 'https://esheet-demo.os.mieweb.org/';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'eSheet Documentation',
  tagline: 'Modular form builder & renderer for React',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://esheet-docs.os.mieweb.org',
  baseUrl: '/',

  organizationName: 'mieweb',
  projectName: 'mSheet',

  onBrokenLinks: 'throw',

  customFields: {
    demoUrl,
  },

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
            label: 'Live Demo',
            position: 'left',
            target: '_blank',
            className: 'header-live-demo-link',
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
