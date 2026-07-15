/**
 * Convert SurveyJS schema to eSheet FormDefinition.
 *
 * SurveyJS is well-known with lots of training data, so AI models
 * generate better SurveyJS output. We leverage this by having AI
 * generate SurveyJS, then converting to eSheet format.
 */

import type {
  FormDefinition,
  FieldDefinition,
  FieldOption,
  MatrixRow,
  MatrixColumn,
  ConditionalRule,
  Condition,
} from '@esheet/core';

// ---------------------------------------------------------------------------
// SurveyJS Types (minimal subset we support)
// ---------------------------------------------------------------------------

interface SurveyJSChoice {
  value: string;
  text?: string;
  score?: number;
}

interface SurveyJSMatrixItem {
  value: string;
  text?: string;
  score?: number;
}

interface SurveyJSMultipleTextItem {
  name: string;
  title?: string;
  isRequired?: boolean;
  inputType?: string;
  placeholder?: string;
}

interface SurveyJSElement {
  type: string;
  name: string;
  title?: string;
  description?: string;
  isRequired?: boolean;
  readOnly?: boolean;
  inputType?: string;
  choices?: (string | SurveyJSChoice)[];
  rows?: (string | SurveyJSMatrixItem)[];
  columns?: (string | SurveyJSMatrixItem)[];
  visibleIf?: string;
  enableIf?: string;
  requiredIf?: string;
  elements?: SurveyJSElement[];
  // HTML/Image/Expression
  html?: string;
  imageLink?: string;
  altText?: string;
  expression?: string;
  // Text/input options
  placeholder?: string;
  defaultValue?: unknown;
  defaultValueExpression?: string;
  min?: number | string;
  max?: number | string;
  step?: number;
  // Rating-specific
  rateMin?: number;
  rateMax?: number;
  rateStep?: number;
  minRateDescription?: string;
  maxRateDescription?: string;
  // Choice extras
  showOtherItem?: boolean;
  otherText?: string;
  showNoneItem?: boolean;
  noneText?: string;
  showSelectAllItem?: boolean;
  selectAllText?: string;
  storeOthersAsComment?: boolean;
  colCount?: number;
  // File upload
  allowMultiple?: boolean;
  acceptedTypes?: string;
  // multipletext items
  items?: SurveyJSMultipleTextItem[];
}

interface SurveyJSPage {
  name?: string;
  title?: string;
  elements?: SurveyJSElement[];
}

interface SurveyJSSchemaMeta {
  locale?: string;
  logo?: string;
  logoPosition?: string;
  showProgressBar?: string;
  progressBarType?: string;
  completedHtml?: string;
  showQuestionNumbers?: string | boolean;
  questionTitleLocation?: string;
  calculatedValues?: unknown[];
  triggers?: unknown[];
}

interface SurveyJSSchema extends SurveyJSSchemaMeta {
  title?: string;
  description?: string;
  pages?: SurveyJSPage[];
  elements?: SurveyJSElement[];
}

// ---------------------------------------------------------------------------
// _sourceData bag — stored during import for lossless round-trip export
// ---------------------------------------------------------------------------

interface SurveyJSFieldMeta {
  /** Original SurveyJS element type (e.g. 'matrixdynamic', 'radiogroup'). */
  surveyType: string;
  /** Original camelCase name before kebab-case conversion. */
  surveyName: string;
  /** Original conditional expressions — restored verbatim on export. */
  visibleIf?: string;
  enableIf?: string;
  requiredIf?: string;
  // Extra element props preserved for round-trip
  placeholder?: string;
  defaultValue?: unknown;
  defaultValueExpression?: string;
  min?: number | string;
  max?: number | string;
  step?: number;
  rateMin?: number;
  rateMax?: number;
  rateStep?: number;
  minRateDescription?: string;
  maxRateDescription?: string;
  showOtherItem?: boolean;
  otherText?: string;
  showNoneItem?: boolean;
  noneText?: string;
  showSelectAllItem?: boolean;
  selectAllText?: string;
  storeOthersAsComment?: boolean;
  colCount?: number;
  allowMultiple?: boolean;
  acceptedTypes?: string;
}

