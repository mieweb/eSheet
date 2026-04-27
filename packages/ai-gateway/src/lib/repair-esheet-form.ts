import {
  formDefinitionSchema,
  formDefinitionJSONSchema,
  type FormDefinition,
} from '@esheet/core';
import { REPAIR_SYSTEM_PROMPT } from './prompts.js';
import type { RepairFormInput } from './types.js';

/**
 * Attempt to repair an invalid eSheet form schema.
 *
 * Sends the invalid schema and validation errors back to the AI
 * for a one-shot repair attempt.
 *
 * @returns The repaired FormDefinition if successful, or null if repair failed.
 */
export async function repairESheetForm(
  input: RepairFormInput
): Promise<FormDefinition | null> {
  const { invalidSchema, validationErrors, provider, model } = input;

  const repairPrompt = `The following schema is invalid:

\`\`\`json
${JSON.stringify(invalidSchema, null, 2)}
\`\`\`

Validation errors:
${validationErrors.map((e) => `- ${e}`).join('\n')}

Fix the schema and return only the corrected JSON.`;

  const repairResult = await provider.generateStructuredForm({
    prompt: repairPrompt,
    schema: formDefinitionJSONSchema,
    systemPrompt: REPAIR_SYSTEM_PROMPT,
    model,
  });

  const parseResult = formDefinitionSchema.safeParse(repairResult);

  if (parseResult.success) {
    return parseResult.data as FormDefinition;
  }

  return null;
}
