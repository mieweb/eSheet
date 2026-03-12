# Co-Pilot Instructions — Clean, Simple, Consistent

## Project Context

This is an **Nx monorepo** for the **vNext** rewrite of the Questionnaire Builder packages, written in **TypeScript**.  
Packages live in `packages/` and are pure TypeScript libraries (no React, no UI).

---

## Core Principles

- **KISS — Keep It Simple & Stupid**

  - Prefer the _simplest_ working solution.
  - Remove optional parameters, layers, or abstractions unless proven necessary.

- **DRY — Don't Repeat Yourself**

  - Extract small helpers only when repetition is real (≥2 places now, likely 3+).
  - Reuse existing utilities before creating new ones.

- **YAGNI — You Aren't Gonna Need It**

  - No speculative features, flags, or extensibility points.
  - Implement only what today's requirement needs.

- **Minimal Diff**

  - Change as little code as possible to solve the problem.
  - Prefer **surgical edits** over rewrites; keep file count stable.
  - Avoid introducing new dependencies and new files unless unavoidable.

- **Consistency Over Cleverness**
  - Match the project's **naming, patterns, and structure**.
  - Prefer patterns already used in the codebase to new paradigms.

---

## Guardrails for Copilot

When proposing code, **adhere to all of the following**:

1. **Stay in Place**

   - Modify existing functions before adding new ones.
   - If a helper is needed, place it near its first use within the same file.

2. **Match Style**

   - Mirror existing naming, file layout, import style, and error handling patterns.
   - Keep public API shapes and function signatures stable unless a bug requires change.

3. **No New Files by Default**

   - Do not create new modules unless duplication or complexity becomes worse without them.
   - Never create standalone markdown documentation files (e.g., PR tickets, feature docs, summaries).
   - Embed all information directly into code comments or verbally respond to user.
   - **Exception:** Internal tickets can be created in `.github/INTERNAL-TICKETS/` for feature planning (gitignored, local only).

4. **Zero Surprises**

   - Avoid side effects, global state changes, or cross-cutting refactors.
   - Keep behavior backward-compatible unless the task explicitly requests otherwise.

5. **Only Change When Explicitly Told**
   - Do NOT make changes unless explicitly asked, given clear permission, or strongly hinted.
   - Do NOT assume what should be changed or refactored.
   - Ask for clarification if instructions are ambiguous.
   - Respect the current state of the code unless directed otherwise.
   - Do NOT "improve" or refactor code without being told to do so.

---

## Decision Checklist (run before editing)

- [ ] Is the change the **simplest** that works?
- [ ] Does it **reuse** existing utilities?
- [ ] Is the **diff minimal** (fewest lines/files touched)?
- [ ] Does it **preserve names** and coding style?
- [ ] Did I avoid **new files/deps/config**?
- [ ] Are error cases handled like nearby code handles them?
- [ ] Are performance and readability balanced (favor readability if perf is fine)?

If any box is unchecked, **simplify**.

---

## Preferred Patterns

- **Early returns** instead of nested `if`s.
- **Small helpers** only when repeated or clearly improves clarity.
- **Immutable updates** where the codebase already does so.
- **Localize complexity**: keep tricky logic private/internal.
- **Keep functions short** (< ~40 lines when possible).
- **High-level first**: exported / public functions at the top, private helpers below. Readers see the API before the implementation details. **Note:** `const`/`let` are not hoisted — data constants must still appear before the code that initializes from them.

### TypeScript Specific

- **Strict mode is on** — no `any` unless absolutely unavoidable. Prefer `unknown` + type narrowing.
- **Use `nodenext` module resolution** — use `.js` extensions in relative imports (e.g., `import { foo } from './utils.js'`).
- **Export types explicitly** — use `export type` for type-only exports.
- **Prefer interfaces over type aliases** for object shapes (unless union/intersection is needed).
- **No enums** — use `const` objects with `as const` or string literal unions instead.
- **Use `readonly` where appropriate** — for function parameters that shouldn't be mutated and immutable data structures.

### Nx Monorepo Specific

- **Always run tasks through Nx** — use `npx nx run`, `npx nx run-many`, `npx nx affected` instead of running tools directly.
- **Don't modify `project.json` directly** — targets are inferred by plugins (`@nx/js/typescript`, `@nx/vite`, `@nx/eslint`, `@nx/vitest`). Use `nx show project <name> --json` to see resolved config.
- **Package exports use `@msheet/source` custom condition** — for dev-time TS source imports between packages.
- **Respect module boundaries** — `@nx/enforce-module-boundaries` is enforced. Check tags before adding cross-package imports.
- **Use `tslib`** — `importHelpers: true` is set in `tsconfig.base.json`. All packages depend on `tslib`.

### React & UI Packages