// ---------------------------------------------------------------------------
// Type Mapping
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, FieldDefinition['fieldType']> = {
  text: 'text',
  comment: 'longtext',
  radiogroup: 'radio',
  checkbox: 'check',
  dropdown: 'dropdown',
  tagbox: 'multiselectdropdown',
  select: 'openchoice',
  boolean: 'boolean',
  rating: 'rating',
  ranking: 'ranking',
  matrix: 'singlematrix',
  matrixdropdown: 'multimatrix',
  matrixdynamic: 'multimatrix',
  signaturepad: 'signature',
  image: 'image',
  html: 'html',
  expression: 'html',
  imagepicker: 'radio',
  file: 'file',
  panel: 'section',
  paneldynamic: 'section',
  multipletext: 'multitext',
};

/**
 * Map SurveyJS inputType values to eSheet TextInputType.
 * eSheet supports: string, number, email, tel, date, datetime-local, month, time, url
 */
type TextInputType =
  | 'string'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'datetime-local'
  | 'month'
  | 'time'
  | 'url';

const INPUT_TYPE_MAP: Record<string, TextInputType> = {
  // Direct matches
  text: 'string',
  string: 'string',
  number: 'number',
  email: 'email',
  tel: 'tel',
  date: 'date',
  'datetime-local': 'datetime-local',
  month: 'month',
  time: 'time',
  url: 'url',
  // SurveyJS aliases
  color: 'string',
  password: 'string',
  range: 'number',
  week: 'date',
  datetime: 'datetime-local',
  datetimelocal: 'datetime-local',
};

function mapInputType(surveyInputType?: unknown): TextInputType {
  if (typeof surveyInputType !== 'string') return 'string';
  const normalized = surveyInputType.toLowerCase().replace(/[_\s]/g, '');
  return INPUT_TYPE_MAP[normalized] ?? 'string';
}

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

function toKebabCase(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function convertChoice(
  choice: string | SurveyJSChoice,
  index: number
): FieldOption {
  if (typeof choice === 'string') {
    return { id: toKebabCase(choice) || `opt-${index}`, value: choice };
  }
  const opt: FieldOption = {
    id: toKebabCase(choice.value) || `opt-${index}`,
    value: choice.value,
    text: choice.text,
  };
  if (choice.score !== undefined) {
    opt.score = choice.score;
  }
  return opt;
}

function convertMatrixRow(
  item: string | SurveyJSMatrixItem,
  index: number
): MatrixRow {
  if (typeof item === 'string') {
    return { id: toKebabCase(item) || `item-${index}`, value: item };
  }
  return {
    id: toKebabCase(item.value) || `item-${index}`,
    value: item.text ?? item.value,
  };
}

function convertMatrixColumn(
  item: string | SurveyJSMatrixItem,
  index: number
): MatrixColumn {
  if (typeof item === 'string') {
    return { id: toKebabCase(item) || `item-${index}`, value: item };
  }
  const col: MatrixColumn = {
    id: toKebabCase(item.value) || `item-${index}`,
    value: item.text ?? item.value,
  };
  if (item.score !== undefined) {
    col.score = item.score;
  }
  return col;
}

/**
 * Parse SurveyJS visibleIf expression into eSheet rules.
 *
 * Simple expressions like `{gender} = 'female'` become field conditions.
 * Complex expressions with arithmetic or multiple fields become expression conditions.
 */
function parseVisibleIf(
  expr: unknown,
  effect: 'visible' | 'enable' | 'required'
): ConditionalRule | null {
  if (typeof expr !== 'string') return null;
  const trimmed = expr.trim();
  if (!trimmed) return null;

  // Count field references - if more than one, it's a complex expression
  const fieldRefs = trimmed.match(/\{[^}]+\}/g) ?? [];

  // Check for arithmetic operators between field refs
  const hasArithmetic = /\{[^}]+\}\s*[+\-*/]\s*\{/.test(trimmed);

  // Simple pattern: {fieldName} op 'value' (single field, no arithmetic)
  if (fieldRefs.length === 1 && !hasArithmetic) {
    // Note: >= and <= must come before > and < in the alternation (regex is first-match)
    const simpleMatch = trimmed.match(
      /^\{([^}]+)\}\s*(==|!=|<>|>=|<=|=|>|<|empty|notempty)\s*'?([^']*)'?$/i
    );
    if (simpleMatch) {
      const [, targetId, op, rawExpected] = simpleMatch;
      const expected = rawExpected.trim();

      const operatorMap: Record<string, Condition['operator']> = {
        '==': 'equals',
        '!=': 'notEquals',
        '<>': 'notEquals',
        '>=': 'greaterThanOrEqual',
        '<=': 'lessThanOrEqual',
        '=': 'equals',
        '>': 'greaterThan',
        '<': 'lessThan',
        empty: 'empty',
        notempty: 'notEmpty',
      };

      const operator = operatorMap[op.toLowerCase()] ?? 'equals';

      // Normalize expected value for boolean comparisons
      // SurveyJS uses true/false, eSheet uses yes/no option IDs
      let normalizedExpected = expected;
      if (operator === 'empty' || operator === 'notEmpty') {
        normalizedExpected = '';
      } else if (expected.toLowerCase() === 'true') {
        normalizedExpected = 'yes';
      } else if (expected.toLowerCase() === 'false') {
        normalizedExpected = 'no';
      }

      const condition: Condition = {
        conditionType: 'field',
        targetId: toKebabCase(targetId),
        operator,
        expected: normalizedExpected,
      };

      return {
        effect,
        logic: 'AND',
        conditions: [condition],
      };
    }
  }

  // Complex expression: use expression condition type
  // Convert SurveyJS field syntax {fieldName} to eSheet syntax
  const eSheetExpr = trimmed.replace(
    /\{([^}]+)\}/g,
    (_, fieldName: string) => `{${toKebabCase(fieldName)}}`
  );

  return {
    effect,
    logic: 'AND',
    conditions: [
      {
        conditionType: 'expression',
        expression: eSheetExpr,
      },
    ],
  };
}

