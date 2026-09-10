import {
  getOptionsProvider,
  registerOptionsProvider,
  resetOptionsProviders,
  resolveOptionsParams,
  unregisterOptionsProvider,
} from './options-providers.js';

describe('options provider registry', () => {
  afterEach(() => resetOptionsProviders());

  it('registers, looks up and unregisters providers by name', () => {
    const provider = { fetch: async () => [] };
    registerOptionsProvider('staff', provider);
    expect(getOptionsProvider('staff')).toBe(provider);
    unregisterOptionsProvider('staff');
    expect(getOptionsProvider('staff')).toBeUndefined();
  });

  it('replaces a provider registered under the same name', () => {
    const first = { fetch: async () => [] };
    const second = { fetch: async () => [] };
    registerOptionsProvider('staff', first);
    registerOptionsProvider('staff', second);
    expect(getOptionsProvider('staff')).toBe(second);
  });
});

describe('resolveOptionsParams', () => {
  const answers: Record<string, string> = { country: 'us', site: '' };
  const lookup = (id: string) => answers[id];

  it('passes static params through', () => {
    expect(resolveOptionsParams({ realm: 'Case Management' }, lookup)).toEqual({
      realm: 'Case Management',
    });
  });

  it('substitutes {field:<id>} tokens', () => {
    expect(
      resolveOptionsParams({ partition: 'EE-{field:country}' }, lookup)
    ).toEqual({ partition: 'EE-us' });
  });

  it('drops params whose tokens resolve to nothing', () => {
    expect(
      resolveOptionsParams(
        { partition: '{field:site}', other: '{field:missing}', keep: 'x' },
        lookup
      )
    ).toEqual({ keep: 'x' });
  });

  it('returns an empty object without params', () => {
    expect(resolveOptionsParams(undefined, lookup)).toEqual({});
  });
});