- **CRITICAL: `ms:` Prefix MUST Come Before Variant Modifiers**: This project uses Tailwind v4 with `prefix(ms)`. The `ms:` prefix must appear **before** any variant modifier (hover, focus, active, sm, md, lg, etc.). Getting this wrong silently breaks styles.

  ```tsx
  // ✅ CORRECT - ms: before variant
  <div className="ms:hover:bg-msprimary ms:focus:outline-none ms:sm:grid-cols-2 ms:active:cursor-grabbing ms:group-hover:text-msdanger ms:placeholder:text-mstextmuted">

  // ❌ WRONG - variant before ms: (WILL NOT WORK)
  <div className="hover:ms:bg-msprimary focus:ms:outline-none sm:ms:grid-cols-2 active:ms:cursor-grabbing group-hover:ms:text-msdanger placeholder:ms:text-mstextmuted">

  // ❌ WRONG - double prefix (WILL NOT WORK)
  <div className="ms:hover:ms:bg-msprimary">
  ```

- **ALL Form Inputs Must Have `id` Attributes with `instanceId` Prefix**: Every `<input>`, `<select>`, and `<textarea>` element across **all** UI packages (`@msheet/builder`, `@msheet/renderer`, `@msheet/fields`, or any future package rendering form elements) must have an `id` attribute. Use the `useInstanceId()` hook to ensure IDs are unique when multiple component instances share the same page.

  **ID pattern:** `${instanceId}-{purpose}-${fieldId}`
  - Builder mode: `${instanceId}-editor-question-${def.id}`
  - Preview/renderer mode: `${instanceId}-{fieldType}-answer-${def.id}`
  - Any input: `${instanceId}-{context}-{purpose}-${def.id}`

  ```tsx
  // ❌ BAD - no id (breaks autofill), or static id (duplicates with 2 instances)
  <input type="text" value={value} />
  <input id="question-field" type="text" value={value} />

  // ✅ GOOD - unique id with instanceId prefix
  const instanceId = useInstanceId();
  <input
    id={`${instanceId}-editor-question-${def.id}`}
    type="text"
    value={value}
  />
  ```

  **Why this matters:**
  - Browser autofill requires `id` or `name` attributes to work
  - Multiple instances on one page would have duplicate IDs without `instanceId`
  - Accessibility tools use IDs to associate labels with inputs
  - `React.useId()` powers this — guaranteed unique across the React tree and SSR-safe
  - This applies to **all modes** (builder, preview, renderer) — not just the editor

- **ALL Form Inputs Must Have an Associated Label**: Every `<input>`, `<select>`, and `<textarea>` must be associated with a label — either via a `<label htmlFor="...">` matching the input's `id`, or via `aria-label` on the input itself. **Never render a form input without one of these.**

  **When to use which:**
  - **`<label htmlFor>`** — when a visible text label exists (e.g., "Question", "Field ID", "Required")
  - **`aria-label`** — when the input is in a compact list/row where a visible label would clutter the UI (e.g., option list items, matrix row/column inputs)

  ```tsx
  // ❌ BAD - input with no label association
  <label className="...">Field ID</label>
  <input id={`${instanceId}-editor-id-${fieldId}`} type="text" />

  // ❌ BAD - label exists but no htmlFor, and no aria-label
  <input id={`${instanceId}-editor-option-${fieldId}-${opt.id}`} type="text" />

  // ✅ GOOD - visible label with htmlFor
  <label htmlFor={`${instanceId}-editor-id-${fieldId}`} className="...">Field ID</label>
  <input id={`${instanceId}-editor-id-${fieldId}`} type="text" />

  // ✅ GOOD - aria-label for compact list items
  <input
    id={`${instanceId}-editor-option-${fieldId}-${opt.id}`}
    aria-label={`Option ${idx + 1}`}
    type="text"
  />
  ```

- **No Duplicate IDs Between Panels**: When the same field data appears in multiple panels (e.g., Canvas + EditPanel), use **different purpose segments** in the ID pattern to avoid duplicates:
  - Canvas inputs: `${instanceId}-canvas-{purpose}-${fieldId}`
  - EditPanel inputs: `${instanceId}-editor-{purpose}-${fieldId}`

  ```tsx
  // ❌ BAD - both Canvas and EditPanel produce the same id
  // FieldItem.tsx (Canvas)
  <input id={`${instanceId}-editor-question-${def.id}`} />
  // CommonEditor.tsx (EditPanel)
  <input id={`${instanceId}-editor-question-${fieldId}`} />

  // ✅ GOOD - different context prefix prevents collision
  // FieldItem.tsx (Canvas)
  <input id={`${instanceId}-canvas-question-${def.id}`} />
  // CommonEditor.tsx (EditPanel)
  <input id={`${instanceId}-editor-question-${fieldId}`} />
  ```

