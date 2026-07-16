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
    {
      type: 'category',
      label: 'Field Types',
      items: [
        'field-types/overview',
        {
          type: 'category',
          label: 'Custom',
          items: ['field-types/custom', 'field-types/custom/kerebron'],
        },
        {
          type: 'category',
          label: 'Text',
          items: [
            'field-types/text/text',
            'field-types/text/longtext',
            'field-types/text/multitext',
          ],
        },
        {
          type: 'category',
          label: 'Selection',
          items: [
            'field-types/selection/radio',
            'field-types/selection/check',
            'field-types/selection/boolean',
            'field-types/selection/dropdown',
            'field-types/selection/multiselectdropdown',
          ],
        },
        {
          type: 'category',
          label: 'Rating',
          items: [
            'field-types/rating/rating',
            'field-types/rating/ranking',
            'field-types/rating/slider',
          ],
        },
        {
          type: 'category',
          label: 'Matrix',
          items: [
            'field-types/matrix/singlematrix',
            'field-types/matrix/multimatrix',
          ],
        },
        {
          type: 'category',
          label: 'Organization',
          items: ['field-types/organization/section'],
        },
        {
          type: 'category',
          label: 'Rich',
          items: [
            'field-types/rich/display',
            'field-types/rich/html',
            'field-types/rich/image',
            'field-types/rich/signature',
            'field-types/rich/diagram',
          ],
        },
      ],
    },
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
        {
          type: 'category',
          label: 'FHIR',
          items: ['adapters/fhir/fhir-adapter', 'adapters/fhir/extensions'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/custom-field-types',
        'advanced/store-architecture',
        'advanced/expression-system',
        'advanced/collaboration',
        {
          type: 'category',
          label: 'Dangerous JS',
          link: { type: 'doc', id: 'advanced/dangerous-js' },
          items: [
            'advanced/dangerous-js-calculations',
            'advanced/dangerous-js-conditions',
          ],
        },
        'advanced/mcp-integration',
      ],
    },
    'api-reference',
    'contributing',
  ],
};

export default sidebars;
