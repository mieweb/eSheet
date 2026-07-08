---
sidebar_position: 1
---

# FHIR Adapter

Convert between FHIR R4 Questionnaire/QuestionnaireResponse resources and eSheet `FormDefinition`. Supports bidirectional conversion with metadata preservation for round-trip fidelity, conditional logic (enableWhen), and DTR profile compatibility.

## Functions

| Function                      | Signature                                                                                                               | Description                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `importFromFhir`              | `(questionnaire: FhirQuestionnaire, options?: FhirImportOptions) => FormDefinition`                                     | Import FHIR Questionnaire to eSheet         |
| `exportToFhir`                | `(form: FormDefinition, options?: FhirExportOptions) => FhirQuestionnaire`                                              | Export eSheet to FHIR Questionnaire         |
| `importResponseFromFhir`      | `(response: FhirQuestionnaireResponse, options?: ResponseImportOptions) => Record<string, unknown>`                     | Import QuestionnaireResponse to answers map |
| `exportResponseToFhir`        | `(form: FormDefinition, answers: Record<string, unknown>, options: ResponseExportOptions) => FhirQuestionnaireResponse` | Export answers to QuestionnaireResponse     |
| `isFhirQuestionnaire`         | `(value: unknown) => value is FhirQuestionnaire`                                                                        | Type guard for Questionnaire                |
| `isFhirQuestionnaireResponse` | `(value: unknown) => value is FhirQuestionnaireResponse`                                                                | Type guard for QuestionnaireResponse        |

## Import from FHIR

```typescript
import { importFromFhir } from '@esheet/adapters';

const fhirQuestionnaire = {
  resourceType: 'Questionnaire',
  id: 'patient-intake',
  status: 'active',
  title: 'Patient Intake Form',
  item: [
    {
      linkId: 'name',
      text: 'Full Name',
      type: 'string',
      required: true,
    },
    {
      linkId: 'dob',
      text: 'Date of Birth',
      type: 'date',
    },
    {
      linkId: 'conditions',
      text: 'Pre-existing Conditions',
      type: 'choice',
      repeats: true,
      answerOption: [
        { valueCoding: { code: 'diabetes', display: 'Diabetes' } },
        { valueCoding: { code: 'hypertension', display: 'Hypertension' } },
      ],
    },
  ],
};

const formDefinition = importFromFhir(fhirQuestionnaire);
// formDefinition.fields contains text, date, and checkbox fields
```

### Import Options

```typescript
interface FhirImportOptions {
  formId?: string; // Override generated form ID
  preserveExtensions?: boolean; // Keep extensions in _sourceData (default: true)
  strictMode?: boolean; // Fail on unsupported features (default: false)
}

const form = importFromFhir(questionnaire, {
  formId: 'custom-form-id',
  preserveExtensions: true,
});
```

## Export to FHIR

```typescript
import { exportToFhir } from '@esheet/adapters';

const fhirQuestionnaire = exportToFhir(formDefinition, {
  canonicalUrl: 'https://example.org/fhir',
  publisher: 'My Organization',
  status: 'active',
});
// Returns valid FHIR R4 Questionnaire resource
```

### Export Options

```typescript
interface FhirExportOptions {
  resourceId?: string; // Override resource ID
  canonicalUrl?: string; // Base URL for canonical references
  status?: 'draft' | 'active' | 'retired' | 'unknown'; // Resource status (default: draft)
  publisher?: string; // Publisher name
  dtrCompliant?: boolean; // Apply DTR profile constraints
}
```

## Type Guards

Use type guards to detect FHIR resources when handling unknown input:

```typescript
import {
  isFhirQuestionnaire,
  isFhirQuestionnaireResponse,
  importFromFhir,
  importResponseFromFhir,
} from '@esheet/adapters';

function detectAndConvert(resource: unknown) {
  if (isFhirQuestionnaire(resource)) {
    return importFromFhir(resource);
  }
  if (isFhirQuestionnaireResponse(resource)) {
    return importResponseFromFhir(resource);
  }
  return null;
}
```

Returns `true` if value has `resourceType: 'Questionnaire'` or `resourceType: 'QuestionnaireResponse'`.

## Response Conversion

### Import QuestionnaireResponse

Convert filled-out responses back to an eSheet answers map:

```typescript
import { importResponseFromFhir } from '@esheet/adapters';

const fhirResponse = {
  resourceType: 'QuestionnaireResponse',
  questionnaire: 'Questionnaire/patient-intake',
  status: 'completed',
  item: [
    {
      linkId: 'name',
      answer: [{ valueString: 'John Doe' }],
    },
    {
      linkId: 'conditions',
      answer: [
        { valueCoding: { code: 'diabetes' } },
        { valueCoding: { code: 'hypertension' } },
      ],
    },
  ],
};

const answers = importResponseFromFhir(fhirResponse);
// { name: 'John Doe', conditions: ['diabetes', 'hypertension'] }
```

### Export to QuestionnaireResponse

Convert eSheet answers to a FHIR QuestionnaireResponse:

```typescript
import { exportResponseToFhir } from '@esheet/adapters';

const answers = {
  name: 'Jane Smith',
  dob: '1990-05-15',
  conditions: ['diabetes'],
};

const fhirResponse = exportResponseToFhir(formDefinition, answers, {
  questionnaireUrl: 'https://example.org/fhir/Questionnaire/patient-intake',
  subject: { reference: 'Patient/123' },
  author: { reference: 'Practitioner/456' },
  status: 'completed',
});
```

### Response Export Options

```typescript
interface ResponseExportOptions {
  questionnaireUrl: string; // Canonical reference to questionnaire (required)
  subject?: FhirReference; // Patient/subject reference
  author?: FhirReference; // Author reference
  status?:
    | 'in-progress'
    | 'completed'
    | 'amended'
    | 'entered-in-error'
    | 'stopped';
  resourceId?: string; // Resource ID
}
```

## Field Type Mapping

### FHIR → eSheet

| FHIR Item Type | itemControl Extension        | eSheet Field Type                  |
| -------------- | ---------------------------- | ---------------------------------- |
| `string`       | —                            | `text` (inputType: string)         |
| `text`         | —                            | `longtext`                         |
| `boolean`      | —                            | `boolean`                          |
| `decimal`      | —                            | `text` (inputType: number)         |
| `integer`      | —                            | `text` (inputType: number)         |
| `integer`      | `slider`                     | `slider`                           |
| `date`         | —                            | `text` (inputType: date)           |
| `dateTime`     | —                            | `text` (inputType: datetime-local) |
| `time`         | —                            | `text` (inputType: time)           |
| `url`          | —                            | `text` (inputType: url)            |
| `choice`       | `radio-button`               | `radio`                            |
| `choice`       | `check-box`                  | `check`                            |
| `choice`       | `drop-down` / `autocomplete` | `dropdown`                         |
| `choice`       | — (with `repeats: true`)     | `check`                            |
| `choice`       | — (without `repeats`)        | `radio`                            |
| `open-choice`  | (same as `choice`)           | (same as `choice`)                 |
| `group`        | —                            | `section`                          |
| `display`      | —                            | `display`                          |
| `attachment`   | — (with signatureRequired)   | `signature`                        |
| `attachment`   | —                            | `diagram`                          |
| `reference`    | —                            | `text` ⚠️                          |
| `quantity`     | —                            | `text` ⚠️                          |

