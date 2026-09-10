---
slug: /field-types/custom/autocomplete
---

# autocomplete

A type-ahead question from `@esheet/fields` that searches a live source as the
user types and stores the chosen item like a dropdown:
`{ selected: { id, value } }`. Because the response is self-contained, a saved
form renders without the source being reachable.

```ts
import { registerAutocompleteFieldType } from '@esheet/fields';
registerAutocompleteFieldType();
```

---

## Two ways to source options

### `optionsSource` — a host-registered provider (recommended)

The definition names a provider; the host application registers what that name
means. eSheet performs no fetching, authentication or caching itself — those
stay in the host, where the base URL, session and offline strategy already live.

```yaml
- id: caseManager
  fieldType: autocomplete
  question: Case manager
  optionsSource:
    provider: staff
    params: { realm: Case Management }
```

```ts
import { registerOptionsProvider } from '@esheet/core';

registerOptionsProvider('staff', {
  mode: 'complete',
  fetch: async (_query, params, signal) => {
    const res = await fetch(`/api/staff?realm=${encodeURIComponent(params.realm ?? '')}`, { signal });
    const users: { id: string; name: string }[] = await res.json();
    return users.map((u) => ({ id: u.id, value: u.name }));
  },
});
```

A provider returns `{ id, value, attributes? }[]`; `attributes` are copied onto
`response.attributes` of the chosen item.

#### `mode`

| mode | Provider is called… | Field behaviour |
| --- | --- | --- |
| `query` (default) | on every (debounced) keystroke with the typed text | provider does the searching; `minQueryLength` applies |
| `complete` | once, with an empty query | the whole set is filtered locally and the list opens on focus, like a dropdown |

Use `complete` for small reference sets (a handful to a few hundred rows). The
host decides whether that set comes from the network or an offline cache; the
field cannot tell the difference.

#### `params` and `{field:<id>}`

`params` are passed to the provider untouched, except that a value may
reference a sibling answer with `{field:<fieldId>}`. The token resolves to that
field's `selected.id` (or `answer`) at request time; a param whose tokens all
resolve to nothing is dropped, so a dependent filter is simply absent until the
driving question is answered.

```yaml
- id: employee
  fieldType: autocomplete
  optionsSource:
    provider: patients
    params: { partition: '{field:incidentCountry}' }
```

A `complete` provider is re-fetched when a `{field:…}` dependency changes.

An `optionsSource` whose provider is not registered degrades to an empty list,
so definitions stay portable between hosts.

### `dataSourceUrl` — a raw endpoint

For public endpoints with no auth story, the field can fetch a URL itself:

- `dataSourceUrl`: template with `{query}` replaced by the URL-encoded text
- `labelKey` / `valueKey`: keys of object-array responses (default `label`)
- `resultsPath`: dot-path to the array in an enveloped response
- `captureKeys`: keys copied from the chosen object into `response.attributes`

OpenSearch arrays (e.g. Wikipedia), string arrays and object arrays are
understood. `optionsSource` takes precedence when both are present.

---

## Other properties

- `minQueryLength`: characters before searching (default `2`; ignored for `complete` providers)
- `answerPlaceholder`: input placeholder
