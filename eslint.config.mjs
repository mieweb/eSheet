import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/build',
      '**/.docusaurus',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
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
              sourceTag: 'scope:ai-gateway',
              onlyDependOnLibsWithTags: ['scope:core'],
            },
            {
              // Private apps can depend on any internal library
              sourceTag: 'npm:private',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:fields',
                'scope:builder',
                'scope:renderer',
                'scope:ai-gateway',
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
