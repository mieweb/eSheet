import type {
  FormDefinition,
  FieldDefinition,
  FieldOption,
  TextInputType,
} from '../types.js';
import { generateOptionId } from './ids.js';

// ---------------------------------------------------------------------------
// MCP Elicitation Types (form mode, draft spec)
// ---------------------------------------------------------------------------

/** A literal const/title pair used in single- and multi-select enums. */
export interface McpConstOption {
  const: string;
  title: string;
}

/** String property — plain text, formatted text, or single-select enum. */
export interface McpStringProp {
  type: 'string';
  title?: string;
  description?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'email' | 'uri' | 'date' | 'date-time';
  enum?: string[];
  oneOf?: McpConstOption[];
  default?: string;
}

/** Numeric property. */
export interface McpNumberProp {
  type: 'number' | 'integer';
  title?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  default?: number;
}

/** Boolean property. */
export interface McpBooleanProp {
  type: 'boolean';
  title?: string;
  description?: string;
  default?: boolean;
}

/** Multi-select enum property. */
export interface McpArrayProp {
  type: 'array';
  title?: string;
  description?: string;
  minItems?: number;
  maxItems?: number;
  items: { enum: string[] } | { anyOf: McpConstOption[] };
  default?: string[];
}

export type McpProperty =
  | McpStringProp
  | McpNumberProp
  | McpBooleanProp
  | McpArrayProp;

/** The `requestedSchema` object in an MCP form-mode elicitation request. */
export interface McpElicitationSchema {
  type: 'object';
  properties: Record<string, McpProperty>;
  required?: string[];
}

/** Full MCP JSON-RPC 2.0 elicitation/create request envelope. */
export interface McpElicitationRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'elicitation/create';
  params: {
    message: string;
    requestedSchema: McpElicitationSchema;
  };
}

// ---------------------------------------------------------------------------
// Import: MCP elicitation schema → FormDefinition
// ---------------------------------------------------------------------------

/**
 * Convert an MCP elicitation `requestedSchema` into an eSheet `FormDefinition`.
 *
 * Field IDs are taken directly from the property key names so that a round-trip
 * export preserves the original MCP property names.
 *
 * Field types are mapped as follows:
 * - `string` (plain)         → `text` (+ `inputType` from `format`)
 * - `string` with `enum`     → `radio`
 * - `string` with `oneOf`    → `radio` (options carry display titles)
 * - `number` / `integer`     → `text` + `inputType: 'number'`
 * - `boolean`                → `boolean`
 * - `array` with enum items  → `check` (multi-select)
 */
export function importFromMcp(
  schema: McpElicitationSchema,
  options?: { formId?: string; title?: string }
): FormDefinition {
  const existingIds = new Set<string>();
  const requiredKeys = new Set(schema.required ?? []);

  const fields = Object.entries(schema.properties ?? {}).map(([key, prop]) =>
    mcpPropToField(key, prop, requiredKeys.has(key), existingIds)
  );

  return {
    id: options?.formId ?? 'mcp-form',
    ...(options?.title !== undefined ? { title: options.title } : {}),
    fields,
  };
}

function mcpPropToField(
  key: string,
  prop: McpProperty,
  isRequired: boolean,
  existingIds: Set<string>
): FieldDefinition {
  const question = (prop as { title?: string }).title;
  const shared = {
    id: key,
    ...(question !== undefined ? { question } : {}),
    ...(isRequired ? { required: true as const } : {}),
  };

  if (prop.type === 'array') {
    return {
      ...shared,
      fieldType: 'check',
      options: mcpItemsToOptions(prop.items, existingIds),
    };
  }

  if (prop.type === 'boolean') {
    return { ...shared, fieldType: 'boolean' };
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    return { ...shared, fieldType: 'text', inputType: 'number' };
  }

  // At this point prop.type === 'string'
  const strProp = prop as McpStringProp;

  if (strProp.oneOf) {
    return {
      ...shared,
      fieldType: 'radio',
      options: strProp.oneOf.map(({ const: v, title: t }) =>
        makeOption(v, existingIds, t)
      ),
    };
  }

  if (strProp.enum) {
    return {
      ...shared,
      fieldType: 'radio',
      options: strProp.enum.map((v) => makeOption(v, existingIds)),
    };
  }

  // plain string
  return {
    ...shared,
    fieldType: 'text',
    ...(strProp.format !== undefined
      ? { inputType: mcpFormatToInputType(strProp.format) }
      : {}),
  };
}

function mcpItemsToOptions(
  items: McpArrayProp['items'],
  existingIds: Set<string>
): FieldOption[] {
  if ('anyOf' in items) {
    return items.anyOf.map(({ const: v, title: t }) =>
      makeOption(v, existingIds, t)
    );
  }
  return items.enum.map((v) => makeOption(v, existingIds));
}