function convertElement(
  element: SurveyJSElement,
  ancestorIds: ReadonlySet<string> = new Set()
): FieldDefinition {
  const fieldType = TYPE_MAP[element.type] ?? 'text';
  const id = toKebabCase(element.name);

  // Preserve original SurveyJS metadata for lossless round-trip export.
  const _sourceData: SurveyJSFieldMeta = {
    surveyType: element.type,
    surveyName: element.name,
    ...(element.visibleIf ? { visibleIf: element.visibleIf } : {}),
    ...(element.enableIf ? { enableIf: element.enableIf } : {}),
    ...(element.requiredIf ? { requiredIf: element.requiredIf } : {}),
    ...(element.placeholder !== undefined
      ? { placeholder: element.placeholder }
      : {}),
    ...(element.defaultValue !== undefined
      ? { defaultValue: element.defaultValue }
      : {}),
    ...(element.defaultValueExpression !== undefined
      ? { defaultValueExpression: element.defaultValueExpression }
      : {}),
    ...(element.min !== undefined ? { min: element.min } : {}),
    ...(element.max !== undefined ? { max: element.max } : {}),
    ...(element.step !== undefined ? { step: element.step } : {}),
    ...(element.rateMin !== undefined ? { rateMin: element.rateMin } : {}),
    ...(element.rateMax !== undefined ? { rateMax: element.rateMax } : {}),
    ...(element.rateStep !== undefined ? { rateStep: element.rateStep } : {}),
    ...(element.minRateDescription !== undefined
      ? { minRateDescription: element.minRateDescription }
      : {}),
    ...(element.maxRateDescription !== undefined
      ? { maxRateDescription: element.maxRateDescription }
      : {}),
    ...(element.showOtherItem !== undefined
      ? { showOtherItem: element.showOtherItem }
      : {}),
    ...(element.otherText !== undefined
      ? { otherText: element.otherText }
      : {}),
    ...(element.showNoneItem !== undefined
      ? { showNoneItem: element.showNoneItem }
      : {}),
    ...(element.noneText !== undefined ? { noneText: element.noneText } : {}),
    ...(element.showSelectAllItem !== undefined
      ? { showSelectAllItem: element.showSelectAllItem }
      : {}),
    ...(element.selectAllText !== undefined
      ? { selectAllText: element.selectAllText }
      : {}),
    ...(element.storeOthersAsComment !== undefined
      ? { storeOthersAsComment: element.storeOthersAsComment }
      : {}),
    ...(element.colCount !== undefined ? { colCount: element.colCount } : {}),
    ...(element.allowMultiple !== undefined
      ? { allowMultiple: element.allowMultiple }
      : {}),
    ...(element.acceptedTypes !== undefined
      ? { acceptedTypes: element.acceptedTypes }
      : {}),
  };

  // Build rules from visibleIf/enableIf/requiredIf
  const rules: ConditionalRule[] = [];
  if (element.visibleIf) {
    const rule = parseVisibleIf(element.visibleIf, 'visible');
    if (rule) rules.push(rule);
  }
  if (element.enableIf) {
    const rule = parseVisibleIf(element.enableIf, 'enable');
    if (rule) rules.push(rule);
  }
  if (element.requiredIf) {
    const rule = parseVisibleIf(element.requiredIf, 'required');
    if (rule) rules.push(rule);
  }

  // Base field
  const base = {
    id,
    question: element.title ?? element.name,
    required: element.isRequired ?? false,
    rules,
    _sourceData,
  };

  // Type-specific properties
  switch (fieldType) {
    case 'text':
      return {
        ...base,
        fieldType: 'text',
        inputType: mapInputType(element.inputType),
      };

    case 'longtext':
      return {
        ...base,
        fieldType: 'longtext',
        inputType: 'string',
      };

    case 'radio':
    case 'dropdown':
    case 'check':
    case 'multiselectdropdown':
      return {
        ...base,
        fieldType,
        options: (element.choices ?? []).map(convertChoice),
      } as FieldDefinition;

    case 'boolean':
      return {
        ...base,
        fieldType: 'boolean',
        options: [
          { id: 'yes', value: 'Yes' },
          { id: 'no', value: 'No' },
        ],
      };

    case 'rating': {
      let options: FieldOption[];
      if (element.choices && element.choices.length > 0) {
        options = element.choices.map(convertChoice);
      } else {
        // Generate from rateMin/rateMax/rateStep
        const min = typeof element.rateMin === 'number' ? element.rateMin : 1;
        const max = typeof element.rateMax === 'number' ? element.rateMax : 5;
        const step =
          typeof element.rateStep === 'number' && element.rateStep > 0
            ? element.rateStep
            : 1;
        options = [];
        for (let n = min; n <= max; n += step) {
          options.push({ id: String(n), value: String(n) });
        }
      }
      return { ...base, fieldType: 'rating', options };
    }

    case 'ranking':
      return {
        ...base,
        fieldType: 'ranking',
        options: (element.choices ?? []).map(convertChoice),
      };

    case 'singlematrix':
    case 'multimatrix': {
      const rows = (element.rows ?? []).map(convertMatrixRow);
      const columns = (element.columns ?? []).map(convertMatrixColumn);
      // Check if any column has an explicit score
      const hasScores = columns.some((col) => col.score !== undefined);
      return {
        ...base,
        fieldType,
        rows,
        columns,
        // Enable scored mode if any column has scores
        ...(hasScores ? { scored: true } : {}),
      } as FieldDefinition;
    }

    case 'signature':
      return {
        ...base,
        fieldType: 'signature',
      };

    case 'file': {
      const fileField: FieldDefinition = {
        ...base,
        fieldType: 'file' as const,
      };
      // Preserve file-specific metadata
      if (element.acceptedTypes !== undefined) {
        (fileField as unknown as Record<string, unknown>).accept =
          element.acceptedTypes;
      }
      if (element.allowMultiple !== undefined) {
        (fileField as unknown as Record<string, unknown>).maxFiles =
          element.allowMultiple ? undefined : 1;
      }
      return fileField;
    }

    case 'openchoice': {
      return {
        ...base,
        fieldType: 'openchoice',
        options: (element.choices ?? []).map(convertChoice),
        ...(element.otherText
          ? { otherLabel: element.otherText }
          : { otherLabel: 'Other, please specify' }),
      };
    }

    case 'image':
      return {
        ...base,
        fieldType: 'image',
        imageUri: element.imageLink ?? '',
        altText: element.altText,
      };

    case 'html':
      return {
        ...base,
        fieldType: 'html',
        // 'expression' type: render the expression string as HTML placeholder
        htmlContent:
          element.type === 'expression'
            ? element.expression ?? ''
            : element.html ?? '',
      };

    case 'multitext':
      return {
        ...base,
        fieldType: 'multitext',
        options: (element.items ?? []).map((item, idx) => ({
          id: toKebabCase(item.name) || `item-${idx}`,
          value: item.name,
          text: item.title ?? item.name,
        })),
      };

    case 'section': {
      // Guard against circular nesting (AI can generate panels referencing ancestor IDs)
      if (ancestorIds.has(id)) {
        return { ...base, fieldType: 'text', inputType: 'string' };
      }
      const childAncestors = new Set(ancestorIds).add(id);
      return {
        ...base,
        fieldType: 'section',
        title: element.title ?? element.name,
        fields: (element.elements ?? []).map((el) =>
          convertElement(el, childAncestors)
        ),
      };
    }

    default:
      return {
        ...base,
        fieldType: 'text',
        inputType: 'string',
      };
  }
}

