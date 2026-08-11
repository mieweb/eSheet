# eSheet

**Modular form builder & renderer for React.**

[![CI](https://github.com/mieweb/eSheet/actions/workflows/ci.yml/badge.svg)](https://github.com/mieweb/eSheet/actions/workflows/ci.yml)
[![Release](https://github.com/mieweb/eSheet/actions/workflows/release.yml/badge.svg)](https://github.com/mieweb/eSheet/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/@esheet/core?label=npm)](https://www.npmjs.com/package/@esheet/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=061b23)](https://react.dev/)

eSheet is a TypeScript-first pnpm workspace providing composable packages for embedding a visual form builder and renderer into any React application — no lock-in, no required backend.

- **[Live Demo](https://esheet.mieweb.org/demo/)** — builder + renderer playground
- **[Documentation](https://esheet.mieweb.org/)** — full API & usage docs

---

## Packages

| Package                                                       | Description                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`@esheet/core`](packages/core)                               | Zod schemas, Zustand stores, conditional logic engine — no React                         |
| [`@esheet/fields`](packages/fields)                           | 19 built-in field components (text, choice, scale, matrix, rich, layout)                 |
| [`@esheet/builder`](packages/builder)                         | Drag-and-drop visual form builder (`<EsheetBuilder />`)                                  |
| [`@esheet/renderer`](packages/renderer)                       | Read-only React form renderer (`<EsheetRenderer />`) with auto-detection of SurveyJS/MCP |
| [`@esheet/adapters`](packages/adapters)                       | SurveyJS ↔ eSheet converters, MCP import/export, AI system prompt                        |
| [`@esheet/renderer-standalone`](packages/renderer-standalone) | Standalone mount API and global registration                                             |
| [`@esheet/renderer-blaze`](packages/renderer-blaze)           | Meteor Blaze template integration                                                        |

All packages are versioned together and published to npm under the `@esheet` scope.

---

## Quick Start

```bash
# Builder (includes fields + core as peer deps)
npm install @esheet/builder

# Renderer only
npm install @esheet/renderer

# Optional integrations
npm install @esheet/renderer-standalone
npm install @esheet/renderer-blaze
```

```tsx
import { EsheetBuilder } from '@esheet/builder';
import '@esheet/builder/dist/index.css';

function App() {
  const [definition, setDefinition] = useState(emptyForm);
  return <EsheetBuilder definition={definition} onChange={setDefinition} />;
}
```

```tsx
import { EsheetRenderer, EsheetRendererHandle } from '@esheet/renderer';

function App() {
  const rendererRef = useRef<EsheetRendererHandle>(null);
  return (
    <>
      <EsheetRenderer formDataInput={definition} ref={rendererRef} />
      <button onClick={() => console.log(rendererRef.current?.getResponse())}>
        Submit
      </button>
    </>
  );
}
```

---

## Monorepo Structure

```
mSheet/
├── packages/
│   ├── core/        # @esheet/core     — types, stores, logic (no React)
│   ├── fields/      # @esheet/fields   — 19 field components
│   ├── builder/     # @esheet/builder  — visual builder UI
│   ├── renderer/    # @esheet/renderer — form renderer (auto-detects SurveyJS/MCP)
│   ├── adapters/    # @esheet/adapters — SurveyJS/MCP converters, AI prompt
│   ├── renderer-standalone/ # @esheet/renderer-standalone — standalone integration
│   └── renderer-blaze/ # @esheet/renderer-blaze — blaze integration
└── apps/
    ├── demo/        # Vite playground (builder + renderer routes)
    └── docs/        # Docusaurus documentation site
```

### Package dependency graph

```
@esheet/core
    ↑
@esheet/fields       @esheet/adapters
  ↑           ↑           ↑
@esheet/builder  @esheet/renderer
         ↑                 ↑
   @esheet/renderer-standalone   @esheet/renderer-blaze
```

---

## Development

This repository uses pnpm workspaces with explicit package scripts.

### Prerequisites

- Node.js ≥ 20
- Corepack

### Install

```bash
corepack enable
pnpm install
```

### Common tasks

```bash
# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Lint all projects
pnpm lint

# Type-check all projects
pnpm typecheck

# Serve the demo app locally
pnpm dev:demo

# Check formatting
pnpm format:check
```

### Build a single package

```bash
# Build a single package
pnpm --filter @esheet/core build
pnpm --filter @esheet/builder build
```

### Test your changes against GitHub Actions workflows locally

Before committing, test your changes locally using `gh act`. This validates formatting, linting, tests, builds, typechecks, and release dry-runs.

Quick commands:

```bash
# Test CI workflow (format, lint, test, build, typecheck)
gh act pull_request -W .github/workflows/ci.yml --pull=false

# Test release workflow (dry-run release — does not publish)
gh act workflow_dispatch -W .github/workflows/release.yml -e release/act-dry-run-event.json --pull=false

# Test PR title validation
printf '{"pull_request":{"title":"fix(core): my change","number":1}}\n' > /tmp/pr-event.json
gh act pull_request -e /tmp/pr-event.json -W .github/workflows/pr-title-check.yml --pull=false
```

For full setup instructions and troubleshooting, see [.github/workflows/TESTING-LOCALLY.md](.github/workflows/TESTING-LOCALLY.md).

### Run the demo app

```bash
pnpm dev:demo
# → http://localhost:5173
```

### Run the docs site

```bash
pnpm dev:docs
# → http://localhost:3000
```

### Run docs and demo together

```bash
pnpm --parallel --filter @esheet/demo --filter esheet-docs dev
# Demo → http://localhost:5173
# Docs → http://localhost:3000
```

This runs both local dev servers at the same time in one terminal. Use Ctrl+C to stop both.

### Production Static Deploy (Cloudflare Pages)

Cloudflare Pages publishes the combined documentation and demo layout:

- Documentation at `/`
- Demo at `/demo/`

Use `pnpm build:cf` as the build command and `dist` as the output directory. See [the Cloudflare Pages runbook](deploy/RUNBOOK-cloudflare-pages.md) for the complete project settings, environment variables, routing behavior, and verification steps.

---

## Releasing

Packages are versioned together by the custom release script using conventional commits.

| Commit prefix                  | Version bump |
| ------------------------------ | ------------ |
| `fix:`                         | patch        |
| `feat:`                        | minor        |
| `feat!:` or `BREAKING CHANGE:` | major        |

```bash
# Preview what would change (no files written)
node release/release.mjs --dry-run

# First-ever release (before any git tag exists)
node release/release.mjs --dry-run --bump=patch

# Subsequent releases (bump auto-determined from commits since last tag)
node release/release.mjs --bump=patch
```

A GitHub Release and `CHANGELOG.md` are generated automatically. Set `GITHUB_TOKEN` in your environment before running a full release.

---

## Contributing

1. Fork and clone the repo
2. `corepack enable && pnpm install`
3. Create a branch: `git checkout -b feat/my-feature`
4. Make changes — run `pnpm lint && pnpm test && pnpm typecheck && pnpm build` before committing
5. Use [conventional commits](https://www.conventionalcommits.org/) in your commit messages
6. Open a pull request

---

## License

MIT © [MIE](https://github.com/mieweb)
