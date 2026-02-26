import {
  registerFieldType,
  getFieldTypeMeta,
  getRegisteredFieldTypes,
  resetFieldTypeRegistry,
  registerFieldElements,
} from './registry.js';
import { FIELD_TYPES } from './types.js';

describe('field type registry', () => {
  afterEach(() => {
    resetFieldTypeRegistry();
  });

  it('should have all 19 built-in types registered by default', () => {
    expect(getRegisteredFieldTypes()).toHaveLength(19);
    for (const ft of FIELD_TYPES) {
      expect(getFieldTypeMeta(ft)).toBeDefined();
    }
  });

  it('should return undefined for unknown field types', () => {
    expect(getFieldTypeMeta('nonexistent')).toBeUndefined();
  });

  it('should register a custom field type', () => {
    registerFieldType('vitals', {
      label: 'Vitals Field',
      category: 'text',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {},
    });

    expect(getFieldTypeMeta('vitals')).toBeDefined();
    expect(getFieldTypeMeta('vitals')!.label).toBe('Vitals Field');
    expect(getRegisteredFieldTypes()).toHaveLength(20);
  });

  it('should allow overriding a built-in field type', () => {
    registerFieldType('text', {
      label: 'Custom Text',
      category: 'text',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {},
    });

    expect(getFieldTypeMeta('text')!.label).toBe('Custom Text');
    expect(getRegisteredFieldTypes()).toHaveLength(19);
  });

  it('should reset to defaults', () => {
    registerFieldType('custom', {
      label: 'Custom',
      category: 'text',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {},
    });
    expect(getRegisteredFieldTypes()).toHaveLength(20);

    resetFieldTypeRegistry();
    expect(getRegisteredFieldTypes()).toHaveLength(19);
    expect(getFieldTypeMeta('custom')).toBeUndefined();
  });

  it('should preserve built-in seed after override', () => {
    registerFieldType('text', {
      label: 'Overridden',
      category: 'text',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {},
    });

    expect(getFieldTypeMeta('text')!.label).toBe('Overridden');

    // Reset should restore the original built-in value
    resetFieldTypeRegistry();
    expect(getFieldTypeMeta('text')!.label).toBe('Text Field');
  });

  it('should include defaultOptionCount for choice fields', () => {
    const radio = getFieldTypeMeta('radio')!;
    expect(radio.defaultOptionCount).toBe(3);

    const boolean = getFieldTypeMeta('boolean')!;
    expect(boolean.defaultOptionCount).toBeUndefined();

    const rating = getFieldTypeMeta('rating')!;
    expect(rating.defaultOptionCount).toBe(5);

    // Non-option fields should not have defaultOptionCount
    const text = getFieldTypeMeta('text')!;
    expect(text.defaultOptionCount).toBeUndefined();
  });

  it('should batch-register element classes via registerFieldElements', () => {
    class FakeText { }
    class FakeRadio { }

    registerFieldElements({
      text: FakeText as unknown as new () => unknown,
      radio: FakeRadio as unknown as new () => unknown,
    });

    expect(getFieldTypeMeta('text')!.elementClass).toBe(FakeText);
    expect(getFieldTypeMeta('radio')!.elementClass).toBe(FakeRadio);
    // Unregistered types remain unaffected
    expect(getFieldTypeMeta('check')!.elementClass).toBeUndefined();
  });

  it('should skip unknown keys in registerFieldElements', () => {
    class FakeComponent { }

    registerFieldElements({
      nonexistent: FakeComponent as unknown as new () => unknown,
    });

    expect(getFieldTypeMeta('nonexistent')).toBeUndefined();
  });
});
