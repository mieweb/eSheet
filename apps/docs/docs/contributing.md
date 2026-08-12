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
|  |- renderer/      # @esheet/renderer - form fill-out (React)
|  |- renderer-standalone/ # @esheet/renderer-standalone - non-React mount API
|  `- renderer-blaze/ # @esheet/renderer-blaze - Meteor Blaze integration
|- pnpm-workspace.yaml
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
    ^
@esheet/renderer-standalone  (depends on renderer)
@esheet/renderer-blaze  (depends on renderer)
```

## 🚀 Development Workflow

### Prerequisites

- Node.js 20+
- Corepack

### Install

```bash
corepack enable
pnpm install
```

### Run the Demo App

```bash
pnpm dev:demo
```

### Run the Docs Site

```bash
pnpm dev:docs
```

### Build All Packages

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Lint

```bash
pnpm lint
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
- Run specific package tests: `pnpm --filter @esheet/core test`

## 🛠️ Workspace Commands

Workspace tasks are exposed through root scripts and package filters:

| Command                               | Description               |
| ------------------------------------- | ------------------------- |
| `pnpm dev:demo`                       | Start demo app dev server |
| `pnpm dev:docs`                       | Start docs dev server     |
| `pnpm build`                          | Build all packages        |
| `pnpm test`                           | Run all package tests     |
| `pnpm lint`                           | Lint all workspaces       |
| `pnpm --filter @esheet/core test`     | Test one package          |
| `pnpm --filter @esheet/demo... build` | Build an app and its deps |
