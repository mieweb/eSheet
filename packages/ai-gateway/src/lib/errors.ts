/**
 * Error thrown when AI-generated schema fails validation.
 */
export class ESheetAIGenerationError extends Error {
  /** Validation errors from Zod. */
  public readonly validationErrors: string[];
  /** The invalid schema that was generated. */
  public readonly invalidSchema: unknown;
  /** Whether a repair was attempted. */
  public readonly repairAttempted: boolean;

  constructor(options: {
    message: string;
    validationErrors: string[];
    invalidSchema: unknown;
    repairAttempted?: boolean;
  }) {
    super(options.message);
    this.name = 'ESheetAIGenerationError';
    this.validationErrors = options.validationErrors;
    this.invalidSchema = options.invalidSchema;
    this.repairAttempted = options.repairAttempted ?? false;
  }
}
