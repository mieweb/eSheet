# Custom

Use custom field types when built-in fields are not enough for your workflow.

## When To Use

- You need a domain-specific input or visualization.
- You need custom answer serialization.
- You need custom behavior in both builder and renderer.

## How To Implement

- Define metadata (label, category, answer type, and defaults).
- Provide the field component implementation.
- Register it with your builder and renderer setup.

## Available Custom Field Docs

- [kerebron](./custom/kerebron)

For the full registration API and examples, see:

- [Advanced: Custom Field Types](../advanced/custom-field-types)
