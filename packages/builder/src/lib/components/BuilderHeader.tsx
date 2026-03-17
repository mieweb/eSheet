import React, { useSyncExternalStore } from 'react';
import {
  formDefinitionSchema,
  type Condition,
  isExpressionValid,
  type FieldDefinition,
  type FormStore,
  type UIStore,
  type BuilderMode,
} from '@msheet/core';
import {
  VEditorIcon,
  CodeIcon,
  PreviewIcon,
  UploadIcon,
  DownloadIcon,
} from '../icons.js';
import {
  FeedbackModal,
  type FeedbackModalVariant,
} from './FeedbackModal.js';

export interface BuilderHeaderProps {
  form: FormStore;
  ui: UIStore;
}

interface FeedbackState {
  open: boolean;
  title: string;
  message: string;
  details?: string;
  variant: FeedbackModalVariant;
}

const MODES: {
  value: BuilderMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'build', label: 'Build', Icon: VEditorIcon },
  { value: 'code', label: 'Code', Icon: CodeIcon },
  { value: 'preview', label: 'Preview', Icon: PreviewIcon },
];

interface FlattenedField {
  field: FieldDefinition;
  path: string;
}

function flattenFields(
  fields: FieldDefinition[],
  pathPrefix = 'fields'
): FlattenedField[] {
  const flat: FlattenedField[] = [];

  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const path = `${pathPrefix}[${i}]`;
    flat.push({ field, path });

    if (field.fieldType === 'section' && field.fields && field.fields.length > 0) {
      flat.push(...flattenFields(field.fields, `${path}.fields`));
    }
  }

  return flat;
}

function extractExpressionFieldRefs(expression: string): string[] {
  const refs = new Set<string>();
  const regex = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null = regex.exec(expression);
  while (match) {
    const ref = match[1]?.trim();
    if (ref) refs.add(ref);
    match = regex.exec(expression);
  }
  return Array.from(refs);
}

