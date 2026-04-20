import React from 'react';
import YAML from 'js-yaml';
import {
  formatZodValidationError,
  formDefinitionSchema,
  type FormDefinition,
  type FormResponse,
  type FormStore,
  type UIStore,
} from '@esheet/core';

/**
 * Initialize renderer with form definition
 *
 * - Parses YAML/JSON string input or accepts object directly
 * - Validates against formDefinitionSchema
 * - Loads definition into form store
 * - Sets UI to preview mode
 * - Applies initial responses if provided
 * - Calls onValidationError with schema validation issues if validation fails
 */
export function useRendererInit(
  form: FormStore,
  ui: UIStore,
  formData: FormDefinition | string,
  initialResponses?: FormResponse,
  onValidationError?: (errors: string[]) => void
): void {
  React.useEffect(() => {
    try {
      // Parse input if string
      let parsed: unknown;
      if (typeof formData === 'string') {
        const trimmed = formData.trim();
        // Detect format: YAML if starts with non-brace, JSON otherwise
        const isYaml = !trimmed.startsWith('{') && !trimmed.startsWith('[');
        parsed = isYaml ? YAML.load(trimmed) : JSON.parse(trimmed);
      } else {
        parsed = formData;
      }

      // Validate schema
      const validated = formDefinitionSchema.safeParse(parsed);
      if (!validated.success) {
        const errors = validated.error.issues.map(formatZodValidationError);
        console.error(
          '[EsheetRenderer] Invalid form definition:',
          validated.error.issues
        );
        onValidationError?.(errors);
        // Load empty form instead of crashing
        form.getState().loadDefinition({
          schemaType: 'mieforms-v1.0',
          id: 'invalid-form',
          title: 'Invalid Form',
          fields: [],
        });
        ui.getState().setMode('preview');
        return;
      }
      // Clear any previous validation errors on success
      onValidationError?.([]);

      // Load validated definition
      form.getState().loadDefinition(validated.data);

      // Apply initial responses if provided
      if (initialResponses && Object.keys(initialResponses).length > 0) {
        for (const [fieldId, value] of Object.entries(initialResponses)) {
          form.getState().setResponse(fieldId, value);
        }
      }

      // Set preview mode
      ui.getState().setMode('preview');
    } catch (error) {
      console.error('[EsheetRenderer] Failed to initialize:', error);
      // Load empty form as fallback
      form.getState().loadDefinition({
        schemaType: 'mieforms-v1.0',
        id: 'error-form',
        title: 'Error',
        fields: [],
      });
      ui.getState().setMode('preview');
    }
  }, [form, ui, formData, initialResponses, onValidationError]);
}