/**
 * Convert a SurveyJS schema to eSheet FormDefinition.
 */
export function convertSurveyJSToESheet(
  survey: SurveyJSSchema
): FormDefinition {
  // Collect survey-level metadata for round-trip fidelity
  const surveyMeta: SurveyJSSchemaMeta = {};
  if (survey.locale !== undefined) surveyMeta.locale = survey.locale;
  if (survey.logo !== undefined) surveyMeta.logo = survey.logo;
  if (survey.logoPosition !== undefined)
    surveyMeta.logoPosition = survey.logoPosition;
  if (survey.showProgressBar !== undefined)
    surveyMeta.showProgressBar = survey.showProgressBar;
  if (survey.progressBarType !== undefined)
    surveyMeta.progressBarType = survey.progressBarType;
  if (survey.completedHtml !== undefined)
    surveyMeta.completedHtml = survey.completedHtml;
  if (survey.showQuestionNumbers !== undefined)
    surveyMeta.showQuestionNumbers = survey.showQuestionNumbers;
  if (survey.questionTitleLocation !== undefined)
    surveyMeta.questionTitleLocation = survey.questionTitleLocation;
  if (survey.calculatedValues !== undefined)
    surveyMeta.calculatedValues = survey.calculatedValues;
  if (survey.triggers !== undefined) surveyMeta.triggers = survey.triggers;
  const hasSurveyMeta = Object.keys(surveyMeta).length > 0;

  const base = {
    id: toKebabCase(survey.title ?? 'form'),
    title: survey.title ?? 'Untitled Form',
    description: survey.description,
    ...(hasSurveyMeta ? { _sourceData: { surveyMeta } } : {}),
  };

  // Map SurveyJS pages directly to eSheet pages.
  if (survey.pages && survey.pages.length > 0) {
    const pages = survey.pages
      .filter((page) => page.elements && page.elements.length > 0)
      .map((page, i) => {
        const pageId = toKebabCase(page.name ?? page.title ?? `page-${i + 1}`);
        const pageAncestors = new Set([pageId]);
        return {
          id: pageId,
          ...(page.title ? { title: page.title } : {}),
          fields: page.elements!.map((el) => convertElement(el, pageAncestors)),
        };
      });
    return { ...base, pages };
  }

  // Top-level elements (no pages) — wrap in a single page.
  if (survey.elements) {
    return {
      ...base,
      pages: [
        {
          id: 'page-1',
          fields: survey.elements.map((el) => convertElement(el)),
        },
      ],
    };
  }

  return { ...base, pages: [] };
}

