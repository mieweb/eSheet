import {
  registerFieldType,
  getDefaultProp,
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

  it('should have all 23 built-in types registered by default', () => {
    expect(getRegisteredFieldTypes()).toHaveLength(23);
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
    expect(getRegisteredFieldTypes()).toHaveLength(24);
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
    expect(getRegisteredFieldTypes()).toHaveLength(23);
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
    expect(getRegisteredFieldTypes()).toHaveLength(24);

    resetFieldTypeRegistry();
    expect(getRegisteredFieldTypes()).toHaveLength(23);
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
    expect(getFieldTypeMeta('text')!.label).toBe('Text');
  });

  it('should include defaultOptionCount for choice fields', () => {
    const radio = getFieldTypeMeta('radio')!;
    expect(radio.defaultOptionCount).toBe(3);

    const boolean = getFieldTypeMeta('boolean')!;
    expect(boolean.defaultOptionCount).toBe(2);

    const rating = getFieldTypeMeta('rating')!;
    expect(rating.defaultOptionCount).toBe(5);

    // Non-option fields should not have defaultOptionCount
    const text = getFieldTypeMeta('text')!;
    expect(text.defaultOptionCount).toBeUndefined();
  });

  it('should define the default layout for built-in field types', () => {
    const thirdWidthTypes = [
      'text',
      'longtext',
      'multitext',
      'radio',
      'check',
      'boolean',
      'dropdown',
      'multiselectdropdown',
      'openchoice',
      'rating',
      'ranking',
      'slider',
    ];
    for (const fieldType of thirdWidthTypes) {
      expect(getFieldTypeMeta(fieldType)?.defaultProps.width).toBe('third');
    }

    for (const fieldType of ['multitext', 'radio', 'check', 'openchoice']) {
      expect(getFieldTypeMeta(fieldType)?.defaultProps.optionLayout).toBe(
        'wrap'
      );
    }

    for (const fieldType of [
      'singlematrix',
      'multimatrix',
      'image',
      'html',
      'signature',
      'diagram',
      'file',
      'display',
      'pages',
    ]) {
      expect(getFieldTypeMeta(fieldType)?.defaultProps.width).toBe('full');
    }

    expect(getFieldTypeMeta('section')?.defaultProps.width).toBe('none');
  });

  it('should resolve option layout defaults from field metadata', () => {
    expect(getDefaultProp('radio', 'optionLayout')).toBe('wrap');
    expect(getDefaultProp('check', 'optionLayout')).toBe('wrap');
    expect(getDefaultProp('signature', 'optionLayout')).toBeUndefined();
    expect(getDefaultProp('unknown', 'optionLayout')).toBeUndefined();
  });

  it('should resolve any default property from field metadata', () => {
    expect(getDefaultProp('text', 'inputType')).toBe('string');
    expect(getDefaultProp('text', 'width')).toBe('third');
    expect(getDefaultProp('signature', 'width')).toBe('full');
  });

  it('should batch-register element classes via registerFieldElements', () => {
    class FakeText {}
    class FakeRadio {}

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
    class FakeComponent {}

    registerFieldElements({
      nonexistent: FakeComponent as unknown as new () => unknown,
    });

    expect(getFieldTypeMeta('nonexistent')).toBeUndefined();
  });
});
