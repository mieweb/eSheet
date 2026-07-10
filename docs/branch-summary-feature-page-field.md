# Branch Summary: `feature/page-field`

## Overview

This branch introduces first-class form pages into the eSheet data model and then threads that model through the core store, renderer, builder, and adapter layers.

The biggest change is a schema shift:

- Forms now define top-level `pages` instead of a flat top-level `fields` array.
- Each page contains its own `fields`.
- A new built-in `pages` field type was added for page containers inside the normalized tree.

The result is a more explicit page-based authoring and rendering model, with multi-page navigation in the renderer and page-aware insertion behavior in the builder.

## High-Level Impact

- Forms are now page-oriented at the schema level.
- Import/export paths for FHIR, MCP, and SurveyJS now read and write `pages`.
- The renderer supports page navigation when there are multiple root pages.
- The builder can create, select, and insert into pages as active containers.
- The core schema and normalization logic were updated to treat `pages` as a built-in recursive container type.
- Demo schemas and tests were rewritten to use the new structure.

## Core Data Model Changes

### `FormDefinition` now uses `pages`

In `packages/core/src/lib/types.ts`, the top-level `FormDefinition` schema changed from:

- `fields: FieldDefinition[]`

to:

- `pages: PageEntry[]`

Each `PageEntry` contains:

- `id`
- optional `title`
- optional `autoAdvance`
- optional `fields`

This is a breaking API change for any code that previously read or wrote top-level `fields`.

### New `pages` field type

A new `PagesFieldDefinition` was added as a built-in field type.

It supports:

- `fieldType: 'pages'`
- optional `title`
- optional `autoAdvance`
- nested `fields`

It behaves like a container, similar to `section`, but is used to represent page containers in the normalized field tree.

### Registry updates

`packages/core/src/lib/registry.ts` now registers `pages` as a built-in field type with:

- category: `organization`
- answer type: `container`
- default props: `{ fields: [], autoAdvance: false }`

This is also reflected in the exported field type unions and registry tests.

## Normalization and Store Behavior

### Normalization now understands pages

`packages/core/src/lib/functions/normalize.ts` was updated so normalization recursively walks both:

- `section`
- `pages`

This means page containers are preserved in the flat indexed graph alongside other field nodes.

### Top-level pages are converted into normalized `pages` nodes

`normalizeFormDefinition()` now accepts a top-level `pages` array and converts it into `fields` entries where each page becomes a normalized `pages` node.

This lets the internal normalized tree stay consistent while the public schema becomes page-first.

### Form store hydration now emits `pages`

`packages/core/src/lib/stores/form-store.ts` now hydrates back into a page-based `FormDefinition`.

Behavior:

- If every root node is a `pages` container, the store emits a top-level `pages` array.
- Otherwise, it falls back to wrapping root fields into a single page.

This makes the new page model the default while still providing a compatibility path for older or transitional inputs.

### UI store tracks the active page

`packages/core/src/lib/stores/ui-store.ts` adds:

- `activePagesId`
- `setActivePagesId()`

This lets the builder keep the current page selection synchronized with the canvas and tool panel.

## Renderer Changes

### Renderer input is now page-based

`packages/renderer/src/lib/renderer.ts` now flattens `definition.pages[].fields` instead of reading `definition.fields` directly.

This means the renderer expects the new page-oriented form shape.

### Renderer initialization now validates page-based definitions

`packages/renderer/src/lib/hooks/useRendererInit.ts` now loads fallback error forms with `pages: []` instead of `fields: []`.

It also documents that SurveyJS detection includes top-level `pages` or `elements`.

### `RendererBody` now supports page navigation

`packages/renderer/src/lib/components/RendererBody.tsx` gained the major UI change for runtime rendering:

- It separates root `pages` nodes from non-page root nodes.
- It shows a page navigation bar when there are multiple page containers.
- It tracks a current page index.
- It renders only the active page’s children in the multi-page case.
- It shows previous/next controls and page labels.

Non-page root fields still render normally alongside the page workflow.

### `FieldNode` treats `pages` like a container

`packages/renderer/src/lib/components/FieldNode.tsx` now:

- recursively renders children for both `section` and `pages`
- adjusts wrapper styling for `pages`
- treats page nodes as container ancestors for visibility and selection behavior

### Renderer default components include `PagesField`

`packages/renderer/src/lib/register-defaults.ts` and `packages/fields/src/index.ts` now register/export the new `PagesField` component.

The `EsheetRenderer` wrapper also hydrates its definition output as:

