// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/quickstart-builder',
        'getting-started/quickstart-renderer',
        'getting-started/quickstart-standalone',
        'getting-started/quickstart-blaze',
        'getting-started/theming',
      ],
    },
    'schema-format',
    'field-types',
    'conditional-logic',
    {
      type: 'category',
      label: 'Builder',
      items: [
        'builder/overview',
        'builder/canvas',
        'builder/editing',
        'builder/code-view',
        'builder/exporting',
        'builder/touch-mode',
      ],
    },
    {
      type: 'category',
      label: 'Renderer',
      items: [
        'renderer/overview',
        'renderer/responses',
        'renderer/validation',
        'renderer/touch-mode',
      ],
    },
    {
      type: 'category',
      label: 'Adapters',
      items: [
        'adapters/overview',
        'adapters/surveyjs',
        'adapters/mcp',
        'adapters/fhir',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/custom-field-types',
        'advanced/store-architecture',
        'advanced/expression-system',
        'advanced/mcp-integration',
      ],
    },
    'api-reference',
    'contributing',
  ],
};

export default sidebars;
