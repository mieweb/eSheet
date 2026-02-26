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
