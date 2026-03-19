import React from 'react';
import YAML from 'js-yaml';
import {
  formDefinitionSchema,
  type FormDefinition,
  type FormResponse,
  type FormStore,
  type UIStore,
} from '@msheet/core';

/**
 * Initialize renderer with form definition
 *
 * - Parses YAML/JSON string input or accepts object directly
 * - Validates against formDefinitionSchema
 * - Loads definition into form store
 * - Sets UI to preview mode
 * - Applies initial responses if provided
 */
export function useRendererInit(
  form: FormStore,
  ui: UIStore,
  formData: FormDefinition | string,
  initialResponses?: FormResponse
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
        console.error('[MsheetRenderer] Invalid form definition:', validated.error.issues);
        // Load empty form instead of crashing
        form.getState().loadDefinition({
          schemaType: 'mieforms-v1.0',
          title: 'Invalid Form',
          fields: [],
        });
        ui.getState().setMode('preview');
        return;
      }

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
      console.error('[MsheetRenderer] Failed to initialize:', error);
      // Load empty form as fallback
      form.getState().loadDefinition({
        schemaType: 'mieforms-v1.0',
        title: 'Error',
        fields: [],
      });
      ui.getState().setMode('preview');
    }
  }, [form, ui, formData, initialResponses]);
}
