import * as React from 'react';
import type { FieldComponentProps } from '@esheet/core';
import { registerCustomFieldTypes } from '@esheet/fields';
import { CodeLookup, type CodifyDomain } from './CodeLookup/index.js';
import {
  Assessment,
  type AssessmentAddPick,
  type AssessmentItem,
  type AssessmentOrder,
  type CodeLookupConfig,
  type ConditionConcern,
} from '@mieweb/ui';

export interface AssessmentPlanFieldValue {
  concerns: ConditionConcern[];
  items: AssessmentItem[];
  orders: AssessmentOrder[];
}

const EMPTY_VALUE: AssessmentPlanFieldValue = {
  concerns: [],
  items: [],
  orders: [],
};

function parseValue(answer: string | undefined): AssessmentPlanFieldValue {
  if (!answer) return EMPTY_VALUE;

  try {
    const parsed: unknown = JSON.parse(answer);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return EMPTY_VALUE;
    }

    const { concerns, items, orders } = parsed as Partial<
      Record<keyof AssessmentPlanFieldValue, unknown>
    >;
    return {
      concerns: Array.isArray(concerns) ? (concerns as ConditionConcern[]) : [],
      items: Array.isArray(items) ? (items as AssessmentItem[]) : [],
      orders: Array.isArray(orders) ? (orders as AssessmentOrder[]) : [],
    };
  } catch {
    return EMPTY_VALUE;
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createConcern(pick: AssessmentAddPick): {
  concern: ConditionConcern;
  item: AssessmentItem;
} {
  const concernId = newId('concern');
  const assertionId = newId('assertion');
  return {
    concern: {
      concernId,
      clinicalStatus: 'active',
      source: 'manuallyAdded',
      assertions: [
        {
          id: assertionId,
          date: new Date().toISOString().slice(0, 10),
          text: pick.label,
          verificationStatus: 'confirmed',
          coding: pick.code
            ? [
                {
                  system: pick.code.codetype,
                  code: pick.code.fullcode,
                  display: pick.label,
                  primary: true,
                },
              ]
            : undefined,
        },
      ],
    },
    item: { concernId, assertionId },
  };
}

export interface AssessmentPlanFieldProps extends FieldComponentProps {
  codeLookup: CodeLookupConfig;
}

export function AssessmentPlanField({
  field,
  response,
  isPreview,
  isEnabled,
  onResponse,
  codeLookup,
}: AssessmentPlanFieldProps): React.JSX.Element {
  const definition = field.definition as {
    question?: string;
    showPlan?: boolean;
    requireCoding?: boolean;
  };
  const showPlan = definition.showPlan !== false;
  const requireCoding = definition.requireCoding === true;
  const value = React.useMemo(
    () => parseValue(response?.answer),
    [response?.answer]
  );
  const commit = (next: Partial<AssessmentPlanFieldValue>) => {
    onResponse({ answer: JSON.stringify({ ...value, ...next }) });
  };

  return (
    <Assessment
      title={
        definition.question ?? (showPlan ? 'Assessment & Plan' : 'Assessment')
      }
      concerns={value.concerns}
      items={value.items}
      orders={value.orders}
      showPlan={showPlan}
      billableOnly={requireCoding || undefined}
      readOnly={!(isPreview && isEnabled)}
      renderOrderSearch={({ onPick, onFreeText, ...args }) => (
        <CodeLookup
          indexUrl={codeLookup.indexUrl}
          locale={codeLookup.locale}
          domains={args.domains as CodifyDomain[] | undefined}
          preferDomains={args.preferDomains as CodifyDomain[] | undefined}
          preferCodetypes={args.preferCodetypes}
          billableOnly={args.billableOnly}
          placeholder={args.placeholder}
          onSelect={onPick}
          onFreeText={requireCoding ? undefined : onFreeText}
          clearOnSelect
        />
      )}
      onAddAssessment={(pick) => {
        if (requireCoding && !pick.code) return;
        const { concern, item } = createConcern(pick);
        commit({
          concerns: [...value.concerns, concern],
          items: [...value.items, item],
        });
      }}
      onReorderItems={
        showPlan
          ? undefined
          : (ids) =>
              commit({
                items: ids
                  .map((id) => value.items.find((i) => i.concernId === id))
                  .filter((i): i is AssessmentItem => !!i),
              })
      }
      {...(showPlan && {
        onAddOrder: (item, order) =>
          commit({
            orders: [
              ...value.orders,
              {
                orderId: newId('order'),
                concernId: item?.concernId,
                ...order,
              },
            ],
          }),
        onRemoveOrder: (order) =>
          commit({
            orders: value.orders.filter((o) => o.orderId !== order.orderId),
          }),
        onLinkOrder: (order, concernId) =>
          commit({
            orders: value.orders.map((o) =>
              o.orderId === order.orderId ? { ...o, concernId } : o
            ),
          }),
      })}
    />
  );
}

export function registerAssessmentPlanFieldType(options: {
  codeLookup: CodeLookupConfig;
}): void {
  const Field = (props: FieldComponentProps) => (
    <AssessmentPlanField {...props} codeLookup={options.codeLookup} />
  );

  registerCustomFieldTypes({
    assessmentPlan: {
      label: 'Assessment & Plan',
      category: 'rich',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {
        question: 'Assessment & Plan',
        width: 'full',
        showPlan: true,
        requireCoding: false,
      },
      component: Field,
    },
  });
}
