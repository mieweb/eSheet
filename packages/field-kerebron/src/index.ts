import { z } from 'zod/mini';
import { registerFieldType, registerFieldSchema } from '@esheet/core';

// Register field type metadata (label, category, etc.)
registerFieldType('richtext', {
  label: 'Rich Text Editor',
  category: 'rich',
  answerType: 'text',
  hasOptions: false,
  hasMatrix: false,
  defaultProps: {},
  placeholder: { question: 'Enter your question...' },
});

// Register Zod schema so form validation accepts richtext fields
registerFieldSchema(
  z.object({
    fieldType: z.literal('richtext'),
    id: z.string(),
    question: z.optional(z.string()),
    required: z.optional(z.boolean()),
    defaultContent: z.optional(z.string()),
  })
);

export { RichTextEditorField } from './RichTextEditorField.js';
export type { RichTextFieldDefinition } from './RichTextEditorField.js';
