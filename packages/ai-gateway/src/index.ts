// Types
export type {
  ESheetAIProvider,
  GenerateFormInput,
  GenerateESheetFormOptions,
  GenerateESheetFormResult,
  RepairFormInput,
} from './lib/types.js';

// Re-export OpenAI types used by chat features
export type {
  ChatCompletion,
  ChatCompletionTool,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';

// Main generation function
export { generateESheetForm } from './lib/generate-esheet-form.js';

// Repair function
export { repairESheetForm } from './lib/repair-esheet-form.js';

// Providers
export {
  OpenAIProvider,
  type OpenAIProviderConfig,
} from './lib/providers/openai-provider.js';

export {
  OzwellProvider,
  type OzwellProviderConfig,
} from './lib/providers/ozwell-provider.js';

// Errors
export { ESheetAIGenerationError } from './lib/errors.js';

// Prompts (for customization)
export { DEFAULT_SYSTEM_PROMPT, REPAIR_SYSTEM_PROMPT } from './lib/prompts.js';
