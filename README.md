# eSheet

<img width="900" height="674" alt="eSheet builder screenshot" src="https://github.com/user-attachments/assets/67c3f422-e3df-4fa4-9110-d7046b17ff6e" />

**Modular form builder & renderer for React.**

eSheet is a TypeScript-first Nx monorepo providing composable packages for embedding a visual form builder and renderer into any React application — no lock-in, no required backend.

- **[Live Demo](https://esheet-demo.os.mieweb.org/)** — builder + renderer playground
- **[Documentation](https://esheet-docs.os.mieweb.org)** — full API & usage docs

---

## Packages

| Package                                                       | Description                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`@esheet/core`](packages/core)                               | Zod schemas, Zustand stores, conditional logic engine — no React         |
| [`@esheet/fields`](packages/fields)                           | 19 built-in field components (text, choice, scale, matrix, rich, layout) |
| [`@esheet/builder`](packages/builder)                         | Drag-and-drop visual form builder (`<EsheetBuilder />`)                  |
| [`@esheet/renderer`](packages/renderer)                       | Read-only React form renderer (`<EsheetRenderer />`)                     |
| [`@esheet/renderer-standalone`](packages/renderer-standalone) | Standalone mount API and global registration                             |
| [`@esheet/renderer-blaze`](packages/renderer-blaze)           | Meteor Blaze template integration                                        |

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
      <EsheetRenderer formData={definition} ref={rendererRef} />
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
│   ├── renderer/    # @esheet/renderer — form renderer
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
@esheet/fields
  ↑           ↑
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
npx nx build @esheet/core
npx nx build @esheet/builder
```

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

### Production Static Deploy (Nginx)

```bash
chmod +x deploy/scripts/setup-nginx.sh
./deploy/scripts/setup-nginx.sh

chmod +x deploy/scripts/deploy-static.sh
./deploy/scripts/deploy-static.sh
```

- Nginx config in repo: `deploy/nginx/default.conf`
- Deploy script in repo: `deploy/scripts/deploy-static.sh`
- Setup helper in repo: `deploy/scripts/setup-nginx.sh`
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
