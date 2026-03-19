import {
  SCHEMA_TYPE,
  type FormDefinition,
  type FormResponse,
} from '@msheet/core';
import { renderer } from './renderer.js';

describe('renderer', () => {
  function baseDefinition(): FormDefinition {
    return {
      schemaType: SCHEMA_TYPE,
      title: 'Renderer Test',
      fields: [
        {
          id: 'toggle',
          fieldType: 'radio',
          options: [
            { id: 'yes', value: 'yes', text: 'Yes' },
            { id: 'no', value: 'no', text: 'No' },
          ],
        },
        {
          id: 'section-main',
          fieldType: 'section',
          title: 'Main Section',
          fields: [
            {
              id: 'child-a',
              fieldType: 'text',
              question: 'Child A',
            },
            {
              id: 'section-nested',
              fieldType: 'section',
              title: 'Nested Section',
              fields: [
                {
                  id: 'nested-child',
                  fieldType: 'text',
                  question: 'Nested Child',
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it('builds nested section tree', () => {
    const tree = renderer(baseDefinition());

    expect(tree.map((n) => n.id)).toEqual(['toggle', 'section-main']);
    expect(tree[1].children.map((n) => n.id)).toEqual([
      'child-a',
      'section-nested',
    ]);
    expect(tree[1].children[1].children.map((n) => n.id)).toEqual([
      'nested-child',
    ]);
  });

  it('hides section children by default when rules resolve invisible', () => {
    const definition = baseDefinition();
    definition.fields[1].fields![0].rules = [
      {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'field',
            targetId: 'toggle',
            operator: 'equals',
            expected: 'yes',
          },
        ],
      },
    ];

    const responses: FormResponse = {
      toggle: { selected: { id: 'no', value: 'No' } },
    };

    const tree = renderer(definition, responses);
    const mainSection = tree.find((n) => n.id === 'section-main');

    expect(mainSection).toBeDefined();
    expect(mainSection?.children.map((n) => n.id)).toEqual(['section-nested']);
  });

  it('can include hidden nodes for preview/debug rendering', () => {
    const definition = baseDefinition();
    definition.fields[1].rules = [
      {
        effect: 'visible',
        logic: 'AND',
        conditions: [
          {
            conditionType: 'field',
            targetId: 'toggle',
            operator: 'equals',
            expected: 'yes',
          },
        ],
      },
    ];

    const responses: FormResponse = {
      toggle: { selected: { id: 'no', value: 'No' } },
    };

    const defaultTree = renderer(definition, responses);
    expect(defaultTree.map((n) => n.id)).toEqual(['toggle']);

    const allTree = renderer(definition, responses, { includeHidden: true });
    const hiddenSection = allTree.find((n) => n.id === 'section-main');

    expect(hiddenSection).toBeDefined();
    expect(hiddenSection?.visible).toBe(false);
    expect(hiddenSection?.children.map((n) => n.id)).toEqual([
      'child-a',
      'section-nested',
    ]);
  });

  it('computes enabled and required from responses', () => {
    const definition: FormDefinition = {
      schemaType: SCHEMA_TYPE,
      title: 'Renderer Effects Test',
      fields: [
        {
          id: 'toggle',
          fieldType: 'radio',
          options: [
            { id: 'yes', value: 'yes', text: 'Yes' },
            { id: 'no', value: 'no', text: 'No' },
          ],
        },
        {
          id: 'target',
          fieldType: 'text',
          question: 'Target',
          rules: [
            {
              effect: 'enable',
              logic: 'AND',
              conditions: [
                {
                  conditionType: 'field',
                  targetId: 'toggle',
                  operator: 'equals',
                  expected: 'yes',
                },
              ],
            },
            {
              effect: 'required',
              logic: 'AND',
              conditions: [
                {
                  conditionType: 'field',
                  targetId: 'toggle',
                  operator: 'equals',
                  expected: 'yes',
                },
              ],
            },
          ],
        },
      ],
    };

    const treeWhenNo = renderer(definition, {
      toggle: { selected: { id: 'no', value: 'no' } },
    });
    const targetWhenNo = treeWhenNo.find((n) => n.id === 'target');
    expect(targetWhenNo).toBeDefined();
    expect(targetWhenNo?.enabled).toBe(false);
    expect(targetWhenNo?.required).toBe(false);

    const treeWhenYes = renderer(definition, {
      toggle: { selected: { id: 'yes', value: 'yes' } },
    });
    const targetWhenYes = treeWhenYes.find((n) => n.id === 'target');
    expect(targetWhenYes).toBeDefined();
    expect(targetWhenYes?.enabled).toBe(true);
    expect(targetWhenYes?.required).toBe(true);
  });
});
