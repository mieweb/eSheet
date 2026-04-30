import React, { useSyncExternalStore } from 'react';
import YAML from 'js-yaml';
import {
  formatZodValidationError,
  formDefinitionSchema,
  type Condition,
  isExpressionValid,
  type FieldDefinition,
  type FormDefinition,
  type FormStore,
  type UIStore,
  type BuilderMode,
  type ValidationError,
  type FormResponseEnvelope,
} from '@esheet/core';
import {
  importFromMcp,
  exportToMcp,
  type McpElicitationSchema,
} from '@esheet/adapters';
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
  issues?: string[];
  issuesTitle?: string;
  issuesHint?: string;
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

function sanitizeFormId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

interface DryRunResult {
  wouldSubmit: boolean;
  errorCount: number;
  errors: ValidationError[];
  response: FormResponseEnvelope | null;
}

function formatDryRunDetails(result: DryRunResult): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return 'Unable to serialize dry-run output.';
  }
}

/**
 * BuilderHeader — top bar with Build/Code/Preview mode toggle and Import/Export actions.
 */
export function BuilderHeader({ form, ui }: BuilderHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [exportIdModalOpen, setExportIdModalOpen] = React.useState(false);
  const [exportIdInput, setExportIdInput] = React.useState('');
  const [exportIdError, setExportIdError] = React.useState('');
  const [exportFormat, setExportFormat] = React.useState<'esheet' | 'mcp'>(
    'esheet'
  );
  const [feedback, setFeedback] = React.useState<FeedbackState>({
    open: false,
    title: '',
    message: '',
    details: undefined,
    variant: 'info',
  });
  const [dryRunFeedback, setDryRunFeedback] = React.useState<FeedbackState>({
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
      issues?: string[],
      issuesTitle?: string,
      issuesHint?: string
    ) => {
      setFeedback({
        open: true,
        variant,
        title,
        message,
        details,
        issues,
        issuesTitle,
        issuesHint,
      });
    },
    []
  );

  const showDryRunFeedback = React.useCallback(
    (
      variant: FeedbackModalVariant,
      title: string,
      message: string,
      details?: string
    ) => {
      setDryRunFeedback({ open: true, variant, title, message, details });
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

  React.useEffect(() => {
    if (mode !== 'preview') {
      setDryRunFeedback((prev) =>
        prev.open
          ? {
              ...prev,
              open: false,
            }
          : prev
      );
    }
  }, [mode]);

  const finalizeExport = React.useCallback((definition: FormDefinition) => {
    const json = JSON.stringify(definition, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${definition.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleConfirmExportId = React.useCallback(() => {
    if (exportFormat === 'mcp') {
      const definition = form.getState().hydrateDefinition();
      const schema = exportToMcp(definition);
      const filename = (definition.id || 'form') + '-mcp-schema.json';
      const blob = new Blob([JSON.stringify(schema, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportIdModalOpen(false);
      return;
    }

    const nextId = sanitizeFormId(exportIdInput);
    if (!nextId) {
      setExportIdError(
        'Enter a valid id (letters, numbers, dashes, underscores).'
      );
      return;
    }

    form.getState().setFormId(nextId);
    const definition = form.getState().hydrateDefinition();
    finalizeExport(definition);
    setExportIdModalOpen(false);
    setExportIdError('');
  }, [exportFormat, exportIdInput, finalizeExport, form]);

  const handleExport = () => {
    const definition = form.getState().hydrateDefinition();
    const currentId = definition.id.trim();
    const suggested =
      currentId || sanitizeFormId(definition.title ?? 'form') || 'form';
    setExportIdInput(suggested);
    setExportIdError('');
    setExportIdModalOpen(true);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isYaml = fileName.endsWith('.yaml') || fileName.endsWith('.yml');
    const fileFormat = isYaml ? 'YAML' : 'JSON';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = isYaml ? YAML.load(content) : JSON.parse(content);

        // Auto-detect MCP elicitation schema (JSON only).
        // Accepts: full elicitation/create request, params object, or raw requestedSchema.
        if (!isYaml) {
          const p = parsed as Record<string, unknown>;
          const params = p?.params as Record<string, unknown> | undefined;

          // URL mode — no requestedSchema, nothing to import as a form.
          const mode = params?.mode ?? p?.mode;
          if (mode === 'url') {
            showFeedback(
              'error',
              'URL Mode Not Supported',
              'This MCP elicitation uses URL mode (out-of-band). Only form mode schemas can be imported into the builder.'
            );
            return;
          }

          let mcpSchema: McpElicitationSchema | undefined;
          if (params?.requestedSchema) {
            mcpSchema = params.requestedSchema as McpElicitationSchema;
          } else if (p?.requestedSchema) {
            mcpSchema = p.requestedSchema as McpElicitationSchema;
          } else if (p?.type === 'object' && p?.properties) {
            mcpSchema = p as unknown as McpElicitationSchema;
          }

          if (mcpSchema) {
            const message = params?.message ?? p?.message;
            const mcpId = p?.id ?? params?.id;
            const mcpMeta = p?.meta;
            const formDef = importFromMcp(mcpSchema, {
              formId: form.getState().hydrateDefinition().id || 'mcp-form',
              ...(typeof message === 'string' && message.length > 0
                ? { description: message }
                : {}),
              ...(mcpId !== undefined
                ? { mcpId: mcpId as string | number }
                : {}),
              ...(typeof message === 'string' ? { mcpMessage: message } : {}),
              ...(mcpMeta !== undefined ? { mcpMeta } : {}),
            });
            form.getState().loadDefinition(formDef);
            showFeedback(
              'success',
              'Import Successful',
              `Loaded ${formDef.fields.length} field(s) from MCP elicitation schema.`
            );
            return;
          }
        }

        const validated = formDefinitionSchema.safeParse(parsed);
        if (!validated.success) {
          const issues = validated.error.issues.map(formatZodValidationError);
          const shownIssues = issues.slice(0, 8);

          showFeedback(
            'error',
            'Import Failed',
            `The file is valid ${fileFormat} but does not match the form schema.`,
            issues.length > shownIssues.length
              ? `Showing ${shownIssues.length} of ${issues.length} issue(s).`
              : undefined,
            shownIssues,
            'Unsupported Form Definition',
            'Fix these issues, then try importing again.'
          );
          return;
        }

        const importWarnings = collectImportWarnings(validated.data.fields);
        if (importWarnings.length > 0) {
          const shownWarnings = importWarnings.slice(0, 10);
          showFeedback(
            'error',
            'Import Blocked',
            `This definition contains ${importWarnings.length} unsupported issue(s) and was not imported.`,
            importWarnings.length > shownWarnings.length
              ? `Showing ${shownWarnings.length} of ${importWarnings.length} issue(s).`
              : undefined,
            shownWarnings,
            'Unsupported Configuration',
            'Resolve these issues before importing this file.'
          );
          return;
        }

        form.getState().loadDefinition(validated.data);
        showFeedback(
          'success',
          'Import Successful',
          `Loaded ${validated.data.fields.length} field(s).`
        );
      } catch {
        showFeedback(
          'error',
          'Import Failed',
          `Invalid ${fileFormat} file format.`
        );
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.currentTarget.value = '';
  };

  const handleDryRunSubmit = () => {
    const state = form.getState();
    const errors = state.getErrors();

    if (errors.length > 0) {
      const result: DryRunResult = {
        wouldSubmit: false,
        errorCount: errors.length,
        errors,
        response: null,
      };

      showDryRunFeedback(
        'warning',
        'Dry Run Submit Failed',
        `Submit would fail validation with ${errors.length} error(s).`,
        formatDryRunDetails(result)
      );
      return;
    }

    const response = state.hydrateResponse({ status: 'draft' });
    const result: DryRunResult = {
      wouldSubmit: true,
      errorCount: 0,
      errors: [],
      response,
    };

    showDryRunFeedback(
      'success',
      'Dry Run Submit Passed',
      'Submit would pass validation.',
      formatDryRunDetails(result)
    );
  };

  return (
    <header className="builder-header ms:w-full ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:shrink-0">
      <FeedbackModal
        open={exportIdModalOpen}
        title="Export Form"
        message={
          exportFormat === 'mcp'
            ? 'Choose a format to export your form.'
            : `Do you want to use '${
                sanitizeFormId(exportIdInput) || exportIdInput
              }' as the form id? You can edit it below before exporting.`
        }
        content={
          <div className="ms:space-y-4 ms:mb-2">
            <div className="ms:flex ms:gap-4">
              <label className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext ms:cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value="esheet"
                  checked={exportFormat === 'esheet'}
                  onChange={() => setExportFormat('esheet')}
                />
                eSheet JSON
              </label>
              <label className="ms:flex ms:items-center ms:gap-2 ms:text-sm ms:text-mstext ms:cursor-pointer">
                <input
                  type="radio"
                  name="export-format"
                  value="mcp"
                  checked={exportFormat === 'mcp'}
                  onChange={() => setExportFormat('mcp')}
                />
                MCP Elicitation Schema
              </label>
            </div>
            {exportFormat === 'esheet' && (
              <div className="ms:space-y-2">
                <label
                  htmlFor={`${form.getState().instanceId}-export-form-id`}
                  className="ms:block ms:text-sm ms:font-medium ms:text-mstext"
                >
                  Form ID
                </label>
                <input
                  id={`${form.getState().instanceId}-export-form-id`}
                  aria-label="Form ID"
                  type="text"
                  value={exportIdInput}
                  onChange={(e) => {
                    setExportIdInput(e.target.value);
                    if (exportIdError) setExportIdError('');
                  }}
                  placeholder="my-form-id"
                  className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none ms:transition-colors"
                />
                {exportIdError && (
                  <p className="ms:text-xs ms:text-msdanger">{exportIdError}</p>
                )}
              </div>
            )}
            {exportFormat === 'mcp' && (
              <p className="ms:text-sm ms:text-mstextmuted">
                Exports as a flat{' '}
                <code className="ms:font-mono ms:text-xs ms:bg-msbackground ms:px-1 ms:py-0.5 ms:rounded">
                  requestedSchema
                </code>{' '}
                object. Field IDs, required fields, and supported types are
                preserved. Unsupported types (matrix, signature, etc.) are
                omitted.
              </p>
            )}
          </div>
        }
        variant="info"
        confirmLabel={
          exportFormat === 'mcp' ? 'Export MCP Schema' : 'Use This ID & Export'
        }
        cancelLabel="Cancel"
        showCancel
        onConfirm={handleConfirmExportId}
        onClose={() => {
          setExportIdModalOpen(false);
          setExportIdError('');
        }}
      />

      <FeedbackModal
        open={feedback.open}
        title={feedback.title}
        message={feedback.message}
        details={feedback.details}
        issues={feedback.issues}
        issuesTitle={feedback.issuesTitle}
        issuesHint={feedback.issuesHint}
        variant={feedback.variant}
        onClose={() =>
          setFeedback((prev) => ({
            ...prev,
            open: false,
          }))
        }
      />
      {/* Dry run: modal on desktop (lg+) */}
      <div className="ms:hidden ms:lg:block">
        <FeedbackModal
          open={dryRunFeedback.open}
          title={dryRunFeedback.title}
          message={dryRunFeedback.message}
          details={dryRunFeedback.details}
          variant={dryRunFeedback.variant}
          onClose={() =>
            setDryRunFeedback((prev) => ({
              ...prev,
              open: false,
            }))
          }
        />
      </div>
      {dryRunFeedback.open && (
        <>
          <button
            type="button"
            className="ms:lg:hidden ms:fixed ms:inset-0 ms:z-40 ms:bg-msoverlay ms:border-0"
            onClick={() =>
              setDryRunFeedback((prev) => ({
                ...prev,
                open: false,
              }))
            }
            aria-label="Close Dry Run result drawer"
          />
          <div className="ms:lg:hidden ms:fixed ms:left-0 ms:right-0 ms:bottom-0 ms:z-50 ms:h-[50dvh] ms:bg-mssurface ms:border-t ms:border-msborder ms:rounded-t-2xl ms:shadow-2xl ms:overflow-hidden">
            <div className="ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-2 ms:border-b ms:border-msborder">
              <span className="ms:text-sm ms:font-medium ms:text-mstext">
                Dry Run Result
              </span>
              <button
                type="button"
                onClick={() =>
                  setDryRunFeedback((prev) => ({
                    ...prev,
                    open: false,
                  }))
                }
                className="ms:px-2 ms:py-1 ms:bg-transparent ms:text-mstextmuted ms:border-0 ms:outline-none ms:focus:outline-none"
                aria-label="Close Dry Run result drawer"
              >
                Close
              </button>
            </div>
            <div className="ms:h-[calc(50dvh-45px)] ms:overflow-y-auto ms:p-4 ms:space-y-3">
              <h3 className="ms:text-sm ms:font-semibold ms:text-mstext">
                {dryRunFeedback.title}
              </h3>
              <p className="ms:text-sm ms:text-mstextmuted">
                {dryRunFeedback.message}
              </p>
              {dryRunFeedback.details && (
                <pre className="ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-3 ms:text-xs ms:overflow-auto ms:whitespace-pre-wrap ms:break-words ms:text-mstext">
                  {dryRunFeedback.details}
                </pre>
              )}
            </div>
          </div>
        </>
      )}
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
                accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
                onChange={handleImport}
                aria-label="Import form (JSON or YAML)"
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

            {mode === 'preview' && (
              <button
                type="button"
                onClick={handleDryRunSubmit}
                aria-label="Dry run submit"
                title="Dry Run Submit"
                className="dry-run-submit-btn ms:group ms:px-2 ms:py-2 ms:lg:px-3 ms:lg:py-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:hover:bg-msprimary ms:hover:text-mstextsecondary ms:hover:border-msprimary ms:text-xs ms:lg:text-sm ms:font-medium ms:transition-colors ms:flex ms:items-center ms:lg:gap-2 ms:gap-0 ms:outline-none ms:focus:outline-none ms:text-mstext ms:cursor-pointer"
              >
                <span className="ms:hidden ms:sm:inline">Dry Run Submit</span>
                <span className="ms:sm:hidden">Dry Run</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
