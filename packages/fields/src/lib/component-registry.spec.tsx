import { afterEach, describe, expect, it } from 'vitest';
import {
  getFieldPropertyEditor,
  registerCustomFieldTypes,
  resetComponentRegistry,
} from './component-registry.js';

const FieldComponent = (): null => null;
const FirstEditor = (): null => null;
const SecondEditor = (): null => null;

function registration(propertyEditor?: typeof FirstEditor) {
  return {
    label: 'Registry test',
    category: 'rich' as const,
    answerType: 'text' as const,
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    component: FieldComponent,
    ...(propertyEditor ? { propertyEditor } : {}),
  };
}

afterEach(resetComponentRegistry);

describe('custom field property editor registry', () => {
  it('replaces a registered property editor', () => {
    registerCustomFieldTypes({ registryTest: registration(FirstEditor) });
    registerCustomFieldTypes({ registryTest: registration(SecondEditor) });

    expect(getFieldPropertyEditor('registryTest')).toBe(SecondEditor);
  });

  it('clears a stale property editor when replacement omits one', () => {
    registerCustomFieldTypes({ registryTest: registration(FirstEditor) });
    registerCustomFieldTypes({ registryTest: registration() });

    expect(getFieldPropertyEditor('registryTest')).toBeUndefined();
  });
});