/**
 * System prompt for generating SurveyJS format.
 * AI models have better training data for SurveyJS.
 */
export const SURVEYJS_SYSTEM_PROMPT = `You are an expert form designer. Output ONLY a valid SurveyJS JSON schema — no markdown, no explanation, no code blocks, raw JSON only. STRUCTURE: {"title":"...","pages":[{"name":"page1","title":"...","elements":[...]}]} FIELD TYPES — always pick most specific: short text→text (add inputType:"email"/"tel"/"date"/"number"/"url"), long text→comment, single choice→radiogroup (NOT text), multiple choice→checkbox (NOT text), long list single→dropdown, long list multi→tagbox, yes/no→boolean (NOT radiogroup), 1-N scale→rating (set rateMin/rateMax/minRateDescription/maxRateDescription), ordered preference→ranking, grid single answer→matrix (rows=items columns=scale labels), grid multi answer→matrixdropdown, signature→signaturepad (NEVER use text), file upload→file, image pick→imagepicker, multiple short inputs→multipletext. RULES: use pages only to group related fields — never use panel type; every page must have a title; add "isRequired":true on important fields; use "visibleIf" for follow-up questions: "{field} = 'value'"; choices format: [{"value":"id","text":"Label"}]. For scored surveys: use numeric strings as column values ("0","1","2","3"), add calculatedValues at top level. OUTPUT: raw JSON only, no prose.`;

