/**
 * Default system prompt for eSheet form generation.
 * Keep it short - schema structure is enforced via JSON Schema.
 */
export const DEFAULT_SYSTEM_PROMPT = `Generate a valid eSheet FormDefinition.
Return only JSON matching the provided schema.
Use kebab-case IDs.
Use question for field labels.
Use required, not isRequired.
Use options as { id, value, text }.
Do not generate SurveyJS schemas.`;

/**
 * System prompt for repair attempts.
 */
export const REPAIR_SYSTEM_PROMPT = `Fix the invalid eSheet FormDefinition.
The schema failed validation with the errors listed below.
Return only the corrected JSON matching the provided schema.
Do not add explanations or markdown.`;
