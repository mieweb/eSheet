import React, { useSyncExternalStore } from 'react';
import YAML from 'js-yaml';
import {
  formDefinitionSchema,
  type Condition,
  isExpressionValid,
  type FieldDefinition,
  type FormStore,
  type UIStore,
  type BuilderMode,
} from '@esheet/core';
import {
  VEditorIcon,
  CodeIcon,
  PreviewIcon,
  UploadIcon,
  DownloadIcon,
} from '../icons.js';
import { FeedbackModal, type FeedbackModalVariant } from './FeedbackModal.js';

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

    if (
      field.fieldType === 'section' &&
      field.fields &&
      field.fields.length > 0
    ) {
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

function collectImportWarnings(fields: FieldDefinition[]): string[] {
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
        warnings.push(
          `${field.id}: ${path} has no options for fieldType '${field.fieldType}'.`
        );
      }
    }

    if (
      field.fieldType === 'singlematrix' ||
      field.fieldType === 'multimatrix'
    ) {
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
            warnings.push(
              `${field.id}: invalid expression at ${condPath} -> ${expression}`
            );
            continue;
          }

          const refs = extractExpressionFieldRefs(expression);
          for (const ref of refs) {
            if (!allIds.has(ref)) {
              warnings.push(
                `${field.id}: ${condPath} references missing field '{${ref}}'.`
              );
            }
          }
          continue;
        }

        if (!cond.targetId) {
          warnings.push(`${field.id}: ${condPath} is missing targetId.`);
        } else if (!allIds.has(cond.targetId)) {
          warnings.push(
            `${field.id}: ${condPath} targetId '${cond.targetId}' does not exist.`
          );
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
      details?: string
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

    // Detect file format from extension
    const fileName = file.name.toLowerCase();
    const isYaml = fileName.endsWith('.yaml') || fileName.endsWith('.yml');
    const format = isYaml ? 'YAML' : 'JSON';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = isYaml ? YAML.load(content) : JSON.parse(content);

        const validated = formDefinitionSchema.safeParse(parsed);
        if (!validated.success) {
          const issues = validated.error.issues.map((issue) => {
            const path =
              issue.path.length > 0 ? issue.path.join('.') : '(root)';
            return `${path}: ${issue.message}`;
          });
          const details = formatIssueDetails(issues, 5);

          showFeedback(
            'error',
            'Import Failed',
            `The file is valid ${format} but does not match the form schema.`,
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

        showFeedback(
          'success',
          'Import Successful',
          `Loaded ${validated.data.fields.length} field(s).`
        );
      } catch {
        showFeedback(
          'error',
          'Import Failed',
          `Invalid ${format} file format.`
        );
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.currentTarget.value = '';
  };

  return (
    <header className="builder-header es:w-full es:bg-essurface es:border es:border-esborder es:rounded-lg es:shadow-sm es:shrink-0">
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
      <div className="es:px-4 es:py-4">
        <div className="es:flex es:flex-wrap es:items-center es:justify-between es:gap-3">
          {/* Left — mode toggle */}
          <div className="mode-toggle es:flex es:gap-1 es:rounded-lg es:border es:border-esborder es:bg-esbackground es:p-1 es:w-fit">
            {MODES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => ui.getState().setMode(value)}
                disabled={codeHasError && value !== 'code'}
                className={`mode-btn es:flex es:items-center es:justify-center es:gap-2 es:px-2 es:lg:px-4 es:py-2 es:rounded-lg es:text-xs es:lg:text-sm es:font-medium es:transition-colors es:border-0 es:outline-none es:focus:outline-none ${
                  codeHasError && value !== 'code'
                    ? 'es:bg-transparent es:text-estextmuted/50 es:cursor-not-allowed'
                    : 'es:cursor-pointer'
                } ${
                  mode === value
                    ? 'es:bg-esprimary es:text-estextsecondary es:shadow-sm'
                    : 'es:bg-transparent es:text-estextmuted es:hover:text-estext es:hover:bg-essurface'
                }`}
              >
                <Icon className="es:w-5 es:h-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Right — Import / Export */}
          <div className="header-actions es:flex es:gap-1 es:items-center">
            <label className="header-import-label es:group es:px-2 es:py-2 es:lg:px-3 es:lg:py-2 es:rounded-lg es:border es:border-esborder es:bg-essurface es:hover:bg-esprimary es:hover:text-estextsecondary es:hover:border-esprimary es:cursor-pointer es:text-xs es:lg:text-sm es:font-medium es:transition-colors es:flex es:items-center es:lg:gap-2 es:gap-0 es:text-estext">
              <UploadIcon className="es:w-4 es:h-4 es:text-estext es:group-hover:text-estextsecondary es:transition-colors" />
              <span className="es:hidden es:sm:inline">Import</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
                onChange={handleImport}
                aria-label="Import form (JSON or YAML)"
                className="es:hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleExport}
              className="export-btn es:group es:px-2 es:py-2 es:lg:px-3 es:lg:py-2 es:rounded-lg es:border es:border-esborder es:bg-essurface es:hover:bg-esprimary es:hover:text-estextsecondary es:hover:border-esprimary es:text-xs es:lg:text-sm es:font-medium es:transition-colors es:flex es:items-center es:lg:gap-2 es:gap-0 es:outline-none es:focus:outline-none es:text-estext es:cursor-pointer"
              title="Export"
            >
              <DownloadIcon className="es:w-4 es:h-4 es:text-estext es:group-hover:text-estextsecondary es:transition-colors" />
              <span className="es:hidden es:sm:inline">Export</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