// ---------------------------------------------------------------------------
// Export: FormDefinition → SurveyJS schema
// ---------------------------------------------------------------------------

const FIELD_TYPE_TO_SURVEY: Partial<
  Record<FieldDefinition['fieldType'], string>
> = {
  text: 'text',
  longtext: 'comment',
  radio: 'radiogroup',
  check: 'checkbox',
  dropdown: 'dropdown',
  multiselectdropdown: 'tagbox',
  boolean: 'boolean',
  rating: 'rating',
  ranking: 'ranking',
  singlematrix: 'matrix',
  multimatrix: 'matrixdropdown',
  signature: 'signaturepad',
  image: 'image',
  html: 'html',
  multitext: 'multipletext',
  section: 'panel',
};

const ESHEET_INPUT_TO_SURVEY: Partial<Record<string, string>> = {
  string: 'text',
  number: 'number',
  email: 'email',
  tel: 'tel',
  date: 'date',
  'datetime-local': 'datetime-local',
  month: 'month',
  time: 'time',
  url: 'url',
};

const OPERATOR_TO_SURVEY: Partial<Record<string, string>> = {
  equals: '=',
  notEquals: '<>',
  greaterThan: '>',
  lessThan: '<',
  greaterThanOrEqual: '>=',
  lessThanOrEqual: '<=',
  empty: 'empty',
  notEmpty: 'notempty',
};

function conditionToSurveyExpr(condition: Condition): string {
  if (condition.conditionType === 'expression') {
    return condition.expression ?? '';
  }
  const op = OPERATOR_TO_SURVEY[condition.operator ?? 'equals'] ?? '=';
  if (op === 'empty' || op === 'notempty') {
    return `{${condition.targetId}} ${op}`;
  }
  return `{${condition.targetId}} ${op} '${condition.expected}'`;
}

function ruleToSurveyExpr(rule: ConditionalRule): string {
  const sep = rule.logic === 'OR' ? ' or ' : ' and ';
  return rule.conditions.map(conditionToSurveyExpr).join(sep);
}

