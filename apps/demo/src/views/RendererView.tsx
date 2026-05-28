import { useState, useCallback, useRef, useEffect } from 'react';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';
import type { FormDefinition, FormResponseEnvelope } from '@esheet/core';
import { Navbar } from '../components/Navbar';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@mieweb/ui';
import { ClipboardList } from 'lucide-react';
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
    updateOzwellTools([], '');
  }, []);

  const [rawInput, setRawInput] = useState<unknown>(null);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [formKey, setFormKey] = useState(0);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [definition, setDefinition] = useState<unknown>(null);
  const rendererRef = useRef<EsheetRendererHandle>(null);

  const [activeTab, setActiveTab] = useState<'form' | 'definition'>('form');

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
      <Navbar />

      <input
        id="renderer-file-import"
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {submitResult && (
        <div className="bg-muted py-4 px-4">
          <Alert
            variant={submitResult.kind === 'success' ? 'success' : 'danger'}
            className="max-w-4xl mx-auto"
          >
            <AlertTitle>{submitResult.title}</AlertTitle>
            <AlertDescription>
              <p>{submitResult.message}</p>
              {submitResult.items && submitResult.items.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {submitResult.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {submitResult.detail && (
                <p className="mt-3 text-sm">{submitResult.detail}</p>
              )}
              {submitResult.data && (
                <pre className="mt-3 p-3 bg-background/50 rounded-lg text-xs overflow-auto max-h-96 border border-border">
                  {JSON.stringify(submitResult.data, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="demo-renderer-content bg-background pt-6 pb-20 min-h-[calc(100vh-3.5rem)]">
        {rawInput == null ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] gap-6">
            <div className="text-center max-w-md">
              <ClipboardList
                className="mx-auto mb-4 text-muted-foreground"
                size={48}
                strokeWidth={1.5}
              />
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                No Form Loaded
              </h2>
              <p className="text-muted-foreground mb-6">
                Select an example from the dropdown, or import your own JSON
                definition.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {TEST_SCHEMAS.slice(0, 3).map((s) => (
                  <Button
                    key={s.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadSchema(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'form' | 'definition')}
          >
            <div className="sticky top-14 z-30 bg-card border-b border-border">
              <div className="max-w-4xl mx-auto px-4 flex items-center gap-2 h-11">
                <TabsList>
                  <TabsTrigger value="form">Form</TabsTrigger>
                  <TabsTrigger value="definition">Definition</TabsTrigger>
                </TabsList>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document.getElementById('renderer-file-import')?.click()
                    }
                  >
                    Import JSON
                  </Button>
                  {rawInput != null && (
                    <Button onClick={handleSubmit} variant="primary" size="sm">
                      Submit
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <TabsContent value="form">
              <div className="max-w-4xl mx-auto px-4 pt-6">
                <EsheetRenderer
                  key={formKey}
                  formDataInput={rawInput}
                  ref={rendererRef}
                  onReady={() => {
                    const def = rendererRef.current
                      ?.getFormStore()
                      .getState()
                      .hydrateDefinition();
                    if (def) setDefinition(def);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="definition">
              <div className="max-w-4xl mx-auto px-4 pt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      eSheet FormDefinition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs overflow-auto max-h-[60vh]">
                      {definition
                        ? JSON.stringify(definition, null, 2)
                        : '(loading…)'}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Sticky bottom bar — preset select only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-4 py-2 flex items-center gap-2">
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
      </div>
    </>
  );
}
