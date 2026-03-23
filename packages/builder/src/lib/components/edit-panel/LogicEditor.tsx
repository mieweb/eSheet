import React, { useSyncExternalStore } from 'react';
import {
  CONDITION_OPERATORS,
  CONDITIONAL_EFFECTS,
  getFieldTypeMeta,
  isExpressionValid,
  type Condition,
  type ConditionOperator,
  type ConditionalEffect,
  type ConditionalRule,
  type FormStore,
  type LogicMode,
  type NormalizedDefinition,
} from '@esheet/core';
import { TrashIcon, PlusIcon } from '../../icons.js';
import { useInstanceId } from '../../EsheetBuilder.js';

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface LogicEditorProps {
  fieldId: string;
  rules: readonly ConditionalRule[];
  form: FormStore;
}

/**
 * LogicEditor — manage conditional rules (visible / enable / required)
 * for the selected field.
 *
 * Rules are grouped by effect. Multiple rules with the same effect
 * use OR semantics (any rule can trigger the effect). Within a rule,
 * conditions combine with the rule's logic mode (AND / OR).
 */
export function LogicEditor({ fieldId, rules, form }: LogicEditorProps) {
  const instanceId = useInstanceId();

  // Subscribe to the stable normalized reference, then derive target fields
  const normalized = useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().normalized,
    () => form.getState().normalized
  );
  const otherFields = React.useMemo(
    () => buildOtherFields(normalized, fieldId),
    [normalized, fieldId]
  );

  const updateRules = (next: ConditionalRule[]) => {
    form.getState().updateField(fieldId, { rules: next });
  };

  // ── Handlers ────────────────────────────────────────────────
  const handleAddRule = (effect: ConditionalEffect) => {
    // Pick a default target — first available field
    const defaultTarget = otherFields.length > 0 ? otherFields[0].id : '';
    const newRule: ConditionalRule = {
      effect,
      logic: 'AND',
      conditions: [
        {
          conditionType: 'field',
          targetId: defaultTarget,
          operator: 'equals',
          expected: '',
        },
      ],
    };
    updateRules([...rules, newRule]);
  };

  const handleRemoveRule = (ruleIdx: number) => {
    updateRules(rules.filter((_, i) => i !== ruleIdx));
  };

  const handleUpdateRule = (
    ruleIdx: number,
    patch: Partial<ConditionalRule>
  ) => {
    updateRules(rules.map((r, i) => (i === ruleIdx ? { ...r, ...patch } : r)));
  };

  const handleUpdateCondition = (
    ruleIdx: number,
    condIdx: number,
    patch: Partial<Condition>
  ) => {
    updateRules(
      rules.map((r, i) => {
        if (i !== ruleIdx) return r;
        const conditions = r.conditions.map((c, j) =>
          j === condIdx ? { ...c, ...patch } : c
        );
        return { ...r, conditions };
      })
    );
  };

  const handleAddCondition = (ruleIdx: number) => {
    const defaultTarget = otherFields.length > 0 ? otherFields[0].id : '';
    updateRules(
      rules.map((r, i) => {
        if (i !== ruleIdx) return r;
        return {
          ...r,
          conditions: [
            ...r.conditions,
            {
              conditionType: 'field',
              targetId: defaultTarget,
              operator: 'equals' as ConditionOperator,
              expected: '',
            },
          ],
        };
      })
    );
  };

  const handleRemoveCondition = (ruleIdx: number, condIdx: number) => {
    const next = rules.flatMap((r, i) => {
      if (i !== ruleIdx) return [r];
      const conditions = r.conditions.filter((_, j) => j !== condIdx);
      return conditions.length === 0 ? [] : [{ ...r, conditions }];
    });
    updateRules(next);
  };

  // ── Group rules by effect ──────────────────────────────────
  const grouped = groupByEffect(rules);

  if (otherFields.length === 0) {
    return (
      <div className="logic-editor-empty es:text-sm es:text-estextmuted es:text-center es:py-6">
        Add more fields to the form to create logic rules.
      </div>
    );
  }

  return (
    <div className="logic-editor es:space-y-5">
      {CONDITIONAL_EFFECTS.map((effect) => (
        <EffectSection
          key={effect}
          instanceId={instanceId}
          fieldId={fieldId}
          effect={effect}
          ruleEntries={grouped[effect]}
          otherFields={otherFields}
          onAddRule={() => handleAddRule(effect)}
          onRemoveRule={handleRemoveRule}
          onUpdateRule={handleUpdateRule}
          onAddCondition={handleAddCondition}
          onRemoveCondition={handleRemoveCondition}
          onUpdateCondition={handleUpdateCondition}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Effect section — one collapsible group per effect (visible / enable / required)
// ---------------------------------------------------------------------------

interface TargetField {
  id: string;
  label: string;
  fieldType: string;
  hasOptions: boolean;
  options?: readonly { id: string; value: string }[];
  answerType: string;
  supportsNumericCompare: boolean;
}

interface EffectSectionProps {
  instanceId: string;
  fieldId: string;
  effect: ConditionalEffect;
  ruleEntries: { rule: ConditionalRule; globalIdx: number }[];
  otherFields: readonly TargetField[];
  onAddRule: () => void;
  onRemoveRule: (ruleIdx: number) => void;
  onUpdateRule: (ruleIdx: number, patch: Partial<ConditionalRule>) => void;
  onAddCondition: (ruleIdx: number) => void;
  onRemoveCondition: (ruleIdx: number, condIdx: number) => void;
  onUpdateCondition: (
    ruleIdx: number,
    condIdx: number,
    patch: Partial<Condition>
  ) => void;
}

const EFFECT_LABELS: Record<ConditionalEffect, string> = {
  visible: 'Visible',
  enable: 'Enable',
  required: 'Required',
};

const EFFECT_DESCRIPTIONS: Record<ConditionalEffect, string> = {
  visible: 'Show this field when…',
  enable: 'Enable this field when…',
  required: 'Require this field when…',
};

function EffectSection({
  instanceId,
  fieldId,
  effect,
  ruleEntries,
  otherFields,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
}: EffectSectionProps) {
  const hasRules = ruleEntries.length > 0;

  return (
    <div className="effect-section es:space-y-2">
      {/* Header */}
      <div className="effect-header es:flex es:items-center es:justify-between">
        <div>
          <span className="es:text-sm es:font-medium es:text-estext">
            {EFFECT_LABELS[effect]}
          </span>
          <span className="es:text-xs es:text-estextmuted es:ml-2">
            {hasRules
              ? `${ruleEntries.length} rule${ruleEntries.length > 1 ? 's' : ''}`
              : 'Always'}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddRule}
          aria-label={`Add ${effect} rule`}
          className="add-rule-btn es:flex es:items-center es:gap-1 es:px-2 es:py-1 es:text-xs es:font-medium es:bg-transparent es:text-esprimary es:border es:border-esprimary/40 es:rounded es:hover:bg-esprimary/10 es:transition-colors es:outline-none es:focus:outline-none es:cursor-pointer"
        >
          <PlusIcon className="es:w-3 es:h-3" />
          <span>Rule</span>
        </button>
      </div>

      {/* Rules */}
      {ruleEntries.map(({ rule, globalIdx }, localIdx) => (
        <React.Fragment key={globalIdx}>
          {localIdx > 0 && (
            <div className="or-divider es:text-xs es:text-estextmuted es:text-center es:py-0.5">
              — OR —
            </div>
          )}
          <RuleCard
            instanceId={instanceId}
            fieldId={fieldId}
            rule={rule}
            globalIdx={globalIdx}
            otherFields={otherFields}
            onRemove={() => onRemoveRule(globalIdx)}
            onUpdate={(patch) => onUpdateRule(globalIdx, patch)}
            onAddCondition={() => onAddCondition(globalIdx)}
            onRemoveCondition={(condIdx) =>
              onRemoveCondition(globalIdx, condIdx)
            }
            onUpdateCondition={(condIdx, patch) =>
              onUpdateCondition(globalIdx, condIdx, patch)
            }
          />
        </React.Fragment>
      ))}

      {/* Hint when no rules */}
      {!hasRules && (
        <div className="es:text-xs es:text-estextmuted es:italic">
          {EFFECT_DESCRIPTIONS[effect]}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rule card — a single rule with its conditions
// ---------------------------------------------------------------------------

interface RuleCardProps {
  instanceId: string;
  fieldId: string;
  rule: ConditionalRule;
  globalIdx: number;
  otherFields: readonly TargetField[];
  onRemove: () => void;
  onUpdate: (patch: Partial<ConditionalRule>) => void;
  onAddCondition: () => void;
  onRemoveCondition: (condIdx: number) => void;
  onUpdateCondition: (condIdx: number, patch: Partial<Condition>) => void;
}

function RuleCard({
  instanceId,
  fieldId,
  rule,
  globalIdx,
  otherFields,
  onRemove,
  onUpdate,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
}: RuleCardProps) {
  return (
    <div className="rule-card es:border es:border-esborder es:rounded-lg es:bg-essurface es:shadow-sm">
      {/* Rule header — logic toggle + delete */}
      <div className="rule-header es:flex es:items-center es:justify-between es:px-3 es:py-2 es:border-b es:border-esborder es:bg-esbackground es:rounded-t-lg">
        <div className="es:flex es:items-center es:gap-2">
          <span className="es:text-xs es:text-estextmuted">Match</span>
          <LogicToggle
            instanceId={instanceId}
            fieldId={fieldId}
            ruleIdx={globalIdx}
            value={rule.logic}
            onChange={(logic) => onUpdate({ logic })}
          />
          <span className="es:text-xs es:text-estextmuted">
            {rule.logic === 'AND' ? 'all conditions' : 'any condition'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove rule"
          className="remove-rule-btn es:p-1 es:rounded es:bg-transparent es:text-estextmuted es:hover:text-esdanger es:border-0 es:outline-none es:focus:outline-none es:transition-colors es:cursor-pointer"
        >
          <TrashIcon className="es:w-3.5 es:h-3.5" />
        </button>
      </div>

      {/* Conditions list */}
      <div className="rule-conditions es:p-3 es:space-y-3">
        {rule.conditions.map((cond, condIdx) => (
          <ConditionRow
            key={condIdx}
            instanceId={instanceId}
            fieldId={fieldId}
            ruleIdx={globalIdx}
            condIdx={condIdx}
            condition={cond}
            otherFields={otherFields}
            onUpdate={(patch) => onUpdateCondition(condIdx, patch)}
            onRemove={() => onRemoveCondition(condIdx)}
            canRemove={rule.conditions.length > 1}
          />
        ))}
        <button
          type="button"
          onClick={onAddCondition}
          className="add-condition-btn es:w-full es:px-2 es:py-1.5 es:text-xs es:font-medium es:bg-transparent es:text-esprimary es:border es:border-dashed es:border-esprimary/40 es:rounded es:hover:bg-esprimary/10 es:transition-colors es:outline-none es:focus:outline-none es:cursor-pointer"
        >
          + Add Condition
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AND / OR toggle
// ---------------------------------------------------------------------------

interface LogicToggleProps {
  instanceId: string;
  fieldId: string;
  ruleIdx: number;
  value: LogicMode;
  onChange: (value: LogicMode) => void;
}

function LogicToggle({
  instanceId,
  fieldId,
  ruleIdx,
  value,
  onChange,
}: LogicToggleProps) {
  const id = `${instanceId}-logic-toggle-${fieldId}-${ruleIdx}`;
  return (
    <div className="logic-toggle es:flex es:rounded es:border es:border-esborder es:overflow-hidden">
      <button
        type="button"
        id={`${id}-and`}
        aria-label="Match all conditions (AND)"
        onClick={() => onChange('AND')}
        className={`es:px-2 es:py-0.5 es:text-xs es:font-medium es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer es:transition-colors ${
          value === 'AND'
            ? 'es:bg-esprimary es:text-estextsecondary'
            : 'es:bg-transparent es:text-estextmuted es:hover:bg-esbackgroundhover'
        }`}
      >
        AND
      </button>
      <button
        type="button"
        id={`${id}-or`}
        aria-label="Match any condition (OR)"
        onClick={() => onChange('OR')}
        className={`es:px-2 es:py-0.5 es:text-xs es:font-medium es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer es:transition-colors ${
          value === 'OR'
            ? 'es:bg-esprimary es:text-estextsecondary'
            : 'es:bg-transparent es:text-estextmuted es:hover:bg-esbackgroundhover'
        }`}
      >
        OR
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition row — target field, operator, expected value
// ---------------------------------------------------------------------------

interface ConditionRowProps {
  instanceId: string;
  fieldId: string;
  ruleIdx: number;
  condIdx: number;
  condition: Condition;
  otherFields: readonly TargetField[];
  onUpdate: (patch: Partial<Condition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const EXPRESSION_OPERATOR_CHIPS = [
  '>',
  '>=',
  '<',
  '<=',
  '==',
  '!=',
  '===',
  '!==',
  '&&',
  '||',
  '+',
  '-',
  '*',
  '/',
] as const;

/** Operators that don't need an expected value. */
const UNARY_OPERATORS = new Set<ConditionOperator>(['empty', 'notEmpty']);

/** Operators that only make sense for numeric / countable values. */
const NUMERIC_OPERATORS = new Set<ConditionOperator>([
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]);

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  notEquals: 'not equals',
  contains: 'contains',
  includes: 'includes',
  empty: 'is empty',
  notEmpty: 'is not empty',
  greaterThan: '>',
  greaterThanOrEqual: '>=',
  lessThan: '<',
  lessThanOrEqual: '<=',
};

function ConditionRow({
  instanceId,
  fieldId,
  ruleIdx,
  condIdx,
  condition,
  otherFields,
  onUpdate,
  onRemove,
  canRemove,
}: ConditionRowProps) {
  const idPrefix = `${instanceId}-logic-cond-${fieldId}-${ruleIdx}-${condIdx}`;
  const conditionType = condition.conditionType ?? 'field';

  const target = otherFields.find((f) => f.id === (condition.targetId ?? ''));
  const operator = condition.operator ?? 'equals';
  const isUnary = UNARY_OPERATORS.has(operator);

  // Assisted expression state
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fieldPickerOpen, setFieldPickerOpen] = React.useState(false);
  const knownFieldIds = React.useMemo(
    () => new Set(otherFields.map((f) => f.id)),
    [otherFields]
  );
  const expressionErrors = React.useMemo(
    () =>
      validateExpressionLocally(
        condition.expression ?? '',
        knownFieldIds,
        otherFields
      ),
    [condition.expression, knownFieldIds, otherFields]
  );

  React.useEffect(() => {
    if (!fieldPickerOpen) return;
    const handleClick = () => setFieldPickerOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [fieldPickerOpen]);

  const insertAtCursor = React.useCallback(
    (text: string) => {
      const el = inputRef.current;
      if (!el) {
        onUpdate({ expression: (condition.expression ?? '') + text });
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + text + el.value.slice(end);
      const newCursor = start + text.length;
      onUpdate({ expression: next });
      requestAnimationFrame(() => {
        el.setSelectionRange(newCursor, newCursor);
        el.focus();
      });
    },
    [condition.expression, onUpdate]
  );

  // Determine available operators based on target type
  const availableOperators = getAvailableOperators(
    target,
    condition.propertyAccessor
  );

  // If target changed and operator is now invalid, reset it
  const resolvedOperator =
    conditionType === 'field' && availableOperators.includes(operator)
      ? operator
      : availableOperators[0];
  if (conditionType === 'field' && resolvedOperator !== condition.operator) {
    // Schedule reset for next tick to avoid render-during-render
    Promise.resolve().then(() =>
      onUpdate({ operator: resolvedOperator, expected: '' })
    );
  }

  return (
    <div className="condition-row es:flex es:flex-col es:gap-1.5 es:p-2.5 es:border es:border-esborder es:rounded-md es:bg-esbackground">
      <div className="es:flex es:items-center es:justify-between es:gap-1.5">
        <div className="es:inline-flex es:rounded es:border es:border-esborder es:overflow-hidden">
          <button
            type="button"
            onClick={() =>
              onUpdate({
                conditionType: 'field',
                expression: '',
                targetId: condition.targetId || otherFields[0]?.id || '',
                operator: 'equals',
                expected: '',
              })
            }
            className={`es:px-2 es:py-0.5 es:text-xs es:font-medium es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer es:transition-colors ${
              conditionType === 'field'
                ? 'es:bg-esprimary es:text-estextsecondary'
                : 'es:bg-transparent es:text-estextmuted es:hover:bg-esbackgroundhover'
            }`}
          >
            Field
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdate({
                conditionType: 'expression',
                expression: condition.expression ?? '',
                targetId: undefined,
                propertyAccessor: undefined,
                operator: undefined,
                expected: undefined,
              })
            }
            className={`es:px-2 es:py-0.5 es:text-xs es:font-medium es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer es:transition-colors ${
              conditionType === 'expression'
                ? 'es:bg-esprimary es:text-estextsecondary'
                : 'es:bg-transparent es:text-estextmuted es:hover:bg-esbackgroundhover'
            }`}
          >
            Expression
          </button>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove condition ${condIdx + 1}`}
            className="remove-condition-btn es:shrink-0 es:p-1.5 es:rounded es:bg-transparent es:text-estextmuted es:hover:text-esdanger es:border-0 es:outline-none es:focus:outline-none es:transition-colors es:cursor-pointer"
          >
            <TrashIcon className="es:w-3.5 es:h-3.5" />
          </button>
        )}
      </div>

      {conditionType === 'field' ? (
        <select
          id={`${idPrefix}-target`}
          aria-label="Target field"
          value={condition.targetId ?? ''}
          onChange={(e) =>
            onUpdate({ targetId: e.currentTarget.value, expected: '' })
          }
          className="condition-target es:w-full es:min-w-0 es:px-2 es:py-1.5 es:text-xs es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:cursor-pointer"
        >
          {!target && condition.targetId && (
            <option value={condition.targetId}>
              ⚠ {condition.targetId} (missing)
            </option>
          )}
          {otherFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} ({f.fieldType})
            </option>
          ))}
        </select>
      ) : (
        <div className="es:flex es:flex-col es:gap-1.5">
          <input
            ref={inputRef}
            id={`${idPrefix}-expression`}
            aria-label="Expression"
            type="text"
            value={condition.expression ?? ''}
            onChange={(e) => onUpdate({ expression: e.currentTarget.value })}
            placeholder="{fieldId} > 0"
            className="condition-expression-input es:w-full es:min-w-0 es:px-2 es:py-1.5 es:text-xs es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:font-mono es:placeholder:text-estextmuted es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary"
          />
          <div className="condition-expression-toolbar es:flex es:flex-wrap es:items-center es:gap-1">
            <div className="es:relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFieldPickerOpen((v) => !v);
                }}
                className="condition-field-picker-btn es:px-1.5 es:py-0.5 es:text-xs es:font-medium es:bg-transparent es:text-esprimary es:border es:border-esprimary/40 es:rounded es:hover:bg-esprimary/10 es:transition-colors es:outline-none es:focus:outline-none es:cursor-pointer"
              >
                {'{ }'} Field
              </button>
              {fieldPickerOpen && (
                <div
                  className="condition-field-picker-dropdown es:absolute es:top-full es:left-0 es:mt-0.5 es:z-50 es:bg-essurface es:border es:border-esborder es:rounded es:shadow-lg es:min-w-max es:max-h-48 es:overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {otherFields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        insertAtCursor(`{${f.id}}`);
                        setFieldPickerOpen(false);
                      }}
                      className="es:flex es:flex-col es:w-full es:px-2 es:py-1.5 es:text-left es:bg-transparent es:border-0 es:text-estext es:hover:bg-esbackgroundhover es:outline-none es:focus:outline-none es:cursor-pointer"
                    >
                      <span className="es:text-xs es:font-medium">
                        {f.label}
                      </span>
                      <span className="es:text-xs es:text-estextmuted es:font-mono">
                        {'{' + f.id + '}'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {EXPRESSION_OPERATOR_CHIPS.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => insertAtCursor(` ${op} `)}
                className="operator-chip es:px-1.5 es:py-0.5 es:text-xs es:font-mono es:bg-transparent es:text-estextmuted es:border es:border-esborder es:rounded es:hover:bg-esbackgroundhover es:hover:text-estext es:transition-colors es:outline-none es:focus:outline-none es:cursor-pointer"
              >
                {op}
              </button>
            ))}
          </div>
          {expressionErrors.length > 0 && (
            <ul className="condition-expression-errors es:list-none es:p-0 es:m-0 es:space-y-0.5">
              {expressionErrors.map((err, i) => (
                <li key={i} className="es:text-xs es:text-esdanger">
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Row 2+3: Operator, accessor, expected — only in field mode */}
      {conditionType === 'field' && (
        <>
          <div className="es:flex es:gap-1.5">
            {/* Property accessor (optional) */}
            <select
              id={`${idPrefix}-accessor`}
              aria-label="Property accessor"
              value={condition.propertyAccessor ?? ''}
              onChange={(e) =>
                onUpdate({
                  propertyAccessor: e.currentTarget.value || undefined,
                  expected: '',
                })
              }
              className="condition-accessor es:min-w-0 es:px-2 es:py-1.5 es:text-xs es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:cursor-pointer"
            >
              <option value="">value</option>
              <option value="length">length</option>
              <option value="count">count</option>
            </select>

            {/* Operator */}
            <select
              id={`${idPrefix}-operator`}
              aria-label="Operator"
              value={resolvedOperator}
              onChange={(e) =>
                onUpdate({
                  operator: e.currentTarget.value as ConditionOperator,
                  expected: '',
                })
              }
              className="condition-operator es:flex-1 es:min-w-0 es:px-2 es:py-1.5 es:text-xs es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:cursor-pointer"
            >
              {availableOperators.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>
          </div>

          {!isUnary && (
            <ExpectedValueInput
              idPrefix={idPrefix}
              target={target}
              condition={condition}
              onUpdate={onUpdate}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expected value input — adapts to target field type
// ---------------------------------------------------------------------------

interface ExpectedValueInputProps {
  idPrefix: string;
  target: TargetField | undefined;
  condition: Condition;
  onUpdate: (patch: Partial<Condition>) => void;
}

function ExpectedValueInput({
  idPrefix,
  target,
  condition,
  onUpdate,
}: ExpectedValueInputProps) {
  const operator = condition.operator ?? 'equals';
  const expected = condition.expected ?? '';

  // If target has options and we're using equals/notEquals/includes,
  // show a dropdown of option values
  if (target?.hasOptions && target.options && target.options.length > 0) {
    if (
      operator === 'equals' ||
      operator === 'notEquals' ||
      operator === 'includes'
    ) {
      return (
        <select
          id={`${idPrefix}-expected`}
          aria-label="Expected value"
          value={expected}
          onChange={(e) => onUpdate({ expected: e.currentTarget.value })}
          className="condition-expected es:w-full es:min-w-0 es:px-2 es:py-1.5 es:text-xs es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary es:cursor-pointer"
        >
          <option value="">Select a value…</option>
          {target.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.value}
            </option>
          ))}
        </select>
      );
    }
  }

  // Numeric operators → number input
  if (NUMERIC_OPERATORS.has(operator) || condition.propertyAccessor) {
    return (
      <input
        id={`${idPrefix}-expected`}
        aria-label="Expected value"
        type="number"
        value={expected}
        onChange={(e) => onUpdate({ expected: e.currentTarget.value })}
        placeholder="Enter a number"
        className="condition-expected es:w-full es:min-w-0 es:px-2 es:py-1.5 es:text-xs es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:placeholder:text-estextmuted es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary"
      />
    );
  }

  // Default: text input
  return (
    <input
      id={`${idPrefix}-expected`}
      aria-label="Expected value"
      type="text"
      value={expected}
      onChange={(e) => onUpdate({ expected: e.currentTarget.value })}
      placeholder="Enter expected value"
      className="condition-expected es:w-full es:min-w-0 es:px-2 es:py-1.5 es:text-xs es:bg-essurface es:border es:border-esborder es:rounded es:text-estext es:placeholder:text-estextmuted es:focus:outline-none es:focus:ring-1 es:focus:ring-esprimary"
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve available operators based on target field type. */
function getAvailableOperators(
  target: TargetField | undefined,
  propertyAccessor?: string
): ConditionOperator[] {
  if (!target) return [...CONDITION_OPERATORS];

  if (propertyAccessor) {
    return [
      'equals',
      'notEquals',
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
    ];
  }

  return getOperatorsForTarget(target);
}

function getOperatorsForTarget(target: TargetField): ConditionOperator[] {
  const answerType = target.answerType;

  // Multi-value answers should use inclusion semantics, not scalar equality.
  if (answerType === 'multiselection' || answerType === 'multitext') {
    return ['includes', 'empty', 'notEmpty'];
  }

  // Matrix answers are object maps; only empty checks are meaningful without accessor.
  if (answerType === 'matrix') {
    return ['empty', 'notEmpty'];
  }

  // Single-value selection fields (radio/dropdown/boolean etc.).
  if (answerType === 'selection') {
    const ops: ConditionOperator[] = [
      'equals',
      'notEquals',
      'empty',
      'notEmpty',
    ];
    if (target.supportsNumericCompare) {
      ops.push(
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual'
      );
    }
    return ops;
  }

  // Text-like scalar values.
  if (answerType === 'text') {
    const ops: ConditionOperator[] = [
      'equals',
      'notEquals',
      'contains',
      'empty',
      'notEmpty',
    ];
    if (target.supportsNumericCompare) {
      ops.push(
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual'
      );
    }
    return ops;
  }

  // Fallback: conservative scalar checks.
  return ['equals', 'notEquals', 'empty', 'notEmpty'];
}

/** Collect other fields from the normalized map (exclude self). */
function buildOtherFields(
  normalized: NormalizedDefinition,
  selfId: string
): TargetField[] {
  const result: TargetField[] = [];
  for (const [id, node] of Object.entries(normalized.byId)) {
    if (id === selfId) continue;
    // Skip sections — they don't have answerable values
    if (node.definition.fieldType === 'section') continue;
    const meta = getFieldTypeMeta(node.definition.fieldType);
    const supportsNumericCompare =
      node.definition.fieldType === 'rating' ||
      node.definition.fieldType === 'slider' ||
      (node.definition.fieldType === 'text' &&
        node.definition.inputType === 'number');
    result.push({
      id,
      label: node.definition.question || node.definition.id,
      fieldType: node.definition.fieldType,
      hasOptions: meta?.hasOptions ?? false,
      options: node.definition.options,
      answerType: meta?.answerType ?? 'none',
      supportsNumericCompare,
    });
  }
  return result;
}

/** Group rules by effect, preserving original indices for update callbacks. */
function groupByEffect(
  rules: readonly ConditionalRule[]
): Record<ConditionalEffect, { rule: ConditionalRule; globalIdx: number }[]> {
  const result: Record<
    ConditionalEffect,
    { rule: ConditionalRule; globalIdx: number }[]
  > = {
    visible: [],
    enable: [],
    required: [],
  };
  rules.forEach((rule, idx) => {
    if (result[rule.effect]) {
      result[rule.effect].push({ rule, globalIdx: idx });
    }
  });
  return result;
}

function validateExpressionLocally(
  expr: string,
  knownFieldIds: Set<string>,
  otherFields: readonly TargetField[]
): string[] {
  if (!expr.trim()) return [];

  const errors: string[] = [];
  const fieldMap = new Map(otherFields.map((f) => [f.id, f]));

  // Unknown field references
  for (const match of expr.matchAll(/\{([^}]+)\}/g)) {
    const id = match[1].trim();
    if (id && !knownFieldIds.has(id)) {
      errors.push(`Unknown field: {${id}}`);
    }
  }

  // Syntax check
  if (!isExpressionValid(expr)) {
    errors.push('Expression syntax is invalid.');
  }

  // Type-aware: warn when a non-numeric field is used with a relational operator.
  // Strip == and != first so their < > characters don't trigger false positives.
  const stripped = expr.replace(/===|!==|==|!=/g, '    ');
  for (const match of expr.matchAll(/\{([^}]+)\}/g)) {
    const id = match[1].trim();
    const field = fieldMap.get(id);
    if (!field || field.supportsNumericCompare) continue;
    const start = match.index!;
    const end = start + match[0].length;
    const before = stripped.slice(Math.max(0, start - 4), start);
    const after = stripped.slice(end, end + 4);
    if (/[<>]/.test(before) || /[<>]/.test(after)) {
      errors.push(
        `{${id}} is a ${field.fieldType} field — numeric comparison (> < >= <=) may not produce meaningful results. Use == or !=.`
      );
    }
  }

  return errors;
}