function fieldToSurveyElement(field: FieldDefinition): SurveyJSElement {
  const meta = field._sourceData as SurveyJSFieldMeta | null | undefined;

  // Restore original SurveyJS name if available; otherwise convert id back
  const name = meta?.surveyName ?? field.id;
  // Restore original SurveyJS type if available; otherwise use reverse map
  const type =
    meta?.surveyType ?? FIELD_TYPE_TO_SURVEY[field.fieldType] ?? 'text';

  const el: SurveyJSElement = { type, name };
  const q = (field as { question?: string }).question;
  if (q !== undefined) el.title = q;
  if (field.required) el.isRequired = true;
  if ((field as unknown as { readOnly?: boolean }).readOnly) {
    el.readOnly = true;
  }

  // Restore conditional expressions verbatim from _sourceData for lossless round-trip.
  // Fall back to re-constructing from parsed rules.
  const visibleRule = field.rules?.find((r) => r.effect === 'visible');
  const enableRule = field.rules?.find((r) => r.effect === 'enable');
  const requiredRule = field.rules?.find((r) => r.effect === 'required');

  if (meta?.visibleIf) el.visibleIf = meta.visibleIf;
  else if (visibleRule) el.visibleIf = ruleToSurveyExpr(visibleRule);

  if (meta?.enableIf) el.enableIf = meta.enableIf;
  else if (enableRule) el.enableIf = ruleToSurveyExpr(enableRule);

  if (meta?.requiredIf) el.requiredIf = meta.requiredIf;
  else if (requiredRule) el.requiredIf = ruleToSurveyExpr(requiredRule);

  // Restore extra element props from _sourceData for round-trip fidelity
  if (meta?.placeholder !== undefined) el.placeholder = meta.placeholder;
  if (meta?.defaultValue !== undefined) el.defaultValue = meta.defaultValue;
  if (meta?.defaultValueExpression !== undefined)
    el.defaultValueExpression = meta.defaultValueExpression;
  if (meta?.min !== undefined) el.min = meta.min;
  if (meta?.max !== undefined) el.max = meta.max;
  if (meta?.step !== undefined) el.step = meta.step;
  if (meta?.rateMin !== undefined) el.rateMin = meta.rateMin;
  if (meta?.rateMax !== undefined) el.rateMax = meta.rateMax;
  if (meta?.rateStep !== undefined) el.rateStep = meta.rateStep;
  if (meta?.minRateDescription !== undefined)
    el.minRateDescription = meta.minRateDescription;
  if (meta?.maxRateDescription !== undefined)
    el.maxRateDescription = meta.maxRateDescription;
  if (meta?.showOtherItem !== undefined) el.showOtherItem = meta.showOtherItem;
  if (meta?.otherText !== undefined) el.otherText = meta.otherText;
  if (meta?.showNoneItem !== undefined) el.showNoneItem = meta.showNoneItem;
  if (meta?.noneText !== undefined) el.noneText = meta.noneText;
  if (meta?.showSelectAllItem !== undefined)
    el.showSelectAllItem = meta.showSelectAllItem;
  if (meta?.selectAllText !== undefined) el.selectAllText = meta.selectAllText;
  if (meta?.storeOthersAsComment !== undefined)
    el.storeOthersAsComment = meta.storeOthersAsComment;
  if (meta?.colCount !== undefined) el.colCount = meta.colCount;
  if (meta?.allowMultiple !== undefined) el.allowMultiple = meta.allowMultiple;
  if (meta?.acceptedTypes !== undefined) el.acceptedTypes = meta.acceptedTypes;

  // Type-specific properties
  switch (field.fieldType) {
    case 'text':
    case 'longtext': {
      const inputType = field.inputType;
      if (inputType && inputType !== 'string') {
        el.inputType = ESHEET_INPUT_TO_SURVEY[inputType] ?? inputType;
      }
      break;
    }
    case 'radio':
    case 'check':
    case 'dropdown':
    case 'multiselectdropdown':
    case 'ranking':
    case 'rating':
    case 'openchoice':
      el.choices = (field.options ?? []).map((o) =>
        o.text !== undefined
          ? {
              value: o.value,
              text: o.text,
              ...(o.score !== undefined ? { score: o.score } : {}),
            }
          : o.value
      );
      break;

    case 'file': {
      const fileField = field as unknown as Record<string, unknown>;
      if (fileField.accept) el.acceptedTypes = fileField.accept as string;
      if (fileField.maxFiles)
        el.allowMultiple = (fileField.maxFiles as number) > 1;
      break;
    }

    case 'singlematrix':
    case 'multimatrix':
      el.rows = (field.rows ?? []).map((r) => ({ value: r.id, text: r.value }));
      el.columns = (field.columns ?? []).map((c) => ({
        value: c.id,
        text: c.value,
        ...(c.score !== undefined ? { score: c.score } : {}),
      }));
      break;
    case 'image':
      if (field.imageUri) el.imageLink = field.imageUri;
      if (field.altText) el.altText = field.altText;
      break;
    case 'html':
      // expression type: restore expression property instead of html
      if (type === 'expression') {
        el.expression = field.htmlContent ?? '';
      } else {
        el.html = field.htmlContent ?? '';
      }
      break;
    case 'multitext':
      el.items = (field.options ?? []).map((o) => ({
        name: o.value,
        title: o.text ?? o.value,
      }));
      break;
    case 'section':
      el.elements = (field.fields ?? []).map(fieldToSurveyElement);
      break;
  }

  return el;
}

