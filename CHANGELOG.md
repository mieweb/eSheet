## 0.0.6 (2026-08-12)

### 🚀 Features

- **fields:** redesign selection controls and dropdown behavior ([#150](https://github.com/mieweb/eSheet/pull/150))

## 0.0.5 (2026-08-10)

### 🚀 Features

- **renderer:** add configurable page navigation ([#142](https://github.com/mieweb/eSheet/pull/142))
- **core:** add field layout defaults and section width inheritance ([#133](https://github.com/mieweb/eSheet/pull/133))
- **fields:** add configurable date and datetime input support ([#123](https://github.com/mieweb/eSheet/pull/123))
- **field-health:** add health field pack with codify codelookup ([#118](https://github.com/mieweb/eSheet/pull/118))
- **renderer:** optional host-supplied collab decorations (presence + proposals) ([#106](https://github.com/mieweb/eSheet/pull/106))
- **fields:** new field pages ([#102](https://github.com/mieweb/eSheet/pull/102))
- **builder:** add collapsible option to sections ([#101](https://github.com/mieweb/eSheet/pull/101))
- **builder:** preview layout controls — per-field column width, stack/wrap options, responsive stacking ([#89](https://github.com/mieweb/eSheet/pull/89))
- **fields:** adds new features for FHIR Support capability + Minor Enhancements ([#88](https://github.com/mieweb/eSheet/pull/88))
- **core:** expression functions (date arithmetic) + action field _ Revert #74 That was merged to main ([#81](https://github.com/mieweb/eSheet/pull/81))
- **core:** add calculated fields and gated JavaScript evaluation ([#73](https://github.com/mieweb/eSheet/pull/73))
- **fields:** add Kerebron rich text field ([#66](https://github.com/mieweb/eSheet/pull/66))
- **repo:** move MCP tools to agent config and add scoring ([#63](https://github.com/mieweb/eSheet/pull/63))
- **adapters:** add FHIR adapter support ([#58](https://github.com/mieweb/eSheet/pull/58))
- **repo:** add shared touch mode support ([#57](https://github.com/mieweb/eSheet/pull/57))
- **builder:** add mobile touch mode with toggle switch ([#55](https://github.com/mieweb/eSheet/pull/55))
- **docs:** fixes svg & expiry token for ozwellAPI ([#50](https://github.com/mieweb/eSheet/pull/50))
- **docs:** add Ozwell setup flow and generated docs search index ([#49](https://github.com/mieweb/eSheet/pull/49))
- **repo:** add MCP tool bridge and migrate UI components ([#46](https://github.com/mieweb/eSheet/pull/46))

### 🐛 Bug Fixes

- **core:** prevent duplicate instance IDs across package bundles ([#121](https://github.com/mieweb/eSheet/pull/121))
- **field-kerebron:** Fix Kerebron/wasm asset not resolving -- Upgrade to 0.8.6 ([#112](https://github.com/mieweb/eSheet/pull/112))
- **repo:** align Cloudflare Pages output routing for docs and demo ([#107](https://github.com/mieweb/eSheet/pull/107))
- **core:** accept registered custom field types in formDefinitionSchema ([#91](https://github.com/mieweb/eSheet/pull/91))
- **repo:** npm ci ERESOLVE from prerelease peer dependency conflict ([#100](https://github.com/mieweb/eSheet/pull/100))
- **repo:** preserve falsey setValue results and improve form accessibility ([#97](https://github.com/mieweb/eSheet/pull/97))
- **fields:** polish miscellaneous UI and interaction issues ([#52](https://github.com/mieweb/eSheet/pull/52))
- **renderer:** use --mieweb-font-sans token instead of hardcoded Titillium Web ([#39](https://github.com/mieweb/eSheet/pull/39))

### ✨ Enhancements

- **fields:** add configurable section icons, section design and nested width overrides ([#141](https://github.com/mieweb/eSheet/pull/141))
- **renderer:** support responsive field widths in rendered forms ([#111](https://github.com/mieweb/eSheet/pull/111))
- **fields:** update date picker to use mieweb/ui date picker ([#104](https://github.com/mieweb/eSheet/pull/104))

### ♻️ Refactoring

- **core:** Feat/expression functions and action field remove into separate branch ([#82](https://github.com/mieweb/eSheet/pull/82))

### 📚 Documentation

- **docs:** updates docs and add adapters section ([#51](https://github.com/mieweb/eSheet/pull/51))

## 0.0.3 (2026-05-19)

### 🚀 Features

- **repo:** migrate demo and field components to @mieweb/ui ([#26](https://github.com/mieweb/eSheet/pull/26))
- **adapters:** extract MCP to adapters and add multi-format renderer support ([#35](https://github.com/mieweb/eSheet/pull/35))

### 🐛 Bug Fixes

- **repo:** WCAG AA contrast and accessibility fixes ([#36](https://github.com/mieweb/eSheet/pull/36))

## 0.0.2 (2026-04-27)

### 🚀 Features

- **renderer:** auto-detect MCP elicitation envelope in useRendererInit ([#32](https://github.com/mieweb/eSheet/pull/32))
- **core:** add MCP elicitation support and remove schemaType ([#31](https://github.com/mieweb/eSheet/pull/31))
- **core:** add visibility-aware submit flow and dry run preview ([#29](https://github.com/mieweb/eSheet/pull/29))

### 🐛 Bug Fixes

- **repo:** workspace package resolution for fields exports ([#34](https://github.com/mieweb/eSheet/pull/34))
- **release:** restore versions to 0.0.1, add repository url, prerelease uses --tag next
- **demo:** widen @esheet dep ranges to 0.x and fix lock file
- ci disable on direct push (danger)
- **demo:** resolve demo loading and stale cache behavior ([#27](https://github.com/mieweb/eSheet/pull/27))

### ✨ Enhancements

- **builder:** improve DnD behavior, layout consistency, and responsiveness ([#25](https://github.com/mieweb/eSheet/pull/25))

### 📚 Documentation

- **docs:** clarify PR title validation and simplify local deploy testing ([#24](https://github.com/mieweb/eSheet/pull/24))

## 0.0.1 (2026-03-27)

### 🚀 Features

- add rich fields, expression engine updates, and mobile builder UX ([e010cef](https://github.com/mieweb/eSheet/commit/e010cef))
- Initialize Nx-based versioning and publish pipeline ([#16](https://github.com/mieweb/eSheet/pull/16))
- **renderer:** complete renderer implementation and wire package builds ([1a623e6](https://github.com/mieweb/eSheet/commit/1a623e6))