- **Flatten Redundant Wrapper Divs**: When preview mode sections have nested layout containers where the outer wrapper only contains an inner layout div (with no additional semantic meaning or styling constraints), merge them into a single element. This pattern is common in field preview sections.

  **When to flatten:**
  - Outer div: `className="*-field-preview ...basic utilities..."` (semantic class for styling/debugging)
  - Inner div: `className="ms:grid ms:grid-cols-1 ..."` (pure layout utilities)
  - The outer wrapper adds nothing but an extra nesting level

  **Pattern (applies to field preview sections):**
  ```tsx
  // BEFORE - redundant nesting
  <div className="text-field-preview">
    <div className="ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
      <div className="ms:font-light ms:text-mstext">Question</div>
      <input />
    </div>
  </div>

  // AFTER - flattened and cleaner
  <div className="text-field-preview ms:grid ms:grid-cols-1 ms:gap-2 ms:sm:grid-cols-2 ms:pb-4">
    <div className="ms:font-light ms:text-mstext">Question</div>
    <input />
  </div>
  ```

  **Rules:**
  - Keep the semantic class name (e.g., `text-field-preview`, `rating-field-preview`) on the merged element
  - Merge layout utilities from the inner div to the outer element
  - Only flatten when the outer wrapper provides no semantic layout purpose (just a nesting container)
  - Don't flatten wrapper divs that provide conditional rendering logic or have complex state management
  - Don't flatten wrappers that provide animation/transition context (those serve a purpose)

---

## Anti-Patterns to Avoid

- New abstractions "just in case."
- Wide-ranging renames or stylistic rewrites.
- Introducing a new library for a trivial utility.
- Creating new configuration, environment flags, or build steps.
- Over-generalization (factories, strategy classes) without proof of need.
- Using `any` instead of proper types.
- Barrel files that re-export everything — keep exports intentional.

---

## When a New File Is Allowed (rare)

Only if **all** are true:

- The same logic appears in **≥3** places or will immediately be reused in multiple modules.
- Keeping it inline measurably **increases** duplication or cognitive load.
- The file fits existing folder conventions and naming patterns.

---

## Naming & Structure Preservation

- Keep function, variable, and type names **unchanged** unless:

  - The name is incorrect or misleading relative to behavior.
  - A bug fix requires a signature change.
    In those cases, **prefer a wrapper** to keep external call sites stable.

- Respect the **current layering** (e.g., packages → shared utils). Don't invert it.

---

## Commenting & Tests (light touch)

- Prefer **self-evident code**. Add a one-line comment only for non-obvious decisions.
- If tests exist:
  - Update the **smallest** set of tests needed.
  - Add a focused test only when fixing a bug without coverage.
- Tests use **Vitest** with `globals: true` — no need to import `describe`/`it`/`expect`.
- Test files go next to source: `foo.ts` → `foo.spec.ts`.

---

## Example: Minimal Diff Refactor

**Before**

```ts
function getTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price ? items[i].price : 0;
  }
  return total;
}
```

**After (KISS + guard clause)**

```ts
function getTotal(items) {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, it) => sum + (it.price || 0), 0);
}
```

- No new files, same name, same signature, clearer & smaller.

---

## "Do / Don't" Quick Rules

**Do**

- Keep changes local.
- Use existing helpers and error patterns.
- Write short, obvious code.
- Run `npx nx affected -t lint test build` to verify changes.

**Don't**

- Rename broadly.
- Add new dependencies/config.
- Create new architectural layers.
- Use `any` — use `unknown` and narrow.

---

## Internal Planning & Tickets

For feature planning and TODO tracking, use the local-only internal tickets directory:

- **Location:** `.github/INTERNAL-TICKETS/`
- **Purpose:** Track feature ideas, implementation plans, and technical debt
- **Format:** Markdown files with descriptive names (e.g., `forms-engine-schema.md`)
- **Status:** Gitignored (local only, never committed)
- **Usage:**
  - Document incomplete/planned features before implementation
  - Capture implementation details, checklists, and considerations
  - Reference related files and existing code patterns
  - Include success criteria and testing requirements

**Rewrite Roadmap** (`.github/INTERNAL-TICKETS/rewrite-roadmap.md`):
- This is the master QB → mSheet migration tracker. **Update it whenever implementation work changes the status of a tracked feature** (e.g., a field component is completed, a phase moves from 🔴 to ✅).
- After completing a task that corresponds to an item in the roadmap, mark it done and update the progress summary percentages.
- Keep the "Feature Parity Tracker" table and per-package progress summary current so the roadmap always reflects reality.

**@mieweb/ui Capability Audit** (`.github/INTERNAL-TICKETS/mieweb-ui-capability-audit.md`):
- This is the source-of-truth snapshot for @mieweb/ui exports, `*Props` interfaces, and key variant names.
- When using or refactoring @mieweb/ui components in mSheet, consult this ticket before choosing `variant`, `size`, or component-specific props.
- If @mieweb/ui changes materially (new components, variant changes, prop changes), regenerate/update this audit ticket first, then implement mSheet changes.

**Ticket Template:**

```markdown
# Feature Name

## Status

🔴 Not Implemented / 🟡 In Progress / 🟢 Completed

## Priority

High / Medium / Low

## Problem Statement

[What problem does this solve?]

## Proposed Solution

[Implementation approach with code examples]

## Implementation Checklist

- [ ] Task 1
- [ ] Task 2

## Technical Considerations

[Edge cases, compatibility, performance]

## Success Criteria

[How do we know it's done?]

## Related Files

[List of files that need changes]
```

---

## Review Snippet (commit message footer)

```
KISS/DRY/YAGNI: yes
Minimal diff: yes (N lines, M files)
Naming/structure preserved: yes
No new deps/files: yes
Tests/docs touched minimally: yes
```

