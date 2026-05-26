// ---------------------------------------------------------------------------
// Tests — importFromMcp / exportToMcp (spec 2025-11-25)
// ---------------------------------------------------------------------------

import { importFromMcp, exportToMcp } from './mcp.js';
import type { McpElicitationSchema, McpElicitationRequest } from './mcp.js';
import type {
  RadioFieldDefinition,
  CheckFieldDefinition,
  TextFieldDefinition,
} from '@esheet/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFormSchema(req: McpElicitationRequest): McpElicitationSchema {
  if (req.params.mode === 'url') throw new Error('unexpected url mode');
  return req.params.requestedSchema;
}

// The schema from mcp.json (original reference fixture)
const referenceSchema: McpElicitationSchema = {
  type: 'object',
  required: ['appName', 'appType'],
  properties: {
    appName: {
      type: 'string',
      title: 'App Name',
      minLength: 3,
      maxLength: 50,
    },
    description: {
      type: 'string',
      title: 'Description',
      maxLength: 200,
    },
    appType: {
      type: 'string',
      title: 'App Type',
      enum: ['SaaS', 'Portfolio', 'E-commerce', 'Dashboard'],
    },
    features: {
      type: 'array',
      title: 'Select Features',
      items: {
        type: 'string',
        enum: ['Authentication', 'Payments', 'Analytics', 'Notifications'],
      },
      uniqueItems: true,
    },
    isPublic: {
      type: 'boolean',
      title: 'Publicly Accessible',
    },
    userLimit: {
      type: 'integer',
      title: 'Max Users',
      minimum: 1,
      maximum: 100000,
    },
  },
};

// ---------------------------------------------------------------------------
// importFromMcp
// ---------------------------------------------------------------------------

describe('importFromMcp', () => {
  it('maps string property to text field', () => {
    const form = importFromMcp({
      type: 'object',
      properties: { name: { type: 'string', title: 'Full Name' } },
    });
    const field = form.fields[0];
    expect(field.id).toBe('name');
    expect(field.fieldType).toBe('text');
    expect(field.question).toBe('Full Name');
  });

  it('marks required fields', () => {
    const form = importFromMcp({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        bio: { type: 'string' },
      },
    });
    expect(form.fields.find((f) => f.id === 'name')?.required).toBe(true);
    expect(form.fields.find((f) => f.id === 'bio')?.required).toBeUndefined();
  });

  it('maps string enum to radio field', () => {
    const form = importFromMcp({
      type: 'object',
      properties: {
        appType: {
          type: 'string',
          title: 'App Type',
          enum: ['SaaS', 'Portfolio'],
        },
      },
    });
    const field = form.fields[0] as RadioFieldDefinition;
    expect(field.fieldType).toBe('radio');
    expect(field.options?.map((o) => o.value)).toEqual(['SaaS', 'Portfolio']);
  });

  it('maps string oneOf enum to radio field with titles', () => {
    const form = importFromMcp({
      type: 'object',
      properties: {
        color: {
          type: 'string',
          title: 'Color',
          oneOf: [
            { const: '#FF0000', title: 'Red' },
            { const: '#00FF00', title: 'Green' },
          ],
        },
      },
    });
    const field = form.fields[0] as RadioFieldDefinition;
    expect(field.fieldType).toBe('radio');
    expect(field.options?.map((o) => o.value)).toEqual(['#FF0000', '#00FF00']);
    expect(field.options?.map((o) => o.text)).toEqual(['Red', 'Green']);
  });

  it('maps array enum to check field', () => {
    const form = importFromMcp({
      type: 'object',
      properties: {
        features: {
          type: 'array',
          title: 'Features',
          items: { type: 'string', enum: ['A', 'B', 'C'] },
          uniqueItems: true,
        },
      },
    });
    const field = form.fields[0] as CheckFieldDefinition;
    expect(field.fieldType).toBe('check');
    expect(field.options?.map((o) => o.value)).toEqual(['A', 'B', 'C']);
  });

  it('preserves uniqueItems in _sourceData', () => {
    const form = importFromMcp({
      type: 'object',
      properties: {
        features: {
          type: 'array',
          items: { type: 'string', enum: ['A', 'B'] },
          uniqueItems: true,
        },
      },
    });
    const meta = form.fields[0]._sourceData as { uniqueItems?: boolean };
    expect(meta?.uniqueItems).toBe(true);
  });

  it('maps boolean to boolean field', () => {
    const form = importFromMcp({
      type: 'object',
      properties: {
        isPublic: { type: 'boolean', title: 'Publicly Accessible' },
      },
    });
    expect(form.fields[0].fieldType).toBe('boolean');
  });

  it('maps integer to text+number field and preserves constraints', () => {
    const form = importFromMcp({
      type: 'object',
      properties: {
        userLimit: {
          type: 'integer',
          title: 'Max Users',
          minimum: 1,
          maximum: 100000,
        },
      },
    });
    const field = form.fields[0] as TextFieldDefinition;
    expect(field.fieldType).toBe('text');
    expect(field.inputType).toBe('number');
    const meta = field._sourceData as {
      mcpType?: string;
      minimum?: number;
      maximum?: number;
    };
    expect(meta?.mcpType).toBe('integer');
    expect(meta?.minimum).toBe(1);
    expect(meta?.maximum).toBe(100000);
  });

  it('maps string format:email to text+email', () => {
    const form = importFromMcp({
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
    });
    expect((form.fields[0] as TextFieldDefinition).inputType).toBe('email');
  });

  it('preserves string constraints in _sourceData', () => {
    const form = importFromMcp({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 3,
          maxLength: 50,
          pattern: '^[A-Z]',
        },
      },
    });
    const meta = form.fields[0]._sourceData as {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
    };
    expect(meta?.minLength).toBe(3);
    expect(meta?.maxLength).toBe(50);
    expect(meta?.pattern).toBe('^[A-Z]');
  });

  it('stores mcpId and mcpMessage in form _sourceData', () => {
    const form = importFromMcp(
      { type: 'object', properties: {} },
      { mcpId: 'abc-123', mcpMessage: 'Hello' }
    );
    const src = form._sourceData as { mcpId?: unknown; mcpMessage?: unknown };
    expect(src?.mcpId).toBe('abc-123');
    expect(src?.mcpMessage).toBe('Hello');
  });
});

