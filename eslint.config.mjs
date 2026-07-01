import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    ignores: [
      '**/dist',
      '**/build',
      '**/.docusaurus',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      'apps/demo/public/**',
      'apps/docs/static/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:core',
              onlyDependOnLibsWithTags: ['scope:core'],
            },
            {
              sourceTag: 'scope:renderer',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:fields',
                'scope:renderer',
                'scope:adapters',
              ],
            },
            {
              sourceTag: 'scope:builder',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:builder',
                'scope:fields',
                'scope:adapters',
              ],
            },
            {
              sourceTag: 'scope:fields',
              onlyDependOnLibsWithTags: ['scope:core'],
            },
            {
              sourceTag: 'scope:field-kerebron',
              onlyDependOnLibsWithTags: ['scope:core'],
            },
            {
              sourceTag: 'scope:adapters',
              onlyDependOnLibsWithTags: ['scope:core'],
            },
            {
              // Private apps can depend on any internal library
              sourceTag: 'npm:private',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:fields',
                'scope:field-kerebron',
                'scope:builder',
                'scope:renderer',
                'scope:adapters',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
