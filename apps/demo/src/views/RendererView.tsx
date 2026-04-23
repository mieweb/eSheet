import { useState, useCallback, useRef } from 'react';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';
import type { FormDefinition } from '@esheet/core';
import { Navbar } from '../components/Navbar';
import { Button, Select } from '@mieweb/ui';

interface SubmitResult {
  readonly kind: 'success' | 'error';
  readonly title: string;
  readonly message: string;
  readonly items?: readonly string[];
  readonly detail?: string;
}

interface SchemaOption {
  readonly label: string;
  readonly value: string;
  readonly data: FormDefinition;
}

function toSchemaLabel(fileName: string): string {
  return fileName
    .replace(/\.json$/i, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const schemaModules = import.meta.glob('../../public/*.json', {
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
      data,
    };
  })
  .filter((schema): schema is SchemaOption => schema !== null)
  .sort((a, b) => a.label.localeCompare(b.label));

export function RendererView() {
  const [formData, setFormData] = useState<FormDefinition | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [selectedSchema, setSelectedSchema] = useState('');
  const rendererRef = useRef<EsheetRendererHandle>(null);

  const resetFormKey = useCallback(() => {
    setFormKey((prev) => prev + 1);
  }, []);

  const handleLoadSchema = (fileName: string) => {
    const schema = TEST_SCHEMAS.find((s) => s.value === fileName);
    if (!schema) return;
    setFormData(schema.data);
    setSelectedSchema(fileName);
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
        setFormData(data);
        setSelectedSchema('');
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
      message:
        'Validation passed. Validated response and hydrated submit payload were logged to the console.',
    });
  };

  return (
    <>
      <Navbar>
        <Select
          value={selectedSchema}
          onValueChange={(val) => {
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

        {formData && (
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
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-rose-200 bg-rose-50 text-rose-950',
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
              <p className="mt-3 text-sm text-slate-700">
                {submitResult.detail}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="demo-renderer-content bg-muted pt-6 pb-20 min-h-[calc(100vh-3.5rem)]">
        {!formData ? (
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
          <div className="max-w-4xl mx-auto px-4">
            <EsheetRenderer
              key={formKey}
              formData={formData}
              ref={rendererRef}
            />
          </div>
        )}
      </div>
    </>
  );
}
