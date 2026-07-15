# Cloudflare Pages Deployment

Cloudflare Pages serves the documentation and demo from one static deployment:

- `/` serves the Docusaurus documentation site.
- `/demo/` serves the Vite demo application.

This matches the URL layout used by the Nginx atomic deployment.

## Pages project settings

Configure the Cloudflare Pages project from the repository root with these settings:

| Setting                | Value              |
| ---------------------- | ------------------ |
| Build command          | `npm run build:cf` |
| Build output directory | `dist`             |
| Root directory         | Repository root    |

The Cloudflare build script defaults the Docusaurus canonical site origin to the Cloudflare custom domain. You can set `ESHEET_SITE_ORIGIN` explicitly to the same value, without a trailing slash:

```txt
ESHEET_SITE_ORIGIN=https://esheet.mieweb.org
```

The atomic OS deployment has its own canonical-origin default, `https://esheet.os.mieweb.org`, and can override it through the GitHub Actions `ESHEET_SITE_ORIGIN` environment secret.

For non-`main` Cloudflare deployments, documentation-to-demo navigation uses Cloudflare's injected `CF_PAGES_URL`. This produces links on the deployment's unique hashed `*.pages.dev` hostname. Production Cloudflare and atomic deployments continue using their configured `ESHEET_SITE_ORIGIN` values.

Attach the production custom domain to the Pages project in Cloudflare. A DNS record by itself does not associate the domain with the Pages project.

## Build output

`npm run build:cf` runs `deploy/scripts/cf-build.sh`, which builds both Nx applications and merges their static output into `dist/`:

```txt
dist/
├── index.html
├── _redirects
├── assets/
└── demo/
    ├── index.html
    └── assets/
```

The generated `_redirects` file normalizes the demo root and provides SPA fallbacks for both applications:

```txt
/demo     /demo/            301
/demo/*   /demo/index.html  200
/*        /index.html       200
```

Keep the demo rules before the documentation fallback so nested demo routes resolve to the demo application.

## Verify a deployment

After deploying, verify these URLs in the browser and with direct page requests:

- `/` loads the documentation site.
- `/docs/intro` loads and refreshes without a 404.
- `/demo` redirects to `/demo/`.
- `/demo/` loads the demo landing page.
- The landing cards navigate to `/demo/builder` and `/demo/renderer`.
- `/demo/builder` and `/demo/renderer` load and refresh without a 404.
- Documentation links labeled Demo or Live Demo open `/demo/` on the same origin.
- On a Cloudflare preview deployment, documentation links stay on that preview's `*.pages.dev` hostname.

If the Pages deployment does not contain `dist/index.html`, `dist/demo/index.html`, and `dist/_redirects`, confirm that the project uses the build command and output directory shown above.
