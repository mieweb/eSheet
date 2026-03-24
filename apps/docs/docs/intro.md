---
sidebar_position: 1
slug: /intro
---

# Welcome to eSheet

**eSheet** is a modular, extensible form builder and renderer for React applications. It provides a complete solution for creating, editing, and filling out questionnaire-style forms - from simple contact forms to complex conditional surveys.

## 📦 Package Overview

eSheet is organized as four focused, composable packages:

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
- JSON/YAML code view for direct editing

### 📋 @esheet/renderer

Lightweight form renderer for end-users. Perfect for surveys, questionnaires, and data collection:

- Form fill-out mode with real-time validation
- Conditional logic evaluation and field visibility control
- Response collection via API
- Pre-fill support for partial responses

## 🚀 Quick Start

Choose your starting point based on your needs:

- [Rendering forms](./getting-started/quickstart-renderer) — Start here if you want to display forms to users
- [Building form editors](./getting-started/quickstart-builder) — Start here if you want to create tools for building forms

## ✨ Key Features

✅ **19 field types** — text (9 input variants), selection, matrix, rating, ranking, signature, diagram, display (with expression interpolation), and more  
✅ **Conditional logic** — show/hide fields, enable/disable, make required based on other field values or custom expressions  
✅ **Expression system** — reference field values with `{fieldId}` syntax, compute expressions with `<{a} + {b}>`  
✅ **Drag-and-drop** — reorder fields, nest into sections, rank options  
✅ **Three editor modes** — visual build, JSON/YAML code editing, live preview  
✅ **Type-safe** — full TypeScript support with Zod validation  
✅ **Extensible** — register custom field types with your own React components  
✅ **Responsive** — mobile-friendly layouts with bottom-sheet editing on small screens  
✅ **Accessible** — all inputs have IDs, labels, and ARIA attributes  

## 📥 Installation

Choose the packages you need:

### For rendering forms

```bash
npm install @esheet/core @esheet/fields @esheet/renderer
```

### For building form editors

```bash
npm install @esheet/core @esheet/fields @esheet/builder
```

### For full control with custom components

```bash
npm install @esheet/core @esheet/fields
```

**Note:** React 18+ is required for `@esheet/fields`, `@esheet/builder`, and `@esheet/renderer`.

## 🔗 Next Steps

- 📚 [Installation Guide](./getting-started/installation)
- 🚀 [Renderer Quick Start](./getting-started/quickstart-renderer)
- ✏️ [Builder Quick Start](./getting-started/quickstart-builder)
- 📋 [Schema Format](./schema-format)
- 🧩 [Field Types](./field-types)
- 🔀 [Conditional Logic](./conditional-logic)