// ---------------------------------------------------------------------------
// exportToMcp
// ---------------------------------------------------------------------------

describe('exportToMcp', () => {
  it('produces valid jsonrpc 2.0 envelope', () => {
    const form = importFromMcp({ type: 'object', properties: {} });
    const req = exportToMcp(form);
    expect(req.jsonrpc).toBe('2.0');
    expect(req.method).toBe('elicitation/create');
    expect(req.params.mode).toBe('form');
  });

  it('round-trips a plain string field', () => {
    const schema: McpElicitationSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name', minLength: 2, maxLength: 30 },
      },
    };
    const exported = getFormSchema(exportToMcp(importFromMcp(schema)));
    expect(exported.properties['name']).toEqual(schema.properties['name']);
  });

  it('round-trips a string enum (radio) field', () => {
    const schema: McpElicitationSchema = {
      type: 'object',
      properties: {
        appType: {
          type: 'string',
          title: 'App Type',
          enum: ['SaaS', 'Portfolio', 'E-commerce', 'Dashboard'],
        },
      },
    };
    const exported = getFormSchema(exportToMcp(importFromMcp(schema)));
    expect(exported.properties['appType']).toEqual(
      schema.properties['appType']
    );
  });

  it('round-trips an array enum (check) field — emits items.type:string and uniqueItems', () => {
    const schema: McpElicitationSchema = {
      type: 'object',
      properties: {
        features: {
          type: 'array',
          title: 'Select Features',
          items: {
            type: 'string',
            enum: ['Authentication', 'Payments', 'Analytics', 'Notifications'],
          },
          uniqueItems: true,
        },
      },
    };
    const exported = getFormSchema(exportToMcp(importFromMcp(schema)));
    const prop = exported.properties['features'];
    expect(prop.type).toBe('array');
    if (prop.type !== 'array') return;
    expect(prop.uniqueItems).toBe(true);
    expect('enum' in prop.items).toBe(true);
    if (!('enum' in prop.items)) return;
    expect((prop.items as { type?: string }).type).toBe('string');
    expect(prop.items.enum).toEqual([
      'Authentication',
      'Payments',
      'Analytics',
      'Notifications',
    ]);
  });

  it('round-trips a boolean field', () => {
    const schema: McpElicitationSchema = {
      type: 'object',
      properties: {
        isPublic: { type: 'boolean', title: 'Publicly Accessible' },
      },
    };
    const exported = getFormSchema(exportToMcp(importFromMcp(schema)));
    expect(exported.properties['isPublic']).toEqual(
      schema.properties['isPublic']
    );
  });

  it('round-trips an integer field with minimum/maximum', () => {
    const schema: McpElicitationSchema = {
      type: 'object',
      properties: {
        userLimit: {
          type: 'integer',
          title: 'Max Users',
          minimum: 1,
          maximum: 100000,
        },
      },
    };
    const exported = getFormSchema(exportToMcp(importFromMcp(schema)));
    expect(exported.properties['userLimit']).toEqual(
      schema.properties['userLimit']
    );
  });

  it('round-trips required array', () => {
    const schema: McpElicitationSchema = {
      type: 'object',
      required: ['appName', 'appType'],
      properties: {
        appName: { type: 'string', title: 'App Name' },
        appType: { type: 'string', title: 'App Type', enum: ['SaaS'] },
      },
    };
    const exported = getFormSchema(exportToMcp(importFromMcp(schema)));
    expect(exported.required).toEqual(
      expect.arrayContaining(['appName', 'appType'])
    );
  });

  it('full reference schema round-trips without data loss', () => {
    const form = importFromMcp(referenceSchema, {
      mcpId: 'webapp-elicitation-001',
      mcpMessage: 'Fill out the basic web app configuration',
    });
    const exported = exportToMcp(form);
    const schema = getFormSchema(exported);

    // Envelope
    expect(exported.id).toBe('webapp-elicitation-001');
    expect(exported.params.mode).toBe('form');
    if (exported.params.mode !== 'form') return;
    expect(exported.params.message).toBe(
      'Fill out the basic web app configuration'
    );

    // Required
    expect(schema.required).toEqual(
      expect.arrayContaining(['appName', 'appType'])
    );

    // appName — string with minLength/maxLength
    expect(schema.properties['appName']).toEqual(
      referenceSchema.properties['appName']
    );

    // description — string with maxLength
    expect(schema.properties['description']).toEqual(
      referenceSchema.properties['description']
    );

    // appType — string enum
    expect(schema.properties['appType']).toEqual(
      referenceSchema.properties['appType']
    );

    // features — array with items.type:string, uniqueItems
    const features = schema.properties['features'];
    expect(features.type).toBe('array');
    if (features.type !== 'array') return;
    expect(features.uniqueItems).toBe(true);
    expect('enum' in features.items).toBe(true);
    if (!('enum' in features.items)) return;
    expect((features.items as { type?: string }).type).toBe('string');

    // isPublic — boolean
    expect(schema.properties['isPublic']).toEqual(
      referenceSchema.properties['isPublic']
    );

    // userLimit — integer with minimum/maximum
    expect(schema.properties['userLimit']).toEqual(
      referenceSchema.properties['userLimit']
    );
  });
});
