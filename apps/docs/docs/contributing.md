---
sidebar_position: 21
---

# Contributing

Guide to developing and contributing to the eSheet monorepo.

## 🤝 Repository Structure

```
mSheet/
|- apps/
|  |- demo/          # Vite demo app (builder + renderer)
|  `- docs/          # Docusaurus documentation site
|- packages/
|  |- core/          # @esheet/core - types, stores, logic (vanilla TS)
|  |- fields/        # @esheet/fields - 19 field components (React)
|  |- builder/       # @esheet/builder - visual form editor (React)
|  `- renderer/      # @esheet/renderer - form fill-out (React)
|- nx.json
|- tsconfig.base.json
`- package.json
```

## 🔗 Dependency Graph

```
@esheet/core  (no React dependency)
    ^
@esheet/fields  (depends on core)
    ^
@esheet/builder  (depends on core + fields)
@esheet/renderer  (depends on core + fields)
```

## 🚀 Development Workflow

### Prerequisites

- Node.js 20+
- npm (workspace-aware)

### Install

```bash
npm install
```

### Run the Demo App

```bash
npx nx serve demo
```

### Run the Docs Site

```bash
npx nx serve docs
```

### Build All Packages

```bash
npx nx run-many -t build
```

### Run Tests

```bash
npx nx run-many -t test
```

### Lint

```bash
npx nx run-many -t lint
```

### Run Affected (CI-friendly)

Only build/test/lint projects affected by your changes:

```bash
npx nx affected -t lint test build
```

## 📐 Code Style

- **TypeScript strict mode** - no `any` unless unavoidable. Prefer `unknown` + narrowing.
- **`nodenext` module resolution** - use `.js` extensions in relative imports
- **No enums** - use `as const` objects or string literal unions
- **`readonly` where appropriate** - for immutable parameters and data
- **Interfaces over type aliases** - for object shapes (unless union/intersection needed)
- **Early returns** over nested conditionals
- **Keep functions short** - under ~40 lines when possible

## 📚 Docs Style

- Keep docs clear, technical, and concise.
- Use emoji sparingly for wayfinding in major headings only.
- Avoid dense or decorative emoji usage in body text.
- Prefer consistency: if one page uses heading emojis, keep them subtle and section-scoped.

## 🧪 Testing

- Tests use **Vitest** with `globals: true` (no need to import `describe`/`it`/`expect`)
- Test files live next to source: `foo.ts` -> `foo.spec.ts`
- Run specific package tests: `npx nx test core`

## 🛠️ Nx Commands

All tasks should be run through Nx:

| Command | Description |
|---|---|
| `npx nx serve demo` | Start demo app dev server |
| `npx nx serve docs` | Start docs dev server |
| `npx nx run-many -t build` | Build all packages |
| `npx nx run-many -t test` | Run all tests |
| `npx nx run-many -t lint` | Lint all packages |
| `npx nx affected -t build test lint` | Run affected targets |
| `npx nx show project <name> --json` | Show project configuration |
| `npx nx graph` | Visualize dependency graph |
