import {
  formDefinitionSchema,
  formDefinitionJSONSchema,
  type FormDefinition,
} from '@esheet/core';
import { ESheetAIGenerationError } from './errors.js';
import { DEFAULT_SYSTEM_PROMPT } from './prompts.js';
import { repairESheetForm } from './repair-esheet-form.js';
import type {
  GenerateESheetFormOptions,
  GenerateESheetFormResult,
} from './types.js';

/**
 * Format Zod validation errors into readable strings.
 */
function formatZodErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>
): string[] {
  return issues.map((issue) => {
    const path =
      issue.path.length > 0
        ? issue.path.map((p) => String(p)).join('.')
        : 'root';
    return `${path}: ${issue.message}`;
  });
}

/**
 * Generate a validated eSheet FormDefinition from natural language.
 *
 * Flow:
 * 1. Call provider.generateStructuredForm() with prompt and schema
 * 2. Validate result with formDefinitionSchema.safeParse()
 * 3. If invalid and repair=true, attempt one repair pass
 * 4. Return FormDefinition or throw ESheetAIGenerationError
 *
 * @example
 * ```ts
 * import { generateESheetForm, OpenAIProvider } from '@esheet/ai-gateway';
 *
 * const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! });
 * const result = await generateESheetForm({
 *   prompt: 'Create a patient intake form with name and date of birth',
 *   provider,
 *   repair: true,
 * });
 * console.log(result.form);
 * ```
 */
export async function generateESheetForm(
  options: GenerateESheetFormOptions
): Promise<GenerateESheetFormResult> {
  const { prompt, provider, model, repair = false, systemPrompt } = options;

  // Step 1: Generate schema from AI
  const rawResult = await provider.generateStructuredForm({
    prompt,
    schema: formDefinitionJSONSchema,
    systemPrompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    model,
  });

  // Step 2: Validate with Zod
  const parseResult = formDefinitionSchema.safeParse(rawResult);

  if (parseResult.success) {
    return {
      form: parseResult.data as FormDefinition,
      repaired: false,
    };
  }

  // Step 3: If validation failed and repair is enabled, try repair
  const validationErrors = formatZodErrors(parseResult.error.issues);

  if (repair) {
    const repairResult = await repairESheetForm({
      invalidSchema: rawResult,
      validationErrors,
      provider,
      model,
    });

    if (repairResult) {
      return {
        form: repairResult,
        repaired: true,
      };
    }
  }

  // Step 4: Throw error with validation details
  throw new ESheetAIGenerationError({
    message: `Generated schema failed validation: ${validationErrors.join(
      '; '
    )}`,
    validationErrors,
    invalidSchema: rawResult,
    repairAttempted: repair,
  });
}
