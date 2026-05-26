import { useState, useCallback, useRef, useEffect } from 'react';
import {
  EsheetRenderer,
  type EsheetRendererHandle,
  useRendererMcpToolHandler,
  RENDERER_TOOL_DEFINITIONS,
  RENDERER_SYSTEM_PROMPT,
} from '@esheet/renderer';
import type { FormDefinition, FormResponseEnvelope } from '@esheet/core';
import { Navbar } from '../components/Navbar';
import { Button, Select } from '@mieweb/ui';
import { updateOzwellTools } from '../ozwell-setup.js';

interface SubmitResult {
  readonly kind: 'success' | 'error';
  readonly title: string;
  readonly message: string;
  readonly items?: readonly string[];
  readonly detail?: string;
  readonly data?: FormResponseEnvelope;
}

interface SchemaOption {
  readonly label: string;
  readonly value: string;
  readonly data: unknown;
}

function toSchemaLabel(fileName: string): string {
  return fileName
    .replace(/\.json$/i, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const schemaModules = import.meta.glob('../schemas/*.json', {
  eager: true,
}) as Record<string, { default?: FormDefinition } | FormDefinition>;

const TEST_SCHEMAS: readonly SchemaOption[] = Object.entries(schemaModules)
  .map(([path, mod]) => {
    const fileName = path.split('/').pop() ?? path;
    const data =
      typeof mod === 'object' && mod !== null && 'default' in mod
        ? mod.default
        : (mod as FormDefinition);

    if (!data) return null;

    return {
      label: data.title?.trim() || toSchemaLabel(fileName),
      value: fileName,
      data: data as unknown,
    };
  })
  .filter((schema): schema is SchemaOption => schema !== null)
  .sort((a, b) => a!.label.localeCompare(b!.label));

export function RendererView() {
  useEffect(() => {
    updateOzwellTools([...RENDERER_TOOL_DEFINITIONS], RENDERER_SYSTEM_PROMPT);
  }, []);

  const onRendererToolsReady = useRendererMcpToolHandler({
    eventName: 'ozwell-tool-call',
  });

  const [rawInput, setRawInput] = useState<unknown>(null);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [formKey, setFormKey] = useState(0);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [definition, setDefinition] = useState<unknown>(null);
  const rendererRef = useRef<EsheetRendererHandle>(null);

  const [showDefinition, setShowDefinition] = useState(false);

  const resetFormKey = useCallback(() => {
    setFormKey((prev) => prev + 1);
  }, []);

  const handleLoadSchema = (fileName: string) => {
    const schema = TEST_SCHEMAS.find((s) => s.value === fileName);
    if (!schema) return;
    setSelectedSchema(fileName);
    setRawInput(schema.data);
    setSubmitResult(null);
    resetFormKey();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setRawInput(data);
        setSubmitResult(null);
        resetFormKey();
      } catch (err) {
        setSubmitResult({
          kind: 'error',
          title: 'Import failed',
          message: 'Failed to parse JSON.',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const result = renderer.getValidResponse();

    if (result.errors.length > 0) {
      setSubmitResult({
        kind: 'error',
        title: 'Submit failed',
        message: 'Validation failed for the following fields:',
        items: result.errors.map(
          (error) => `Field ${error.fieldId}: ${error.message}`
        ),
      });
      return;
    }

    const hydrated = renderer.getFormStore().getState().hydrateResponse();
    console.log(
      'Validated Form Response:',
      JSON.stringify(result.response, null, 2)
    );
    console.log('Hydrated Submit Payload:', JSON.stringify(hydrated, null, 2));
    setSubmitResult({
      kind: 'success',
      title: 'Submit successful',
      message: 'Validation passed. Form response data:',
      data: hydrated,
    });
  };

  return (
    <>
      <Navbar>
        <Select
          value={selectedSchema}
          onValueChange={(val: string) => {
            if (val) handleLoadSchema(val);
          }}
          options={TEST_SCHEMAS.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
          placeholder="Load example…"
          className="w-48"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            document.getElementById('renderer-file-import')?.click()
          }
        >
          Import JSON
        </Button>
        <input
          id="renderer-file-import"
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
        />

        {rawInput != null && (
          <button
            onClick={() => setShowDefinition((prev) => !prev)}
            className="px-3 py-1.5 text-sm font-medium bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            {showDefinition ? 'Hide' : 'Show'} Definition
          </button>
        )}

        {rawInput != null && (
          <Button
            onClick={handleSubmit}
            variant="primary"
            size="sm"
            className="ml-auto"
          >
            Submit
          </Button>
        )}
      </Navbar>

      {submitResult && (
        <div className="bg-muted pt-4">
          <div
            role={submitResult.kind === 'success' ? 'status' : 'alert'}
            aria-live={submitResult.kind === 'success' ? 'polite' : undefined}
            aria-atomic="true"
            className={[
              'max-w-4xl mx-auto rounded-2xl border px-4 py-4 shadow-sm',
              submitResult.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
            ].join(' ')}
          >
            <h2 className="text-base font-semibold">{submitResult.title}</h2>
            <p className="mt-1 text-sm">{submitResult.message}</p>
            {submitResult.items && submitResult.items.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {submitResult.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {submitResult.detail && (
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                {submitResult.detail}
              </p>
            )}
            {submitResult.data && (
              <pre className="mt-3 p-3 bg-white/50 dark:bg-white/10 rounded-lg text-xs overflow-auto max-h-96 border border-emerald-200 dark:border-emerald-800">
                {JSON.stringify(submitResult.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      <div className="demo-renderer-content bg-gray-100 dark:bg-neutral-900 pt-6 pb-20 min-h-[calc(100vh-3.5rem)]">
        {/* SurveyJS conversion errors removed */}
        {rawInput == null ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] gap-6">
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                No Form Loaded
              </h2>
              <p className="text-muted-foreground mb-6">
                Select an example from the dropdown above, or import your own
                JSON form definition.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={
              showDefinition
                ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-7xl mx-auto px-4'
                : 'max-w-4xl mx-auto px-4'
            }
          >
            <div>
              <EsheetRenderer
                key={formKey}
                formDataInput={rawInput}
                ref={rendererRef}
                onRendererToolsReady={onRendererToolsReady}
                onReady={() => {
                  const def = rendererRef.current
                    ?.getFormStore()
                    .getState()
                    .hydrateDefinition();
                  if (def) setDefinition(def);
                }}
              />
            </div>
            {showDefinition && (
              <div className="lg:sticky lg:top-20 lg:self-start space-y-4">
                <div className="bg-white dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 shadow-sm">
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 rounded-t-lg">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      eSheet FormDefinition
                    </h3>
                  </div>
                  <pre className="p-4 text-xs overflow-auto max-h-[40vh] text-slate-800 dark:text-slate-200">
                    {definition
                      ? JSON.stringify(definition, null, 2)
                      : '(loading…)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