function collectImportWarnings(
  fields: FieldDefinition[]
): string[] {
  const warnings: string[] = [];
  const flat = flattenFields(fields);
  const allIds = new Set(flat.map((entry) => entry.field.id));

  const idCounts = new Map<string, number>();
  for (const entry of flat) {
    idCounts.set(entry.field.id, (idCounts.get(entry.field.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      warnings.push(`Duplicate field id '${id}' appears ${count} times.`);
    }
  }

  const optionRequiredTypes = new Set([
    'radio',
    'check',
    'dropdown',
    'multiselectdropdown',
    'rating',
    'ranking',
    'slider',
    'boolean',
  ]);

  for (const entry of flat) {
    const { field, path } = entry;

    if (optionRequiredTypes.has(field.fieldType)) {
      if (!field.options || field.options.length === 0) {
        warnings.push(`${field.id}: ${path} has no options for fieldType '${field.fieldType}'.`);
      }
    }

    if (field.fieldType === 'singlematrix' || field.fieldType === 'multimatrix') {
      if (!field.rows || field.rows.length === 0) {
        warnings.push(`${field.id}: ${path} has no rows.`);
      }
      if (!field.columns || field.columns.length === 0) {
        warnings.push(`${field.id}: ${path} has no columns.`);
      }
    }

    if (!field.rules || field.rules.length === 0) continue;

    for (let r = 0; r < field.rules.length; r += 1) {
      const rule = field.rules[r];
      for (let c = 0; c < rule.conditions.length; c += 1) {
        const cond: Condition = rule.conditions[c];
        const condPath = `${path}.rules[${r}].conditions[${c}]`;

        const isExpression =
          cond.conditionType === 'expression' ||
          (!!cond.expression && cond.expression.trim().length > 0);

        if (isExpression) {
          const expression = cond.expression?.trim() ?? '';
          if (!expression) {
            warnings.push(`${field.id}: ${condPath} has empty expression.`);
            continue;
          }

          if (!isExpressionValid(expression)) {
            warnings.push(`${field.id}: invalid expression at ${condPath} -> ${expression}`);
            continue;
          }

          const refs = extractExpressionFieldRefs(expression);
          for (const ref of refs) {
            if (!allIds.has(ref)) {
              warnings.push(`${field.id}: ${condPath} references missing field '{${ref}}'.`);
            }
          }
          continue;
        }

        if (!cond.targetId) {
          warnings.push(`${field.id}: ${condPath} is missing targetId.`);
        } else if (!allIds.has(cond.targetId)) {
          warnings.push(`${field.id}: ${condPath} targetId '${cond.targetId}' does not exist.`);
        }

        if (!cond.operator) {
          warnings.push(`${field.id}: ${condPath} is missing operator.`);
        }
      }
    }
  }

  return warnings;
}

function formatIssueDetails(lines: string[], max: number): string {
  const shown = lines.slice(0, max).map((line) => `- ${line}`);
  const remaining = lines.length - shown.length;
  if (remaining > 0) {
    shown.push(`- ...and ${remaining} more issue(s).`);
  }
  return shown.join('\n');
}

/**
 * BuilderHeader — top bar with Build/Code/Preview mode toggle and Import/Export actions.
 */
export function BuilderHeader({ form, ui }: BuilderHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = React.useState<FeedbackState>({
    open: false,
    title: '',
    message: '',
    details: undefined,
    variant: 'info',
  });

  const showFeedback = React.useCallback(
    (
      variant: FeedbackModalVariant,
      title: string,
      message: string,
      details?: string,
    ) => {
      setFeedback({ open: true, variant, title, message, details });
    },
    []
  );

  const mode = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().mode,
    () => ui.getState().mode
  );

  const codeHasError = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().codeEditorHasError,
    () => ui.getState().codeEditorHasError
  );

  const handleExport = () => {
    const definition = form.getState().hydrateDefinition();
    const json = JSON.stringify(definition, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${definition.title ?? 'form'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const validated = formDefinitionSchema.safeParse(parsed);
        if (!validated.success) {
          const issues = validated.error.issues.map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
            return `${path}: ${issue.message}`;
          });
          const details = formatIssueDetails(issues, 5);

          showFeedback(
            'error',
            'Import Failed',
            'The file is valid JSON but does not match the form schema.',
            details
          );
          return;
        }

        const importWarnings = collectImportWarnings(validated.data.fields);
        form.getState().loadDefinition(validated.data);
        if (importWarnings.length > 0) {
          const details = formatIssueDetails(importWarnings, 10);
          showFeedback(
            'warning',
            'Imported With Warnings',
            `Loaded ${validated.data.fields.length} field(s), but found ${importWarnings.length} issue(s) that may affect behavior.`,
            details
          );
          return;
        }

        showFeedback('success', 'Import Successful', `Loaded ${validated.data.fields.length} field(s).`);
      } catch {
        showFeedback('error', 'Import Failed', 'Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.currentTarget.value = '';
  };

  return (
    <header className="builder-header ms:w-full ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:shrink-0">
      <FeedbackModal
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        details={feedback.details}
        variant={feedback.variant}
        onClose={() =>
          setFeedback((prev) => ({
            ...prev,
            open: false,
          }))
        }
      />
      <div className="ms:px-4 ms:py-4">
        <div className="ms:flex ms:flex-wrap ms:items-center ms:justify-between ms:gap-3">
          {/* Left — mode toggle */}
          <div className="mode-toggle ms:flex ms:gap-1 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-1 ms:w-fit">
            {MODES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => ui.getState().setMode(value)}
                disabled={codeHasError && value !== 'code'}
                className={`mode-btn ms:flex ms:items-center ms:justify-center ms:gap-2 ms:px-2 ms:lg:px-4 ms:py-2 ms:rounded-lg ms:text-xs ms:lg:text-sm ms:font-medium ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none ${
                  codeHasError && value !== 'code'
                    ? 'ms:bg-transparent ms:text-mstextmuted/50 ms:cursor-not-allowed'
                    : 'ms:cursor-pointer'
                } ${
                  mode === value
                    ? 'ms:bg-msprimary ms:text-mstextsecondary ms:shadow-sm'
                    : 'ms:bg-transparent ms:text-mstextmuted ms:hover:text-mstext ms:hover:bg-mssurface'
                }`}
              >
                <Icon className="ms:w-5 ms:h-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Right — Import / Export */}
          <div className="header-actions ms:flex ms:gap-1 ms:items-center">
            <label className="header-import-label ms:group ms:px-2 ms:py-2 ms:lg:px-3 ms:lg:py-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:hover:bg-msprimary ms:hover:text-mstextsecondary ms:hover:border-msprimary ms:cursor-pointer ms:text-xs ms:lg:text-sm ms:font-medium ms:transition-colors ms:flex ms:items-center ms:lg:gap-2 ms:gap-0 ms:text-mstext">
              <UploadIcon className="ms:w-4 ms:h-4 ms:text-mstext ms:group-hover:text-mstextsecondary ms:transition-colors" />
              <span className="ms:hidden ms:sm:inline">Import</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                aria-label="Import form JSON"
                className="ms:hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleExport}
              className="export-btn ms:group ms:px-2 ms:py-2 ms:lg:px-3 ms:lg:py-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:hover:bg-msprimary ms:hover:text-mstextsecondary ms:hover:border-msprimary ms:text-xs ms:lg:text-sm ms:font-medium ms:transition-colors ms:flex ms:items-center ms:lg:gap-2 ms:gap-0 ms:outline-none ms:focus:outline-none ms:text-mstext ms:cursor-pointer"
              title="Export"
            >
              <DownloadIcon className="ms:w-4 ms:h-4 ms:text-mstext ms:group-hover:text-mstextsecondary ms:transition-colors" />
              <span className="ms:hidden ms:sm:inline">Export</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
