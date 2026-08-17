---
sidebar_position: 1
slug: /intro
---

# Welcome to eSheet

**eSheet** is a modular, extensible form builder and renderer toolkit. It provides a complete solution for creating, editing, and filling out questionnaire-style forms - from simple contact forms to complex conditional surveys.

## 📦 Package Overview

eSheet is organized as eight focused, composable packages:

### ⚙️ @esheet/core

Pure TypeScript foundation with no React dependency. The backbone of eSheet:

- Types and Zod schemas for form definitions
- Zustand-based state management
- Conditional logic engine for dynamic form behavior
- Built-in validation system
- Pluggable field type registry

### 🎨 @esheet/fields

Reusable React component library with pre-built field types:

- 19 built-in field types (text variants, radio, matrix, signature, diagram, and more)
- Custom controls (radio buttons, checkboxes, dropdowns)
- Drawing pad for signature and diagram fields
- Pluggable component registry for custom fields

### ✏️ @esheet/builder

Visual form builder for creating and editing forms. Perfect for admin/creator interfaces:

- Drag-and-drop canvas for field arrangement
- Field toolbox for quick field insertion
- Property inspector for field configuration
- Conditional logic rule builder
- YAML-first JSON/YAML code view for direct editing

### 📋 @esheet/renderer

Lightweight form renderer for end-users. Perfect for surveys, questionnaires, and data collection:

- Form fill-out mode with real-time validation
- Conditional logic evaluation and field visibility control
- Response collection via API
- Pre-fill support for partial responses

### 🔌 @esheet/adapters

Schema conversion utilities for interoperability with external systems:

- Import/export SurveyJS schemas
- Import/export MCP (Model Context Protocol) elicitation requests
- System prompts for AI-assisted conversions
- Auto-detection of schema formats

### 🧩 @esheet/renderer-standalone

Renderer mount API for non-React hosts:

- Mounts `@esheet/renderer` into a DOM node
- Returns a handle with `getResponse`, `getValidResponse`, and `unmount`
- Good fit for plain JavaScript apps or progressive enhancement

### 🔥 @esheet/renderer-blaze

Meteor Blaze integration layer:

- Registers a Blaze template around the same renderer core
- Exposes response helpers on the Blaze template instance
- Supports default and custom template names

### ✍️ @esheet/field-kerebron

Optional rich text editor field:

- Adds a `richtext` field type backed by the Kerebron editor
- Requires one-time asset configuration with `configureRichTextField()`
- Install only when your form needs rich text authoring

## 🚀 Quick Start

Choose your starting point based on your needs:

- [Render a form](./getting-started/quickstart-renderer) — Display forms and collect responses
- [Build a form editor](./getting-started/quickstart-builder) — Create a visual form authoring UI
- [Standalone renderer](./getting-started/quickstart-standalone) — Mount renderer in non-React apps
- [Blaze renderer](./getting-started/quickstart-blaze) — Use renderer in Meteor Blaze

## ✨ Key Features

✅ **19 field types** — text (9 input variants), selection, matrix, rating, ranking, signature, diagram, display (with expression interpolation), and more  
✅ **Conditional logic** — show/hide fields, enable/disable, make required based on other field values or custom expressions  
✅ **Expression system** — reference field values with `{fieldId}` syntax, compute expressions with `<{a} + {b}>`  
✅ **Drag-and-drop** — reorder fields, nest into sections, rank options  
✅ **Three editor modes** — visual build, YAML-first JSON/YAML code editing, live preview
✅ **Type-safe** — full TypeScript support with Zod validation  
✅ **Extensible** — register custom field types with your own React components  
✅ **Responsive** — mobile-friendly layouts with bottom-sheet editing on small screens  
✅ **Accessible** — all inputs have IDs, labels, and ARIA attributes

## 📥 Installation

Choose the scenario that matches your app:

| Scenario                 | Minimal install command                                        | Add these only if needed                                                                                |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| React renderer           | `npm install @esheet/renderer react react-dom`                 | `@esheet/core` for direct core imports/types; `@esheet/fields` for custom field component registry work |
| React builder + renderer | `npm install @esheet/builder @esheet/renderer react react-dom` | `@esheet/core` only for direct core APIs/types                                                          |
| Standalone renderer      | `npm install @esheet/renderer-standalone`                      | `@esheet/core` only if importing core types/APIs directly in host app code                              |
| Blaze renderer           | `npm install @esheet/renderer-blaze`                           | `@esheet/core` only if importing core types/APIs directly in host app code                              |
| Schema adapters          | `npm install @esheet/adapters`                                 | `@esheet/core` only if importing core types directly; typically used with renderer or builder           |
| Rich text field          | `npm install @esheet/field-kerebron`                           | Used alongside `@esheet/builder` or `@esheet/renderer`; requires `configureRichTextField()` at startup  |

`@esheet/renderer` and `@esheet/builder` include `@esheet/core` and `@esheet/fields` transitively — no need to install them separately for normal usage. Install them directly only when your app imports them directly.

`@esheet/core` is framework-agnostic. `@esheet/renderer-standalone` and `@esheet/renderer-blaze` include React transitively.

## 🔗 Next Steps

- 📚 [Installation Guide](./getting-started/installation)
- 🚀 [Renderer Quick Start](./getting-started/quickstart-renderer)
- ✏️ [Builder Quick Start](./getting-started/quickstart-builder)
- 🧩 [Standalone Quick Start](./getting-started/quickstart-standalone)
- 🔥 [Blaze Quick Start](./getting-started/quickstart-blaze)
- ✍️ [kerebron](./field-types/custom/kerebron)
- 🔌 [Schema Adapters](./adapters/overview)
- 📋 [Schema Format](./schema-format)
- 🧩 [Field Types](./field-types)
- 🔀 [Conditional Logic](./conditional-logic)
