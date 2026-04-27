# @esheet/ai-gateway

AI-powered form schema generation for eSheet using structured AI outputs.

## Features

- **Provider-agnostic** - `ESheetAIProvider` interface supports any AI backend
- **OpenAI adapter** - First-party support for OpenAI Structured Outputs
- **Validated output** - Generated schemas are Zod-validated against `formDefinitionSchema`
- **Auto-repair** - Optional one-shot repair when validation fails
- **Type-safe** - Full TypeScript support

## Installation

```bash
npm install @esheet/ai-gateway
```

For OpenAI support, also install the peer dependency:

```bash
npm install openai
```

## Usage

### Basic Generation

```typescript
import { generateESheetForm, OpenAIProvider } from '@esheet/ai-gateway';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini', // optional, this is the default
});

const result = await generateESheetForm({
  prompt: 'Create a patient intake form with name, DOB, and symptoms',
  provider,
  repair: true, // attempt repair if validation fails
});

console.log(result.form);
// { id: 'patient-intake', fields: [...] }
console.log(result.repaired);
// false (or true if repair was needed)
```

### Error Handling

```typescript
import {
  generateESheetForm,
  OpenAIProvider,
  ESheetAIGenerationError,
} from '@esheet/ai-gateway';

try {
  const result = await generateESheetForm({
    prompt: 'Create a complex form',
    provider: new OpenAIProvider({ apiKey: '...' }),
    repair: true,
  });
} catch (error) {
  if (error instanceof ESheetAIGenerationError) {
    console.error('Validation errors:', error.validationErrors);
    console.error('Invalid schema:', error.invalidSchema);
    console.error('Repair attempted:', error.repairAttempted);
  }
}
```

### Custom Provider

Implement `ESheetAIProvider` to support other AI backends:

```typescript
import type { ESheetAIProvider, GenerateFormInput } from '@esheet/ai-gateway';

class AnthropicProvider implements ESheetAIProvider {
  async generateStructuredForm(input: GenerateFormInput): Promise<unknown> {
    // Call Anthropic API with input.prompt, input.schema, etc.
    // Return the parsed JSON response
  }
}

const result = await generateESheetForm({
  prompt: 'Create a survey',
  provider: new AnthropicProvider(),
});
```

## API

### `generateESheetForm(options)`

Main entry point for form generation.

**Options:**

- `prompt` - Natural language description of the form
- `provider` - `ESheetAIProvider` instance
- `model?` - Model identifier (provider-specific)
- `repair?` - If true, attempt one repair pass on validation failure
- `systemPrompt?` - Custom system prompt override

**Returns:** `Promise<GenerateESheetFormResult>`

- `form` - The validated `FormDefinition`
- `repaired` - Whether repair was needed

### `OpenAIProvider`

OpenAI implementation of `ESheetAIProvider`.

**Config:**

- `apiKey` - OpenAI API key
- `model?` - Model to use (default: 'gpt-4o-mini')
- `organization?` - OpenAI organization ID
- `baseURL?` - Custom API endpoint

### `ESheetAIGenerationError`

Thrown when generation fails validation.

**Properties:**

- `validationErrors` - Array of validation error strings
- `invalidSchema` - The schema that failed validation
- `repairAttempted` - Whether repair was tried

## Architecture

```
User Prompt
    ↓
provider.generateStructuredForm()
    ↓
formDefinitionSchema.safeParse()
    ↓
┌─────────┐
│ Valid?  │──yes──→ Return FormDefinition
└────┬────┘
     │ no
     ↓
┌─────────────┐
│ repair=true │──no──→ Throw ESheetAIGenerationError
└──────┬──────┘
       │ yes
       ↓
repairESheetForm()
       ↓
┌─────────┐
│ Valid?  │──yes──→ Return FormDefinition (repaired: true)
└────┬────┘
     │ no
     ↓
Throw ESheetAIGenerationError
```