function makeOption(
  value: string,
  existingIds: Set<string>,
  text?: string
): FieldOption {
  const id = generateOptionId(existingIds);
  existingIds.add(id);
  return text !== undefined ? { id, value, text } : { id, value };
}

function mcpFormatToInputType(
  format: McpStringProp['format']
): TextInputType | undefined {
  const map: Partial<
    Record<NonNullable<McpStringProp['format']>, TextInputType>
  > = {
    email: 'email',
    uri: 'url',
    date: 'date',
    'date-time': 'datetime-local',
  };
  return format !== undefined ? map[format] : undefined;
}

// ---------------------------------------------------------------------------
// Export: FormDefinition → MCP elicitation schema
// ---------------------------------------------------------------------------

/**
 * Convert an eSheet `FormDefinition` into an MCP elicitation `requestedSchema`.
 *
 * Section containers are flattened — their leaf fields are promoted to the
 * top-level properties object. Field types with no MCP equivalent (matrix,
 * ranking, image, html, signature, diagram, display, multitext) are silently
 * skipped.
 *
 * Field types map as follows:
 * - `text` / `longtext`            → `string` (+ `format` from `inputType`)
 * - `boolean`                      → `boolean`
 * - `radio` / `dropdown`           → `string` enum (with or without titles)
 * - `check` / `multiselectdropdown`→ `array` enum (with or without titles)
 * - `rating`                       → `integer` (min=1, max=option count)
 * - `slider`                       → `number`
 */
export function exportToMcp(definition: FormDefinition): McpElicitationRequest {
  const properties: Record<string, McpProperty> = {};
  const required: string[] = [];

  for (const field of collectLeafFields(definition.fields)) {
    const prop = fieldToMcpProp(field);
    if (prop === null) continue;
    properties[field.id] = prop;
    if (field.required) required.push(field.id);
  }

  const requestedSchema: McpElicitationSchema = { type: 'object', properties };
  if (required.length > 0) requestedSchema.required = required;

  const message = definition.description ?? definition.title ?? '';
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'elicitation/create',
    params: { message, requestedSchema },
  };
}

/** Recursively flatten sections to their answerable leaf fields. */
function collectLeafFields(
  fields: readonly FieldDefinition[]
): FieldDefinition[] {
  const result: FieldDefinition[] = [];
  for (const f of fields) {
    if (f.fieldType === 'section' && f.fields) {
      result.push(...collectLeafFields(f.fields));
    } else {
      result.push(f);
    }
  }
  return result;
}

function fieldToMcpProp(field: FieldDefinition): McpProperty | null {
  const title = field.question;

  switch (field.fieldType) {
    case 'text':
    case 'longtext': {
      const format = inputTypeToMcpFormat(field.inputType);
      return {
        type: 'string',
        ...(title !== undefined ? { title } : {}),
        ...(format !== undefined ? { format } : {}),
      };
    }

    case 'boolean':
      return { type: 'boolean', ...(title !== undefined ? { title } : {}) };

    case 'radio':
    case 'dropdown': {
      const options = field.options ?? [];
      if (options.length === 0) {
        return { type: 'string', ...(title !== undefined ? { title } : {}) };
      }
      const hasText = options.some((o) => o.text !== undefined);
      if (hasText) {
        return {
          type: 'string',
          ...(title !== undefined ? { title } : {}),
          oneOf: options.map((o) => ({
            const: o.value,
            title: o.text ?? o.value,
          })),
        };
      }
      return {
        type: 'string',
        ...(title !== undefined ? { title } : {}),
        enum: options.map((o) => o.value),
      };
    }

    case 'check':
    case 'multiselectdropdown': {
      const options = field.options ?? [];
      const hasText = options.some((o) => o.text !== undefined);
      const items = hasText
        ? {
            anyOf: options.map((o) => ({
              const: o.value,
              title: o.text ?? o.value,
            })),
          }
        : { enum: options.map((o) => o.value) };
      return {
        type: 'array',
        ...(title !== undefined ? { title } : {}),
        items,
      };
    }

    case 'rating': {
      const max = field.options?.length;
      return {
        type: 'integer',
        minimum: 1,
        ...(max !== undefined ? { maximum: max } : {}),
        ...(title !== undefined ? { title } : {}),
      };
    }

    case 'slider':
      return { type: 'number', ...(title !== undefined ? { title } : {}) };

    default:
      // ranking, multitext, singlematrix, multimatrix, image, html,
      // signature, diagram, display → no MCP equivalent
      return null;
  }
}

function inputTypeToMcpFormat(
  inputType?: TextInputType
): McpStringProp['format'] | undefined {
  if (inputType === undefined) return undefined;
  const map: Partial<Record<TextInputType, McpStringProp['format']>> = {
    email: 'email',
    url: 'uri',
    date: 'date',
    'datetime-local': 'date-time',
  };
  return map[inputType];
}
