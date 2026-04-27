import type { FormDefinition } from '@esheet/core';

// ============================================================================
// Provider Interface (provider-agnostic)
// ============================================================================

/**
 * Provider-agnostic interface for AI schema generation.
 * Implement this interface to support different AI providers
 * (OpenAI, Anthropic, local models, etc.).
 */
export interface ESheetAIProvider {
  /**
   * Generate a structured form schema from the given input.
   * Returns raw output from the AI - validation happens in generateESheetForm.
   */
  generateStructuredForm(input: GenerateFormInput): Promise<unknown>;
}

/**
 * Input for generating a form schema.
 */
export interface GenerateFormInput {
  /** Natural language description of the form to generate. */
  prompt: string;
  /** JSON Schema to guide structured output generation. */
  schema: Record<string, unknown>;
  /** System prompt to set context for generation. */
  systemPrompt: string;
  /** Model identifier (provider-specific). */
  model?: string;
}

// ============================================================================
// Generation Options
// ============================================================================

/**
 * Options for the generateESheetForm function.
 */
export interface GenerateESheetFormOptions {
  /** Natural language description of the form to generate. */
  prompt: string;
  /** AI provider instance to use for generation. */
  provider: ESheetAIProvider;
  /** Model to use (optional, provider-specific). */
  model?: string;
  /** If true, attempt one repair pass when validation fails. */
  repair?: boolean;
  /** Custom system prompt override (optional). */
  systemPrompt?: string;
}

/**
 * Result of form generation.
 */
export interface GenerateESheetFormResult {
  /** The generated and validated form definition. */
  form: FormDefinition;
  /** Whether a repair pass was needed. */
  repaired: boolean;
}

// ============================================================================
// Repair Types
// ============================================================================

/**
 * Input for the repair function.
 */
export interface RepairFormInput {
  /** The invalid schema that needs repair. */
  invalidSchema: unknown;
  /** Validation errors to fix. */
  validationErrors: string[];
  /** AI provider to use for repair. */
  provider: ESheetAIProvider;
  /** Model to use (optional). */
  model?: string;
}