- `pages: [{ id: 'page-1', fields: ... }]`

instead of a flat `fields` array.

## Builder Changes

### Page-aware insertion behavior

`packages/builder/src/lib/components/ToolPanel.tsx` now chooses insertion targets based on context:

- `pages` always insert at the root.
- `section` fields insert into the active page.
- ordinary fields insert into the selected section when one is active.
- otherwise, they insert into the active page or root.

This makes page containers the primary insertion context in the builder.

### Canvas now understands active pages

`packages/builder/src/lib/components/Canvas.tsx` was updated so:

- root `pages` are treated as active page containers
- the canvas displays the current page’s children
- page navigation controls appear when multiple pages exist
- the active page ID is synced into the UI store
- drag and drop works with pages as containers
- preview rendering treats pages like sections

### Builder import/export and code view now use pages

`packages/builder/src/lib/builder-tools.ts` and `packages/builder/src/lib/components/CodeView.tsx` now load and clear definitions using `pages`.

`packages/builder/src/lib/components/BuilderHeader.tsx` now:

- counts imported fields by flattening all page fields
- collects import warnings from the page-based definition
- reports import totals using the new structure

### Builder component registry

`packages/builder/src/lib/register-defaults.ts` now registers the `PagesField` component so it appears in the builder UI.

## Adapter Changes

### FHIR adapter now reads/writes pages

`packages/adapters/src/fhir/fhir-adapter.ts` now:

- imports Questionnaire items into `pages: [{ id: 'page-1', fields }]`
- exports FHIR items by flattening all pages
- exports QuestionnaireResponse answers from all page fields

This preserves compatibility with FHIR while matching the new internal form model.

### MCP adapter now reads/writes pages

`packages/adapters/src/lib/mcp.ts` now:

- imports elicitation schemas into a single page
- exports leaf properties by flattening all page fields

The MCP tests were updated accordingly.

### SurveyJS converter now maps to first-class pages

`packages/adapters/src/lib/surveyjs-converter.ts` got the most extensive adapter rewrite:

- SurveyJS pages now map directly to eSheet pages.
- Single-page survey definitions still become a single page.
- Exporting eSheet to SurveyJS now emits page entries when `form.pages` exists.
- Existing section-based fallback behavior is still supported for older forms.
- `isSurveyJSSchema()` now distinguishes SurveyJS pages from eSheet pages by checking whether the first page has `fields` instead of `elements`.

This preserves round-trip support while adopting the new schema model.

## Demo and Example Schema Updates

The demo schemas under `apps/demo/src/schemas` and `apps/demo/public/test-schemas` were rewritten to the new page structure.

Examples include:

- `patient-intake.json`
- `patient-intake-broken.json`
- `comprehensive.json`
- `employee-onboarding.json`
- `expression-functions.json`
- `js-calculations.json`
- `js-conditions.json`
- `js-mixed.json`
- `nps.json`
- `phq9.json`
- `bmi-calculator.json`
- `ppd-reading.json`
- `travel-risk-score.json`

The renderer demo view in `apps/demo/src/views/RendererView.tsx` also now displays page-based definitions in the definition tab.

## Field Package Changes

### New `PagesField` component

`packages/fields/src/fields/pages/PagesField.tsx` defines the new page container UI.

Behavior:

- In preview mode, it renders the nested children only.
- In builder/edit mode, it exposes a `Page Title` input.
- It mirrors the section-style container behavior but is visually and semantically page-specific.

The component is exported from:

- `packages/fields/src/fields/index.ts`
- `packages/fields/src/index.ts`

## Test Coverage Updates

Tests were updated across the stack to reflect the new model:

- core type and registry tests now expect 22 built-in field types
- form store tests now assert page-based root structure and hydration
- renderer tests now build definitions with `pages`
- FHIR adapter tests now import/export through `pages`
- MCP adapter tests now read fields from the first page
- renderer and builder tests now verify page-aware behavior

## Compatibility Notes

This branch is intentionally disruptive to the top-level schema:

- old `fields`-based form definitions are no longer the primary form shape
- import/export layers translate older inputs when possible
- internal normalization still uses a flat indexed tree, but page containers are now explicit nodes
- consumers that directly construct `FormDefinition` objects need to switch to `pages`

## Practical Summary

In practical terms, this branch turns eSheet into a page-native form system:

- authors organize fields by page
- the builder knows which page is active
- the renderer navigates between pages
- adapters preserve page structure through external formats
- the public API now reflects pages as the top-level form concept

