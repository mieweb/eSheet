import React, { useSyncExternalStore } from 'react';
import {
  CONDITION_OPERATORS,
  CONDITIONAL_EFFECTS,
  getFieldTypeMeta,
  type Condition,
  type ConditionOperator,
  type ConditionalEffect,
  type ConditionalRule,
  type FormStore,
  type LogicMode,
  type NormalizedDefinition,
} from '@msheet/core';
import { TrashIcon, PlusIcon } from '../../icons.js';
import { useInstanceId } from '../../MsheetBuilder.js';

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
    () => form.getState().normalized,
  );
  const otherFields = React.useMemo(
    () => buildOtherFields(normalized, fieldId),
    [normalized, fieldId],
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
      conditions: [{ targetId: defaultTarget, operator: 'equals', expected: '' }],
    };
    updateRules([...rules, newRule]);
  };

  const handleRemoveRule = (ruleIdx: number) => {
    updateRules(rules.filter((_, i) => i !== ruleIdx));
  };

  const handleUpdateRule = (ruleIdx: number, patch: Partial<ConditionalRule>) => {
    updateRules(rules.map((r, i) => (i === ruleIdx ? { ...r, ...patch } : r)));
  };

  const handleUpdateCondition = (
    ruleIdx: number,
    condIdx: number,
    patch: Partial<Condition>,
  ) => {
    updateRules(
      rules.map((r, i) => {
        if (i !== ruleIdx) return r;
        const conditions = r.conditions.map((c, j) =>
          j === condIdx ? { ...c, ...patch } : c,
        );
        return { ...r, conditions };
      }),
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
            { targetId: defaultTarget, operator: 'equals' as ConditionOperator, expected: '' },
          ],
        };
      }),
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
      <div className="logic-editor-empty ms:text-sm ms:text-mstextmuted ms:text-center ms:py-6">
        Add more fields to the form to create logic rules.
      </div>
    );
  }

  return (
    <div className="logic-editor ms:space-y-5">
      {CONDITIONAL_EFFECTS.map((effect) => (
        <EffectSection
          key={effect}
          instanceId={instanceId}
          fieldId={fieldId}
          effect={effect}
          ruleEntries={grouped[effect]}
          otherFields={otherFields}
          form={form}
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
}

interface EffectSectionProps {
  instanceId: string;
  fieldId: string;
  effect: ConditionalEffect;
  ruleEntries: { rule: ConditionalRule; globalIdx: number }[];
  otherFields: readonly TargetField[];
  form: FormStore;
  onAddRule: () => void;
  onRemoveRule: (ruleIdx: number) => void;
  onUpdateRule: (ruleIdx: number, patch: Partial<ConditionalRule>) => void;
  onAddCondition: (ruleIdx: number) => void;
  onRemoveCondition: (ruleIdx: number, condIdx: number) => void;
  onUpdateCondition: (ruleIdx: number, condIdx: number, patch: Partial<Condition>) => void;
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
  form,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
}: EffectSectionProps) {
  const hasRules = ruleEntries.length > 0;

  return (
    <div className="effect-section ms:space-y-2">
      {/* Header */}
      <div className="effect-header ms:flex ms:items-center ms:justify-between">
        <div>
          <span className="ms:text-sm ms:font-medium ms:text-mstext">
            {EFFECT_LABELS[effect]}
          </span>
          <span className="ms:text-xs ms:text-mstextmuted ms:ml-2">
            {hasRules ? `${ruleEntries.length} rule${ruleEntries.length > 1 ? 's' : ''}` : 'Always'}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddRule}
          aria-label={`Add ${effect} rule`}
          className="add-rule-btn ms:flex ms:items-center ms:gap-1 ms:px-2 ms:py-1 ms:text-xs ms:font-medium ms:bg-transparent ms:text-msprimary ms:border ms:border-msprimary/40 ms:rounded ms:hover:bg-msprimary/10 ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer"
        >
          <PlusIcon className="ms:w-3 ms:h-3" />
          <span>Rule</span>
        </button>
      </div>

      {/* Rules */}
      {ruleEntries.map(({ rule, globalIdx }, localIdx) => (
        <React.Fragment key={globalIdx}>
          {localIdx > 0 && (
            <div className="or-divider ms:text-xs ms:text-mstextmuted ms:text-center ms:py-0.5">
              — OR —
            </div>
          )}
          <RuleCard
            instanceId={instanceId}
            fieldId={fieldId}
            rule={rule}
            globalIdx={globalIdx}
            otherFields={otherFields}
            form={form}
            onRemove={() => onRemoveRule(globalIdx)}
            onUpdate={(patch) => onUpdateRule(globalIdx, patch)}
            onAddCondition={() => onAddCondition(globalIdx)}
            onRemoveCondition={(condIdx) => onRemoveCondition(globalIdx, condIdx)}
            onUpdateCondition={(condIdx, patch) => onUpdateCondition(globalIdx, condIdx, patch)}
          />
        </React.Fragment>
      ))}

      {/* Hint when no rules */}
      {!hasRules && (
        <div className="ms:text-xs ms:text-mstextmuted ms:italic">
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
  form: FormStore;
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
  form,
  onRemove,
  onUpdate,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
}: RuleCardProps) {
  return (
    <div className="rule-card ms:border ms:border-msborder ms:rounded-lg ms:bg-mssurface ms:shadow-sm">
      {/* Rule header — logic toggle + delete */}
      <div className="rule-header ms:flex ms:items-center ms:justify-between ms:px-3 ms:py-2 ms:border-b ms:border-msborder ms:bg-msbackground ms:rounded-t-lg">
        <div className="ms:flex ms:items-center ms:gap-2">
          <span className="ms:text-xs ms:text-mstextmuted">Match</span>
          <LogicToggle
            instanceId={instanceId}
            fieldId={fieldId}
            ruleIdx={globalIdx}
            value={rule.logic}
            onChange={(logic) => onUpdate({ logic })}
          />
          <span className="ms:text-xs ms:text-mstextmuted">
            {rule.logic === 'AND' ? 'all conditions' : 'any condition'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove rule"
          className="remove-rule-btn ms:p-1 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:transition-colors ms:cursor-pointer"
        >
          <TrashIcon className="ms:w-3.5 ms:h-3.5" />
        </button>
      </div>

      {/* Conditions list */}
      <div className="rule-conditions ms:p-3 ms:space-y-3">
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
          className="add-condition-btn ms:w-full ms:px-2 ms:py-1.5 ms:text-xs ms:font-medium ms:bg-transparent ms:text-msprimary ms:border ms:border-dashed ms:border-msprimary/40 ms:rounded ms:hover:bg-msprimary/10 ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer"
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

function LogicToggle({ instanceId, fieldId, ruleIdx, value, onChange }: LogicToggleProps) {
  const id = `${instanceId}-logic-toggle-${fieldId}-${ruleIdx}`;
  return (
    <div className="logic-toggle ms:flex ms:rounded ms:border ms:border-msborder ms:overflow-hidden">
      <button
        type="button"
        id={`${id}-and`}
        aria-label="Match all conditions (AND)"
        onClick={() => onChange('AND')}
        className={`ms:px-2 ms:py-0.5 ms:text-xs ms:font-medium ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:transition-colors ${
          value === 'AND'
            ? 'ms:bg-msprimary ms:text-mstextsecondary'
            : 'ms:bg-transparent ms:text-mstextmuted ms:hover:bg-msbackgroundhover'
        }`}
      >
        AND
      </button>
      <button
        type="button"
        id={`${id}-or`}
        aria-label="Match any condition (OR)"
        onClick={() => onChange('OR')}
        className={`ms:px-2 ms:py-0.5 ms:text-xs ms:font-medium ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:transition-colors ${
          value === 'OR'
            ? 'ms:bg-msprimary ms:text-mstextsecondary'
            : 'ms:bg-transparent ms:text-mstextmuted ms:hover:bg-msbackgroundhover'
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

  const target = otherFields.find((f) => f.id === condition.targetId);
  const isUnary = UNARY_OPERATORS.has(condition.operator);

  // Determine available operators based on target type
  const availableOperators = getAvailableOperators(target);

  // If target changed and operator is now invalid, reset it
  const operator = availableOperators.includes(condition.operator)
    ? condition.operator
    : availableOperators[0];
  if (operator !== condition.operator) {
    // Schedule reset for next tick to avoid render-during-render
    Promise.resolve().then(() => onUpdate({ operator, expected: '' }));
  }

  return (
    <div className="condition-row ms:flex ms:flex-col ms:gap-1.5 ms:p-2.5 ms:border ms:border-msborder ms:rounded-md ms:bg-msbackground">
      <div className="ms:flex ms:gap-1.5">
      <select
        id={`${idPrefix}-target`}
        aria-label="Target field"
        value={condition.targetId}
        onChange={(e) => onUpdate({ targetId: e.currentTarget.value, expected: '' })}
        className="condition-target ms:flex-1 ms:min-w-0 ms:px-2 ms:py-1.5 ms:text-xs ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:cursor-pointer"
      >
        {!target && condition.targetId && (
          <option value={condition.targetId}>⚠ {condition.targetId} (missing)</option>
        )}
        {otherFields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label} ({f.fieldType})
          </option>
        ))}
      </select>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove condition ${condIdx + 1}`}
            className="remove-condition-btn ms:shrink-0 ms:p-1.5 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:transition-colors ms:cursor-pointer"
          >
            <TrashIcon className="ms:w-3.5 ms:h-3.5" />
          </button>
        )}
      </div>

      {/* Row 2: Operator + property accessor */}
      <div className="ms:flex ms:gap-1.5">
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
          className="condition-accessor ms:min-w-0 ms:px-2 ms:py-1.5 ms:text-xs ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:cursor-pointer"
        >
          <option value="">value</option>
          <option value="length">length</option>
          <option value="count">count</option>
        </select>

        {/* Operator */}
        <select
          id={`${idPrefix}-operator`}
          aria-label="Operator"
          value={operator}
          onChange={(e) =>
            onUpdate({ operator: e.currentTarget.value as ConditionOperator, expected: '' })
          }
          className="condition-operator ms:flex-1 ms:min-w-0 ms:px-2 ms:py-1.5 ms:text-xs ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:cursor-pointer"
        >
          {availableOperators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </div>

      {/* Row 3: Expected value (hidden for unary operators) */}
      {!isUnary && (
        <ExpectedValueInput
          idPrefix={idPrefix}
          target={target}
          condition={condition}
          onUpdate={onUpdate}
        />
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

function ExpectedValueInput({ idPrefix, target, condition, onUpdate }: ExpectedValueInputProps) {
  // If target has options and we're using equals/notEquals/includes,
  // show a dropdown of option values
  if (target?.hasOptions && target.options && target.options.length > 0) {
    const op = condition.operator;
    if (op === 'equals' || op === 'notEquals' || op === 'includes') {
      return (
        <select
          id={`${idPrefix}-expected`}
          aria-label="Expected value"
          value={condition.expected}
          onChange={(e) => onUpdate({ expected: e.currentTarget.value })}
          className="condition-expected ms:w-full ms:min-w-0 ms:px-2 ms:py-1.5 ms:text-xs ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary ms:cursor-pointer"
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
  if (NUMERIC_OPERATORS.has(condition.operator) || condition.propertyAccessor) {
    return (
      <input
        id={`${idPrefix}-expected`}
        aria-label="Expected value"
        type="number"
        value={condition.expected}
        onChange={(e) => onUpdate({ expected: e.currentTarget.value })}
        placeholder="Enter a number"
        className="condition-expected ms:w-full ms:min-w-0 ms:px-2 ms:py-1.5 ms:text-xs ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary"
      />
    );
  }

  // Default: text input
  return (
    <input
      id={`${idPrefix}-expected`}
      aria-label="Expected value"
      type="text"
      value={condition.expected}
      onChange={(e) => onUpdate({ expected: e.currentTarget.value })}
      placeholder="Enter expected value"
      className="condition-expected ms:w-full ms:min-w-0 ms:px-2 ms:py-1.5 ms:text-xs ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-1 ms:focus:ring-msprimary"
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve available operators based on target field type. */
function getAvailableOperators(target: TargetField | undefined): ConditionOperator[] {
  // All operators available by default
  const all = [...CONDITION_OPERATORS];
  if (!target) return all;

  const meta = getFieldTypeMeta(target.fieldType);
  if (!meta) return all;

  // Multi-select fields support `includes`; single-value fields do not
  const isMulti = meta.answerType === 'multiselection' || meta.answerType === 'multitext';
  if (!isMulti) {
    return all.filter((op) => op !== 'includes');
  }

  return all;
}

/** Collect other fields from the normalized map (exclude self). */
function buildOtherFields(normalized: NormalizedDefinition, selfId: string): TargetField[] {
  const result: TargetField[] = [];
  for (const [id, node] of Object.entries(normalized.byId)) {
    if (id === selfId) continue;
    // Skip sections — they don't have answerable values
    if (node.definition.fieldType === 'section') continue;
    const meta = getFieldTypeMeta(node.definition.fieldType);
    result.push({
      id,
      label: node.definition.question || node.definition.id,
      fieldType: node.definition.fieldType,
      hasOptions: meta?.hasOptions ?? false,
      options: node.definition.options,
    });
  }
  return result;
}

/** Group rules by effect, preserving original indices for update callbacks. */
function groupByEffect(
  rules: readonly ConditionalRule[],
): Record<ConditionalEffect, { rule: ConditionalRule; globalIdx: number }[]> {
  const result: Record<ConditionalEffect, { rule: ConditionalRule; globalIdx: number }[]> = {
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
