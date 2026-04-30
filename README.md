# eSheet

**Modular form builder & renderer for React.**

eSheet is a TypeScript-first Nx monorepo providing composable packages for embedding a visual form builder and renderer into any React application — no lock-in, no required backend.

- **[Live Demo](https://esheet-demo.os.mieweb.org/)** — builder + renderer playground
- **[Documentation](https://esheet-docs.os.mieweb.org)** — full API & usage docs

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

This workspace uses [Nx](https://nx.dev). All tasks run through Nx — do not invoke `tsc`, `vite`, or `vitest` directly.

### Prerequisites

- Node.js ≥ 20
- npm workspaces (builtin)

### Install

```bash
npm install
```

### Common tasks

```bash
# Build all packages
npx nx run-many -t build

# Run tests across all packages
npx nx run-many -t test

# Lint all projects
npx nx run-many -t lint

# Type-check all projects
npx nx run-many -t typecheck

# Serve the demo app locally
npx nx serve demo

# Run only tasks affected by your changes
npx nx affected -t lint,test,build
```

### Build a single package

```bash
# Build a single package
npx nx build @esheet/core
npx nx build @esheet/builder
```

### Test your changes against GitHub Actions workflows locally

Before committing, test your changes locally using `gh act`. This validates formatting, linting, tests, and (optionally) deployment.

Quick commands:

```bash
# Test CI workflow (lint, test, build, typecheck)
gh act push -W .github/workflows/ci.yml --pull=false

# Test release workflow (all checks + dry-run release — does not publish)
gh act push -W .github/workflows/release.yml --pull=false

# Test PR title validation
printf '{"pull_request":{"title":"fix(core): my change","number":1}}\n' > /tmp/pr-event.json
gh act pull_request -e /tmp/pr-event.json -W .github/workflows/pr-title-check.yml --pull=false
```

For full setup instructions, deploy testing against a local Docker container, and troubleshooting, see [.github/workflows/TESTING-LOCALLY.md](.github/workflows/TESTING-LOCALLY.md).

### Run the demo app

```bash
npx nx serve demo
# → http://localhost:4200
```

### Run the docs site

```bash
npx nx serve docs
# → http://localhost:3000
```

### Run docs and demo together

```bash
npx nx run-many -t dev -p app-*
# Demo → http://localhost:4200
# Docs → http://localhost:3000
```

This runs both local dev servers at the same time in one terminal. Use Ctrl+C to stop both.

### Production Static Deploy (Nginx)

```bash
chmod +x deploy/scripts/manual/setup-nginx.sh
./deploy/scripts/manual/setup-nginx.sh

chmod +x deploy/scripts/workflow/atomic-deploy.sh
./deploy/scripts/workflow/atomic-deploy.sh
```

- Nginx config in repo: `deploy/nginx/default.conf`
- Deploy script in repo: `deploy/scripts/workflow/atomic-deploy.sh`
- Setup helper in repo: `deploy/scripts/manual/setup-nginx.sh`
- Runbook in repo: `deploy/RUNBOOK-nginx-atomic.md`

---

## Releasing

Packages are versioned together using [`nx release`](https://nx.dev/features/manage-releases) with [conventional commits](https://www.conventionalcommits.org/).

| Commit prefix                  | Version bump |
| ------------------------------ | ------------ |
| `fix:`                         | patch        |
| `feat:`                        | minor        |
| `feat!:` or `BREAKING CHANGE:` | major        |

```bash
# Preview what would change (no files written)
npx nx release --dry-run

# First-ever release (before any git tag exists)
npx nx release --first-release

# Subsequent releases (bump auto-determined from commits since last tag)
npx nx release
```

A GitHub Release and `CHANGELOG.md` are generated automatically. Set `GITHUB_TOKEN` in your environment before running `nx release` to enable GitHub Release creation.

---

## Contributing

1. Fork and clone the repo
2. `npm install`
3. Create a branch: `git checkout -b feat/my-feature`
4. Make changes — run `npx nx affected -t lint,test,build` before committing
5. Use [conventional commits](https://www.conventionalcommits.org/) in your commit messages
6. Open a pull request

---

## License

MIT © [MIE](https://github.com/mieweb)
