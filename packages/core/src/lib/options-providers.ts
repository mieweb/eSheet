// ---------------------------------------------------------------------------
// Options providers — host-registered sources of live options for choice
// fields (issue #148). A definition names a provider; the host app registers
// what that name means. eSheet never fetches, authenticates or caches itself.
// ---------------------------------------------------------------------------

import type { SelectedOption } from './types.js';

/**
 * Declared on a field definition to source its options from a registered
 * provider instead of static `options` or a raw `dataSourceUrl`.
 *
 * `params` values may reference sibling answers with `{field:<fieldId>}`;
 * the token resolves to that field's `selected.id` (or `answer`) at request
 * time, so a filter can follow another question (e.g. a partition chosen
 * earlier in the form).
 */
export interface OptionsSource {
  /** Registered provider name, e.g. `users` or `staff`. */
  provider: string;
  /** Provider-specific filters, e.g. `{ realm: 'Case Management' }`. */
  params?: Record<string, string>;
}

/** An option a provider returns; `attributes` land on `response.attributes`. */
export interface ProvidedOption extends SelectedOption {
  attributes?: Record<string, string>;
}

/**
 * How a provider expects to be called.
 *
 * - `query` (default): called on each (debounced) keystroke with the typed
 *   text; the provider does the searching.
 * - `complete`: the set is small enough to hand over whole. Called once with
 *   an empty query; the field filters locally and opens on focus like a
 *   dropdown. Whether the host serves that set from the network or an
 *   offline cache is invisible to the field.
 */
export type OptionsProviderMode = 'query' | 'complete';

export interface OptionsProvider {
  mode?: OptionsProviderMode;
  fetch(
    query: string,
    params: Record<string, string>,
    signal: AbortSignal
  ): Promise<ProvidedOption[]>;
}

const providers = new Map<string, OptionsProvider>();

/** Register (or replace) the provider a definition may name. */
export function registerOptionsProvider(
  name: string,
  provider: OptionsProvider
): void {
  providers.set(name, provider);
}

export function unregisterOptionsProvider(name: string): void {
  providers.delete(name);
}

/** The provider for a name, or undefined when the host registered none. */
export function getOptionsProvider(name: string): OptionsProvider | undefined {
  return providers.get(name);
}

/** Reset the registry (tests). */
export function resetOptionsProviders(): void {
  providers.clear();
}

const FIELD_TOKEN = /\{field:([^}]+)\}/g;

/**
 * Resolve `{field:<id>}` tokens in `params` against the form's responses.
 * A param whose tokens all resolve to nothing is dropped rather than sent
 * empty, so a dependent filter is simply absent until its field is answered.
 */
export function resolveOptionsParams(
  params: Record<string, string> | undefined,
  lookup: (fieldId: string) => string | undefined
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, template] of Object.entries(params ?? {})) {
    let sawToken = false;
    let sawValue = false;
    const value = template.replace(FIELD_TOKEN, (_, fieldId: string) => {
      sawToken = true;
      const v = lookup(fieldId.trim()) ?? '';
      if (v) sawValue = true;
      return v;
    });
    if (sawToken && !sawValue) continue;
    resolved[key] = value;
  }
  return resolved;
}
