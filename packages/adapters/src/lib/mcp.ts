import type {
  FormDefinition,
  FieldDefinition,
  FieldOption,
  TextInputType,
} from '@esheet/core';
import { generateOptionId } from '@esheet/core';

// ---------------------------------------------------------------------------
// MCP Elicitation Types (spec 2025-11-25)
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
  /** Simple named enum (parallel array to `enum`). Spec 2025-11-25. */
  enum?: string[];
  enumNames?: string[];
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
  uniqueItems?: boolean;
  /** Spec 2025-11-25 wraps enum inside `{ type: "string", enum: [...] }` or uses `anyOf`. */
  items: { type?: string; enum: string[] } | { anyOf: McpConstOption[] };
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
  title?: string;
  properties: Record<string, McpProperty>;
  required?: string[];
}

/** Full MCP JSON-RPC 2.0 elicitation/create request envelope (spec 2025-11-25). */
export interface McpElicitationRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'elicitation/create';
  params:
    | {
        /** Form mode (default when omitted). */
        mode?: 'form';
        message: string;
        requestedSchema: McpElicitationSchema;
      }
    | {
        /** URL mode — out-of-band interaction, no requestedSchema. */
        mode: 'url';
        message: string;
        url: string;
        elicitationId: string;
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
 * - `string` (plain)                    → `text` (+ `inputType` from `format`)
 * - `string` with `enum`/`enumNames`    → `radio`
 * - `string` with `oneOf`               → `radio` (options carry display titles)
 * - `number` / `integer`                → `text` + `inputType: 'number'`
 * - `boolean`                           → `boolean`
 * - `array` with enum items             → `check` (multi-select)
 *
 * All MCP constraints (`default`, `minLength`, `maxLength`, `pattern`,
 * `minimum`, `maximum`, `minItems`, `maxItems`) are preserved in each
 * field's `_sourceData` so they survive a round-trip export.
 */
export function importFromMcp(
  schema: McpElicitationSchema,
  options?: {
    formId?: string;
    title?: string;
    description?: string;
    mcpId?: string | number;
    mcpMessage?: string;
    /** Top-level envelope `meta` field (non-standard, preserved for round-trip). */
    mcpMeta?: unknown;
  }
): FormDefinition {
  const existingIds = new Set<string>();
  const requiredKeys = new Set(schema.required ?? []);

  const fields = Object.entries(schema.properties ?? {}).map(([key, prop]) =>
    mcpPropToField(key, prop, requiredKeys.has(key), existingIds)
  );

  // Preserve MCP envelope + schema metadata for lossless round-trip export.
  const mcpMeta: Record<string, unknown> = {};
  if (options?.mcpId !== undefined) mcpMeta['mcpId'] = options.mcpId;
  if (options?.mcpMessage !== undefined)
    mcpMeta['mcpMessage'] = options.mcpMessage;
  if (schema.title !== undefined) mcpMeta['schemaTitle'] = schema.title;
  if (options?.mcpMeta !== undefined) mcpMeta['meta'] = options.mcpMeta;
  const hasMcpMeta = Object.keys(mcpMeta).length > 0;

  return {
    id: options?.formId ?? 'mcp-form',
    ...(options?.title !== undefined ? { title: options.title } : {}),
    ...(options?.description !== undefined
      ? { description: options.description }
      : {}),
    ...(hasMcpMeta ? { _sourceData: mcpMeta } : {}),
    fields,
  };
}

/** Opaque bag of MCP-specific field metadata stored in `_sourceData`. */
interface McpFieldMeta {
  description?: string;
  default?: string | number | boolean | string[];
  // string constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // number constraints
  minimum?: number;
  maximum?: number;
  /** Preserves 'number' vs 'integer' distinction across the round-trip. */
  mcpType?: 'number' | 'integer';
  // array constraints
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  /**
   * Full original MCP property definition for types outside the flat-form spec
   * (nested objects, array-of-objects). Emitted verbatim on export so no data
   * is lost across the round-trip.
   */
  mcpPropDefinition?: unknown;
}

function mcpPropToField(
  key: string,
  prop: McpProperty,
  isRequired: boolean,
  existingIds: Set<string>
): FieldDefinition {
  const question = (prop as { title?: string }).title;

  // Collect all preservable MCP metadata into _sourceData.
  const meta: McpFieldMeta = {};
  if (prop.description !== undefined) meta.description = prop.description;

  const shared = {
    id: key,
    ...(question !== undefined ? { question } : {}),
    ...(isRequired ? { required: true as const } : {}),
  };

  if ((prop as { type: string }).type === 'object') {
    // Nested objects are outside the MCP flat-form spec — import as longtext
    // so the user can inspect/paste the JSON value. Full definition preserved
    // in _sourceData so export restores it verbatim.
    return {
      ...shared,
      _sourceData: { ...meta, mcpPropDefinition: prop },
      fieldType: 'longtext',
    };
  }

  if (prop.type === 'array') {
    if (prop.default !== undefined) meta.default = prop.default;
    if (prop.minItems !== undefined) meta.minItems = prop.minItems;
    if (prop.maxItems !== undefined) meta.maxItems = prop.maxItems;
    if ((prop as McpArrayProp).uniqueItems !== undefined)
      meta.uniqueItems = (prop as McpArrayProp).uniqueItems;
    const options = mcpItemsToOptions(prop.items, existingIds);
    // Array of objects (no enum/anyOf) is outside spec — fall back to longtext,
    // full definition preserved for verbatim export.
    if (options === null) {
      return {
        ...shared,
        _sourceData: { ...meta, mcpPropDefinition: prop },
        fieldType: 'longtext',
      };
    }
    return {
      ...shared,
      ...(Object.keys(meta).length > 0 ? { _sourceData: meta } : {}),
      fieldType: 'check',
      options,
    };
  }

  if (prop.type === 'boolean') {
    if (prop.default !== undefined) meta.default = prop.default;
    return {
      ...shared,
      ...(Object.keys(meta).length > 0 ? { _sourceData: meta } : {}),
      fieldType: 'boolean',
    };
  }

  if (prop.type === 'number' || prop.type === 'integer') {
    meta.mcpType = prop.type;
    if (prop.default !== undefined) meta.default = prop.default;
    if (prop.minimum !== undefined) meta.minimum = prop.minimum;
    if (prop.maximum !== undefined) meta.maximum = prop.maximum;
    return {
      ...shared,
      ...(Object.keys(meta).length > 0 ? { _sourceData: meta } : {}),
      fieldType: 'text',
      inputType: 'number',
    };
  }

  // prop.type === 'string'
  const strProp = prop as McpStringProp;
  if (strProp.default !== undefined) meta.default = strProp.default;
  if (strProp.minLength !== undefined) meta.minLength = strProp.minLength;
  if (strProp.maxLength !== undefined) meta.maxLength = strProp.maxLength;
  if (strProp.pattern !== undefined) meta.pattern = strProp.pattern;

  const metaSpread = Object.keys(meta).length > 0 ? { _sourceData: meta } : {};

  if (strProp.oneOf) {
    return {
      ...shared,
      ...metaSpread,
      fieldType: 'radio',
      options: strProp.oneOf.map(({ const: v, title: t }) =>
        makeOption(v, existingIds, t)
      ),
    };
  }

  if (strProp.enum) {
    // `enumNames` (parallel array) provides display titles — spec 2025-11-25.
    const names = strProp.enumNames;
    return {
      ...shared,
      ...metaSpread,
      fieldType: 'radio',
      options: strProp.enum.map((v, i) =>
        makeOption(v, existingIds, names?.[i])
      ),
    };
  }

  // plain string
  return {
    ...shared,
    ...metaSpread,
    fieldType: 'text',
    ...(strProp.format !== undefined
      ? { inputType: mcpFormatToInputType(strProp.format) }
      : {}),
  };
}

/**
 * Returns null when items is an array-of-objects (outside MCP flat-form spec).
 * Returns an empty array for a valid but empty enum.
 */
function mcpItemsToOptions(
  items: McpArrayProp['items'],
  existingIds: Set<string>
): FieldOption[] | null {
  if ('anyOf' in items) {
    return items.anyOf.map(({ const: v, title: t }) =>
      makeOption(v, existingIds, t)
    );
  }
  if (!Array.isArray(items.enum)) {
    // items is an object schema (array-of-objects) — not a flat enum.
    return null;
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
 * Convert an eSheet `FormDefinition` into an MCP elicitation request (form mode).
 *
 * Section containers are flattened — their leaf fields are promoted to the
 * top-level properties object. Field types with no MCP equivalent (matrix,
 * ranking, image, html, signature, diagram, display, multitext) are silently
 * skipped.
 *
 * All MCP constraints stored in `_sourceData` during import are restored so
 * the output is a lossless round-trip of the original schema.
 *
 * Field types map as follows:
 * - `text` / `longtext`             → `string` (+ `format` from `inputType`)
 * - `boolean`                       → `boolean`
 * - `radio` / `dropdown`            → `string` enum (with or without titles)
 * - `check` / `multiselectdropdown` → `array` enum (with or without titles)
 * - `rating`                        → `integer` (min=1, max=option count)
 * - `slider`                        → `number`
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

  const src = definition._sourceData as
    | {
        mcpId?: string | number;
        mcpMessage?: string;
        schemaTitle?: string;
        meta?: unknown;
      }
    | null
    | undefined;

  const requestedSchema: McpElicitationSchema = { type: 'object', properties };
  if (src?.schemaTitle !== undefined) requestedSchema.title = src.schemaTitle;
  if (required.length > 0) requestedSchema.required = required;

  const envelopeId = src?.mcpId ?? definition.id;
  const message =
    src?.mcpMessage ?? definition.description ?? definition.title ?? '';
  const envelope: McpElicitationRequest = {
    jsonrpc: '2.0',
    id: envelopeId,
    method: 'elicitation/create',
    params: { mode: 'form', message, requestedSchema },
  };
  // Restore non-standard top-level meta if it was preserved during import.
  if (src?.meta !== undefined) {
    (envelope as unknown as Record<string, unknown>)['meta'] = src.meta;
  }
  return envelope;
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
  const meta = field._sourceData as McpFieldMeta | null | undefined;
  const description = meta?.description;

  switch (field.fieldType) {
    case 'text':
    case 'longtext': {
      // If this field was imported from a non-flat MCP type (object or
      // array-of-objects), restore the original property definition verbatim.
      if (meta?.mcpPropDefinition !== undefined) {
        return meta.mcpPropDefinition as McpProperty;
      }
      // Restore number/integer fields that were imported as text+inputType:number.
      if (meta?.mcpType !== undefined) {
        return {
          type: meta.mcpType,
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(meta.minimum !== undefined ? { minimum: meta.minimum } : {}),
          ...(meta.maximum !== undefined ? { maximum: meta.maximum } : {}),
          ...(meta.default !== undefined
            ? { default: meta.default as number }
            : {}),
        };
      }
      const format = inputTypeToMcpFormat(field.inputType);
      return {
        type: 'string',
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(meta?.minLength !== undefined ? { minLength: meta.minLength } : {}),
        ...(meta?.maxLength !== undefined ? { maxLength: meta.maxLength } : {}),
        ...(meta?.pattern !== undefined ? { pattern: meta.pattern } : {}),
        ...(format !== undefined ? { format } : {}),
        ...(meta?.default !== undefined
          ? { default: meta.default as string }
          : {}),
      };
    }

    case 'boolean':
      return {
        type: 'boolean',
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(meta?.default !== undefined
          ? { default: meta.default as boolean }
          : {}),
      };

    case 'radio':
    case 'dropdown': {
      const options = field.options ?? [];
      if (options.length === 0) {
        return {
          type: 'string',
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(meta?.default !== undefined
            ? { default: meta.default as string }
            : {}),
        };
      }
      const hasText = options.some((o) => o.text !== undefined);
      if (hasText) {
        return {
          type: 'string',
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          oneOf: options.map((o) => ({
            const: o.value,
            title: o.text ?? o.value,
          })),
          ...(meta?.default !== undefined
            ? { default: meta.default as string }
            : {}),
        };
      }
      return {
        type: 'string',
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        enum: options.map((o) => o.value),
        ...(meta?.default !== undefined
          ? { default: meta.default as string }
          : {}),
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
        : { type: 'string' as const, enum: options.map((o) => o.value) };
      return {
        type: 'array',
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(meta?.minItems !== undefined ? { minItems: meta.minItems } : {}),
        ...(meta?.maxItems !== undefined ? { maxItems: meta.maxItems } : {}),
        ...(meta?.uniqueItems !== undefined
          ? { uniqueItems: meta.uniqueItems }
          : {}),
        items,
        ...(meta?.default !== undefined
          ? { default: meta.default as string[] }
          : {}),
      };
    }

    case 'rating': {
      const max = field.options?.length;
      return {
        type: 'integer',
        minimum: 1,
        ...(max !== undefined ? { maximum: max } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(meta?.default !== undefined
          ? { default: meta.default as number }
          : {}),
      };
    }

    case 'slider': {
      // Restore number vs integer distinction from original import.
      const numType: 'number' | 'integer' = meta?.mcpType ?? 'number';
      return {
        type: numType,
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(meta?.minimum !== undefined ? { minimum: meta.minimum } : {}),
        ...(meta?.maximum !== undefined ? { maximum: meta.maximum } : {}),
        ...(meta?.default !== undefined
          ? { default: meta.default as number }
          : {}),
      };
    }

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
