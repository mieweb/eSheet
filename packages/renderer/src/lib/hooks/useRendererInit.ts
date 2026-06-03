import React from 'react';
import YAML from 'js-yaml';
import {
  formatZodValidationError,
  formDefinitionSchema,
  type FormResponse,
  type FormStore,
  type UIStore,
} from '@esheet/core';
import {
  importFromMcp,
  convertSurveyJS,
  isSurveyJSSchema,
  isMcpElicitationRequest,
  importFromFhir,
  isFhirQuestionnaire,
  type McpElicitationRequest,
  type FhirQuestionnaire,
} from '@esheet/adapters';

/**
 * Initialize renderer with form definition.
 *
 * Auto-detects and converts the following input formats:
 * - eSheet FormDefinition (object or JSON/YAML string)
 * - FHIR R4 Questionnaire resource
 * - MCP elicitation/create envelope
 * - SurveyJS schema (has top-level `pages` or `elements` array)
 */
export function useRendererInit(
  form: FormStore,
  ui: UIStore,
  formData: unknown,
  initialResponses?: FormResponse,
  onValidationError?: (errors: string[]) => void,
  strict = false,
  onReady?: () => void
): void {
  // Store onReady in a ref so it never causes the effect to re-run
  const onReadyRef = React.useRef(onReady);
  onReadyRef.current = onReady;

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

      // Auto-detect and convert FHIR, MCP or SurveyJS input (skipped in strict mode)
      if (!strict && isFhirQuestionnaire(parsed)) {
        parsed = importFromFhir(parsed as FhirQuestionnaire);
      } else if (!strict && isMcpElicitationRequest(parsed)) {
        const mcpReq = parsed as McpElicitationRequest;
        if (mcpReq.params.mode !== 'url') {
          parsed = importFromMcp(
            mcpReq.params.requestedSchema as Parameters<
              typeof importFromMcp
            >[0],
            {
              mcpId: mcpReq.id,
              mcpMessage: mcpReq.params.message,
            }
          );
        }
      } else if (!strict && isSurveyJSSchema(parsed)) {
        parsed = convertSurveyJS(
          parsed as Parameters<typeof convertSurveyJS>[0]
        );
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
      onReadyRef.current?.();
    } catch (error) {
      console.error('[EsheetRenderer] Failed to initialize:', error);
      // Load empty form as fallback
      form.getState().loadDefinition({
        id: 'error-form',
        title: 'Error',
        fields: [],
      });
      ui.getState().setMode('preview');
    }
  }, [form, ui, formData, initialResponses, onValidationError, strict]);
}
