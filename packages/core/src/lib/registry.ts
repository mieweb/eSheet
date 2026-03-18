// ---------------------------------------------------------------------------
// Field Type Metadata (registry data)
// ---------------------------------------------------------------------------

import type { FieldType, FieldTypeRegistry, FieldTypeMeta } from './types.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Register a custom field type (or override a built-in one). */
export function registerFieldType(key: string, meta: FieldTypeMeta): void {
  registry[key] = meta;
}

/** Look up metadata for a registered field type. */
export function getFieldTypeMeta(key: string): FieldTypeMeta | undefined {
  return registry[key];
}

/** Get all currently registered field type keys. */
export function getRegisteredFieldTypes(): string[] {
  return Object.keys(registry);
}

/** Reset the registry to only the 19 built-in field types (useful for testing). */
export function resetFieldTypeRegistry(): void {
  for (const key of Object.keys(registry)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete registry[key];
  }
  Object.assign(registry, BUILT_IN_FIELD_TYPES);
}

/** Batch-register UI component classes for multiple field types. */
export function registerFieldElements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: Record<string, new (...args: any[]) => unknown>
): void {
  for (const [key, elementClass] of Object.entries(elements)) {
    const meta = registry[key];
    if (meta) {
      meta.elementClass = elementClass;
    }
  }
}

// ---------------------------------------------------------------------------
// Runtime registry (private, seeded with built-in types)
// ---------------------------------------------------------------------------

const BUILT_IN_FIELD_TYPES: Record<FieldType, FieldTypeMeta> = {
  text: {
    label: 'Text',
    category: 'text',
    answerType: 'text',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: { inputType: 'string' },
    placeholder: {
      question: 'Enter your question...',
      answer: 'Enter answer...',
    },
  },
  longtext: {
    label: 'Long Text',
    category: 'text',
    answerType: 'text',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      answer: 'Enter detailed answer...',
    },
  },
  multitext: {
    label: 'Multi Text',
    category: 'text',
    answerType: 'multitext',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter option text...',
    },
    defaultOptionCount: 3,
  },
  radio: {
    label: 'Radio',
    category: 'selection',
    answerType: 'selection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter option text...',
    },
    defaultOptionCount: 3,
  },
  check: {
    label: 'Checkbox',
    category: 'selection',
    answerType: 'multiselection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter option text...',
    },
    defaultOptionCount: 3,
  },
  boolean: {
    label: 'Boolean',
    category: 'selection',
    answerType: 'selection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: { question: 'Enter your question...' },
  },
  dropdown: {
    label: 'Dropdown',
    category: 'selection',
    answerType: 'selection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter option text...',
    },
    defaultOptionCount: 3,
  },
  multiselectdropdown: {
    label: 'Multi-Select Dropdown',
    category: 'selection',
    answerType: 'multiselection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter option text...',
    },
    defaultOptionCount: 3,
  },
  rating: {
    label: 'Rating',
    category: 'rating',
    answerType: 'selection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter rating level...',
    },
    defaultOptionCount: 5,
  },
  ranking: {
    label: 'Ranking',
    category: 'rating',
    answerType: 'multiselection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter item to rank...',
    },
    defaultOptionCount: 3,
  },
  slider: {
    label: 'Slider',
    category: 'rating',
    answerType: 'selection',
    hasOptions: true,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      options: 'Enter scale label...',
    },
    defaultOptionCount: 3,
  },
  singlematrix: {
    label: 'Single Matrix',
    category: 'matrix',
    answerType: 'matrix',
    hasOptions: false,
    hasMatrix: true,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      rows: 'Enter row label...',
      columns: 'Enter column label...',
    },
    defaultOptionCount: 3,
  },
  multimatrix: {
    label: 'Multi Matrix',
    category: 'matrix',
    answerType: 'matrix',
    hasOptions: false,
    hasMatrix: true,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      rows: 'Enter row label...',
      columns: 'Enter column label...',
    },
    defaultOptionCount: 3,
  },
  image: {
    label: 'Image',
    category: 'rich',
    answerType: 'display',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    placeholder: { question: 'Image Block' },
  },
  html: {
    label: 'HTML Block',
    category: 'rich',
    answerType: 'display',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    placeholder: { htmlContent: '<p>Enter your HTML content here...</p>' },
  },
  signature: {
    label: 'Signature',
    category: 'rich',
    answerType: 'media',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    placeholder: { question: 'Enter your question...', pad: 'Sign here' },
  },
  diagram: {
    label: 'Diagram',
    category: 'rich',
    answerType: 'media',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      question: 'Enter your question...',
      pad: 'Draw on the diagram',
    },
  },
  display: {
    label: 'Display',
    category: 'rich',
    answerType: 'display',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: {},
    placeholder: {
      content:
        'Your BMI is **{weight-kg} / (({height-cm}/100) * ({height-cm}/100))**',
    },
  },
  section: {
    label: 'Section',
    category: 'organization',
    answerType: 'container',
    hasOptions: false,
    hasMatrix: false,
    defaultProps: { fields: [] },
    placeholder: { title: 'Enter section title...' },
  },
};

/** Mutable registry seeded with the 19 built-in field types. */
const registry: FieldTypeRegistry = { ...BUILT_IN_FIELD_TYPES };
