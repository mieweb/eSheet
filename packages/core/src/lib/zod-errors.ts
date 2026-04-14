/**
 * Validation utilities for form schemas
 */

/**
 * Format a Zod validation error with helpful, context-specific guidance
 * for developers and users during form import/rendering.
 *
 * Converts generic Zod error codes (missing, invalid_type, unrecognized_keys, etc.)
 * into readable messages that explain what went wrong and why.
 */
export function formatZodValidationError(issue: {
  code: string;
  message: string;
  path: (string | number | symbol)[];
  received?: unknown;
  expected?: unknown;
}): string {
  const path =
    issue.path.length > 0
      ? issue.path
          .map((p) => (typeof p === 'symbol' ? p.toString() : String(p)))
          .join('.')
      : '(root)';

  // Provide context-specific messages for common error codes
  switch (issue.code) {
    case 'missing':
      return `${path}: Missing required field`;

    case 'invalid_type': {
      const expected =
        typeof issue.expected === 'string' ? issue.expected : 'correct type';
      const received =
        typeof issue.received === 'object' && issue.received !== null
          ? Array.isArray(issue.received)
            ? 'array'
            : 'object'
          : typeof issue.received;
      return `${path}: Expected ${expected}, got ${received}`;
    }

    case 'unrecognized_keys': {
      const keys = Array.isArray(issue.received)
        ? issue.received.join(', ')
        : String(issue.received);
      return `${path}: Unknown property/properties: ${keys}`;
    }

    case 'invalid_literal': {
      return `${path}: Must be exactly '${issue.expected}'`;
    }

    case 'invalid_enum': {
      const options = Array.isArray(issue.expected)
        ? issue.expected.join(', ')
        : String(issue.expected);
      return `${path}: Must be one of: ${options}`;
    }

    case 'too_small':
      return `${path}: Value too short or not enough items (minimum required)`;

    case 'too_big':
      return `${path}: Value too long or too many items (maximum exceeded)`;

    case 'invalid_string':
      return `${path}: Invalid string format`;

    default: {
      // Fallback for other error codes
      const received =
        'received' in issue ? ` (received: ${issue.received})` : '';
      return `${path} [${issue.code}]: ${issue.message}${received}`;
    }
  }
}