⚠️ = Lossy conversion (see [Warning System](#warning-system))

### eSheet → FHIR

| eSheet Field Type       | FHIR Type    | itemControl Extension       |
| ----------------------- | ------------ | --------------------------- |
| `text`                  | (varies)     | —                           |
| `text` (number)         | `decimal`    | —                           |
| `text` (date)           | `date`       | —                           |
| `text` (datetime-local) | `dateTime`   | —                           |
| `text` (time)           | `time`       | —                           |
| `text` (url)            | `url`        | —                           |
| `longtext`              | `text`       | —                           |
| `boolean`               | `boolean`    | —                           |
| `radio`                 | `choice`     | `radio-button`              |
| `check`                 | `choice`     | `check-box` (repeats: true) |
| `dropdown`              | `choice`     | `drop-down`                 |
| `multiselectdropdown`   | `choice`     | `drop-down` (repeats: true) |
| `rating`                | `integer`    | `slider`                    |
| `slider`                | `decimal`    | `slider`                    |
| `section`               | `group`      | —                           |
| `display`               | `display`    | —                           |
| `signature`             | `attachment` | — (signatureRequired ext)   |
| `diagram`               | `attachment` | —                           |

## Extension Handling

### itemControl Extension

The `questionnaire-itemControl` extension determines how choice fields render:

```typescript
const item = {
  linkId: 'priority',
  type: 'choice',
  extension: [
    {
      url: 'http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl',
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://hl7.org/fhir/questionnaire-item-control',
            code: 'drop-down', // or 'radio-button', 'check-box', 'autocomplete'
          },
        ],
      },
    },
  ],
};
```

### Validation Extensions

The adapter extracts and preserves these validation extensions:

| Extension URL | Purpose                  | Stored in               |
| ------------- | ------------------------ | ----------------------- |
| `minValue`    | Minimum allowed value    | `_sourceData.minValue`  |
| `maxValue`    | Maximum allowed value    | `_sourceData.maxValue`  |
| `minLength`   | Minimum string length    | `_sourceData.minLength` |
| `regex`       | Regex validation pattern | `_sourceData.regex`     |

```typescript
const form = importFromFhir(questionnaire);
const field = form.fields[0];

if (field._sourceData?.minValue !== undefined) {
  // Apply validation: value >= minValue
}
```

### Option Scoring (ordinalValue)

Scores from `ordinalValue` extensions on answerOptions map to `FieldOption.score`:

```typescript
const item = {
  linkId: 'pain-level',
  type: 'choice',
  answerOption: [
    {
      valueCoding: { code: 'mild', display: 'Mild' },
      extension: [
        {
          url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue',
          valueDecimal: 1,
        },
      ],
    },
    {
      valueCoding: { code: 'severe', display: 'Severe' },
      extension: [
        {
          url: 'http://hl7.org/fhir/StructureDefinition/ordinalValue',
          valueDecimal: 10,
        },
      ],
    },
  ],
};

// Converts to:
// options: [{ id: 'mild', value: 'mild', text: 'Mild', score: 1 }, ...]
```

### eSheet Layout Extensions

eSheet adds two custom extensions to preserve its layout model in FHIR exports. See [Extensions](./extensions.md) for the full specification.

| Extension                | `valueCode`                 | Applies to               |
| ------------------------ | --------------------------- | ------------------------ |
| `FHIR_EXT.FIELD_WIDTH`   | `full` \| `half` \| `third` | All answer-bearing items |
| `FHIR_EXT.OPTION_LAYOUT` | `stack` \| `wrap`           | `choice` items           |

### Supported Extension URLs

```typescript
import { FHIR_EXT } from '@esheet/adapters';

FHIR_EXT.ITEM_CONTROL; // questionnaire-itemControl
FHIR_EXT.MIN_VALUE; // minValue
FHIR_EXT.MAX_VALUE; // maxValue
FHIR_EXT.MIN_LENGTH; // minLength
FHIR_EXT.REGEX; // regex
FHIR_EXT.ORDINAL_VALUE; // ordinalValue
FHIR_EXT.HIDDEN; // questionnaire-hidden
FHIR_EXT.SLIDER_STEP; // questionnaire-sliderStepValue
FHIR_EXT.SIGNATURE_REQUIRED; // questionnaire-signatureRequired

// SDC / DTR Extensions
FHIR_EXT.INITIAL_EXPRESSION; // sdc-questionnaire-initialExpression
FHIR_EXT.CALCULATED_EXPRESSION; // sdc-questionnaire-calculatedExpression
FHIR_EXT.ENABLE_WHEN_EXPRESSION; // sdc-questionnaire-enableWhenExpression
FHIR_EXT.VARIABLE; // variable

// eSheet Layout Extensions
FHIR_EXT.FIELD_WIDTH; // field-width
FHIR_EXT.OPTION_LAYOUT; // option-layout
```

## Metadata Preservation

### FhirFieldMeta

Field-level FHIR metadata preserved in `_sourceData`:

```typescript
interface FhirFieldMeta {
  definition?: string; // Element definition URL
  code?: FhirCoding[]; // Semantic codes
  prefix?: string; // Numbering prefix ("1.", "a)")
  readOnly?: boolean; // Read-only flag
  repeats?: boolean; // Repeating item flag
  fhirItemType?: string; // Original FHIR type
  fhirExtensions?: FhirExtension[]; // All preserved extensions

  // Validation
  minValue?: number | string;
  maxValue?: number | string;
  minLength?: number;
  regex?: string;

  // DTR expressions (preserved, not evaluated)
  initialExpression?: FhirExpression;
  calculatedExpression?: FhirExpression;
  enableWhenExpression?: FhirExpression;
}
```

### FhirFormMeta

Form-level FHIR metadata preserved in `_sourceData`:

```typescript
interface FhirFormMeta {
  url?: string; // Canonical URL
  version?: string; // Semantic version
  name?: string; // Computer-friendly name
  status?: string; // Publication status
  publisher?: string; // Publisher organization
  date?: string; // Publication date
  subjectType?: string[]; // Allowed subject types
  derivedFrom?: string[]; // Parent questionnaires
  code?: FhirCoding[]; // Form-level codes
  fhirExtensions?: FhirExtension[]; // Form-level extensions
  _conversionWarnings?: ImportWarning[]; // Conversion warnings
}
```

## Warning System

The adapter tracks potentially lossy conversions via warnings:

```typescript
const form = importFromFhir(questionnaire);
const meta = form._sourceData as FhirFormMeta;

if (meta._conversionWarnings) {
  for (const warning of meta._conversionWarnings) {
    console.warn(`${warning.code} at ${warning.path}: ${warning.message}`);
  }
}
```

### Warning Codes

| Code                       | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `UNSUPPORTED_TYPE`         | FHIR type converted to text field (reference, quantity) |
| `VALUESET_NOT_EXPANDED`    | `answerValueSet` reference not expanded — options empty |
| `EXPRESSION_PRESERVED`     | FHIRPath/CQL expression preserved but not evaluated     |
| `NESTED_ANSWERS_FLATTENED` | Nested answer structure flattened                       |
| `EXTENSION_PRESERVED`      | Unknown extension preserved in `_sourceData`            |
| `REPEAT_NOT_SUPPORTED`     | `repeats` on non-choice field ignored                   |

## Conditional Logic (enableWhen)

### Import: enableWhen → rules

FHIR `enableWhen` conditions convert to eSheet visibility rules:

```typescript
// FHIR enableWhen
const item = {
  linkId: 'pregnancy-details',
  type: 'text',
  enableWhen: [
    { question: 'is-pregnant', operator: '=', answerBoolean: true },
  ],
};

// Converts to eSheet rule:
{
  effect: 'visible',
  logic: 'AND',
  conditions: [{
    conditionType: 'field',
    targetId: 'is-pregnant',
    operator: 'equals',
    expected: 'true',
  }],
}
```

### Operator Mapping

| FHIR Operator    | eSheet Operator      |
| ---------------- | -------------------- |
| `=`              | `equals`             |
| `!=`             | `notEquals`          |
| `>`              | `greaterThan`        |
| `>=`             | `greaterThanOrEqual` |
| `<`              | `lessThan`           |
| `<=`             | `lessThanOrEqual`    |
| `exists` (true)  | `notEmpty`           |
| `exists` (false) | `empty`              |

### enableBehavior

| FHIR enableBehavior | eSheet logic |
| ------------------- | ------------ |
| `all` (default)     | `AND`        |
| `any`               | `OR`         |

### Export: rules → enableWhen

Only `visible` effect rules export back to enableWhen. Other effects (`enable`, `required`) are not supported in standard FHIR and are preserved in `_sourceData`.

## DTR Profile Support

For Da Vinci DTR (Documentation Templates and Rules) compliance:

```typescript
const fhirQuestionnaire = exportToFhir(formDefinition, {
  dtrCompliant: true,
  canonicalUrl: 'https://example.org/fhir',
});
// Sets subjectType: ['Patient'] and applies DTR constraints
```

### DTR Extensions Preserved

The adapter preserves these SDC/DTR extensions in `_sourceData` without evaluation:

- `initialExpression` — FHIRPath expression for initial value
- `calculatedExpression` — FHIRPath expression for calculated value
- `enableWhenExpression` — FHIRPath expression for visibility
- `variable` — Named FHIRPath expressions

These expressions require a FHIRPath evaluation engine to execute at runtime.