/**
 * Convert an eSheet FormDefinition back to a SurveyJS schema.
 *
 * Preserves original SurveyJS element names, types, and conditional expressions
 * stored in `_sourceData` during import, enabling a lossless round-trip.
 * Fields without `_sourceData` are reverse-mapped from eSheet types.
 *
 * Section fields become pages; non-section fields are placed in a single page.
 * First-class `pages` entries are mapped directly to SurveyJS pages.
 */
export function exportToSurveyJS(form: FormDefinition): SurveyJSSchema {
  // Restore survey-level metadata preserved during import
  const surveyMeta =
    (form._sourceData as { surveyMeta?: SurveyJSSchemaMeta } | null)
      ?.surveyMeta ?? {};

  const base = {
    title: form.title,
    ...(form.description ? { description: form.description } : {}),
    ...surveyMeta,
  };

  // First-class pages format — map each eSheet page directly to a SurveyJS page.
  if (form.pages && form.pages.length > 0) {
    const pages: SurveyJSPage[] = form.pages.map((page) => ({
      name: page.id,
      ...(page.title ? { title: page.title } : {}),
      elements: (page.fields ?? []).map(fieldToSurveyElement),
    }));
    return { ...base, pages };
  }

  const fields = form.pages.flatMap((p) => p.fields ?? []);
  const hasSections = fields.some((f) => f.fieldType === 'section');

  if (hasSections) {
    // Each top-level section becomes a page; non-section fields go into a leading page.
    const pages: SurveyJSPage[] = [];
    const topLevelFields = fields.filter((f) => f.fieldType !== 'section');
    if (topLevelFields.length > 0) {
      pages.push({
        name: 'page1',
        elements: topLevelFields.map(fieldToSurveyElement),
      });
    }
    for (const field of fields) {
      if (field.fieldType !== 'section') continue;
      const meta = field._sourceData as SurveyJSFieldMeta | null | undefined;
      pages.push({
        name: meta?.surveyName ?? field.id,
        title: field.title ?? field.question,
        elements: (field.fields ?? []).map(fieldToSurveyElement),
      });
    }
    return { ...base, pages };
  }

  // No sections — single page
  return {
    ...base,
    pages: [{ name: 'page1', elements: fields.map(fieldToSurveyElement) }],
  };
}

/**
 * Convert a SurveyJS schema to eSheet FormDefinition.
 * Primary named export matching the importFromMcp / exportToMcp naming convention.
 */
export const importFromSurveyJS = convertSurveyJSToESheet;

/**
 * Convert a SurveyJS schema to eSheet FormDefinition.
 * Alias for importFromSurveyJS / convertSurveyJSToESheet.
 */
export const convertSurveyJS = convertSurveyJSToESheet;

/** Minimal SurveyJS schema shape for detection. */
export interface SurveyJSDetectionSchema {
  pages?: unknown[];
  elements?: unknown[];
}

/**
 * Type guard — returns true if the value looks like a SurveyJS schema
 * (has top-level `pages` or `elements` array but NOT eSheet's `fields` property).
 */
export function isSurveyJSSchema(
  value: unknown
): value is SurveyJSDetectionSchema {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const hasPages = Array.isArray(v['pages']);
  const hasElements = Array.isArray(v['elements']);
  const hasESheetFields = typeof v['fields'] !== 'undefined';
  if ((!hasPages && !hasElements) || hasESheetFields) return false;
  // eSheet pages contain `fields` arrays; SurveyJS pages contain `elements`.
  // If the first page has a `fields` array, this is an eSheet pages-based schema.
  if (hasPages) {
    const pages = v['pages'] as unknown[];
    const firstPage = pages[0];
    if (
      typeof firstPage === 'object' &&
      firstPage !== null &&
      Array.isArray((firstPage as Record<string, unknown>)['fields'])
    ) {
      return false;
    }
  }
  return true;
}
