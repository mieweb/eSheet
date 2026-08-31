import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { load } from 'js-yaml';
import {
  EsheetRenderer,
  type EsheetRendererHandle,
  useRendererMcpToolHandler,
  type ResponseFormat,
} from '@esheet/renderer';
import { createDocumentListFieldProvider } from '@esheet/fields-documents';
import { permissiveDocumentListCapabilities } from '@esheet/fields-documents';
import { createFileStoreProvider } from '@esheet/fields';
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
  DialogOverlay,
  Modal,
  ModalBody,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@mieweb/ui';
import { ClipboardList, SlidersHorizontal, Smartphone } from 'lucide-react';
import { updateOzwellTools, FLOWIE_KEY } from '../ozwell-setup.js';
import {
  createDemoDocumentListRepository,
  createDemoFileStore,
} from '../document-list-demo-repository.js';

interface SubmitResult {
  readonly kind: 'success' | 'error';
  readonly title: string;
  readonly message: string;
  readonly items?: readonly string[];
  readonly detail?: string;
  readonly data?: unknown;
}

interface SchemaOption {
  readonly label: string;
  readonly value: string;
  readonly data: unknown;
}

function toSchemaLabel(fileName: string): string {
  return fileName
    .replace(/\.(?:json|ya?ml)$/i, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const schemaModules = import.meta.glob('../schemas/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function getSchemaTitle(rawSchema: string): string | undefined {
  const parsed = load(rawSchema);
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const title = (parsed as Record<string, unknown>).title;
  return typeof title === 'string' && title.trim() ? title.trim() : undefined;
}

const TEST_SCHEMAS: readonly SchemaOption[] = Object.entries(schemaModules)
  .map(([path, rawSchema]) => {
    const fileName = path.split('/').pop() ?? path;

    return {
      label: getSchemaTitle(rawSchema) || toSchemaLabel(fileName),
      value: fileName,
      data: rawSchema,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

export function RendererView() {
  useEffect(() => {
    updateOzwellTools(FLOWIE_KEY);
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

  const [touchMode, setTouchMode] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [topNavigation, setTopNavigation] = useState(false);
  const [bottomNavigation, setBottomNavigation] = useState(true);
  const [validateNavigation, setValidateNavigation] = useState(true);
  const [activeTab, setActiveTab] = useState<'form' | 'definition'>('form');
  const [responseFormat, setResponseFormat] =
    useState<ResponseFormat>('native');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const documentRepository = useMemo(
    () => createDemoDocumentListRepository(),
    []
  );
  const fileStore = useMemo(() => createDemoFileStore(), []);

  const resetFormKey = useCallback(() => {
    setFormKey((prev) => prev + 1);
  }, []);

  const handleLoadSchema = (fileName: string) => {
    const schema = TEST_SCHEMAS.find((s) => s.value === fileName);
    if (!schema) return;
    setSelectedSchema(fileName);
    setRawInput(schema.data);
    setSubmitResult(null);
    setActiveTab('form');
    resetFormKey();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = load(ev.target?.result as string);
        setRawInput(data);
        setSubmitResult(null);
        setActiveTab('form');
        resetFormKey();
      } catch (err) {
        setSubmitResult({
          kind: 'error',
          title: 'Import failed',
          message: 'Failed to parse YAML or JSON.',
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

    // Get response in selected format
    const response = renderer.getResponse({
      format: responseFormat,
      fhir:
        responseFormat === 'fhir'
          ? {
              status: 'completed',
            }
          : undefined,
    });

    console.log(
      `${responseFormat.toUpperCase()} Response:`,
      JSON.stringify(response, null, 2)
    );
    setSubmitResult({
      kind: 'success',
      title: `Submit successful (${
        responseFormat === 'fhir' ? 'FHIR QuestionnaireResponse' : 'Native'
      })`,
      message: 'Validation passed. Form response data:',
      data: response,
    });
  };

  const handlePasteApply = () => {
    try {
      const data = load(pasteText);
      setRawInput(data);
      setSubmitResult(null);
      setActiveTab('form');
      resetFormKey();
      setPasteOpen(false);
      setPasteText('');
      setPasteError(null);
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : String(err));
    }
  };

  const hasForm = rawInput != null;
  const documentListProvider = createDocumentListFieldProvider(
    // A demo protects nothing; a real host resolves its own capabilities.
    { capabilities: permissiveDocumentListCapabilities },
    { repository: documentRepository, fileStore }
  );
  const fileStoreProvider = createFileStoreProvider(fileStore);

  return (
    <>
      <Navbar />

      <input
        id="renderer-file-import"
        type="file"
        accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
        onChange={handleFileImport}
        className="hidden"
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'form' | 'definition')}
      >
        <div className="sticky top-14 z-30 bg-card border-b border-border">
          <div className="max-w-4xl mx-auto px-3 py-1.5 flex flex-col sm:flex-row sm:items-center sm:h-11 gap-1.5 sm:gap-2">
            {/* Left: view tabs, touch mode, and page navigation settings */}
            <div className="flex min-w-0 items-center gap-2">
              <TabsList>
                <TabsTrigger value="form" disabled={!hasForm}>
                  Form
                </TabsTrigger>
                <TabsTrigger value="definition" disabled={!hasForm}>
                  Definition
                </TabsTrigger>
              </TabsList>
              <Button
                variant={touchMode ? 'primary' : 'outline'}
                size="sm"
                disabled={!hasForm}
                onClick={() => rendererRef.current?.setTouchMode(!touchMode)}
                title={touchMode ? 'Disable touch mode' : 'Enable touch mode'}
              >
                <Smartphone size={14} />
                <span className="hidden sm:inline ml-1">Touch</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setNavigationOpen(true)}
                aria-haspopup="dialog"
                title="Configure page navigation"
              >
                <SlidersHorizontal size={14} />
                <span className="ml-1">Navigation</span>
              </Button>
            </div>
            {/* Right: format select + import + submit */}
            <div className="flex items-center gap-2 sm:ml-auto">
              <Select
                value={responseFormat}
                onValueChange={(v: string) =>
                  setResponseFormat(v as ResponseFormat)
                }
                options={[
                  { value: 'native', label: 'Native' },
                  { value: 'fhir', label: 'FHIR' },
                ]}
                className="w-24 shrink-0"
                disabled={!hasForm}
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setPasteText('');
                  setPasteError(null);
                  setPasteOpen(true);
                }}
              >
                Paste YAML/JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  document.getElementById('renderer-file-import')?.click()
                }
              >
                Import YAML/JSON
              </Button>
              <Button
                onClick={handleSubmit}
                variant="primary"
                size="sm"
                className="shrink-0"
                disabled={!hasForm}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>

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
                {submitResult.data != null && (
                  <pre className="mt-3 p-3 bg-background/50 rounded-lg text-xs overflow-auto max-h-96 border border-border">
                    {JSON.stringify(submitResult.data, null, 2)}
                  </pre>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="demo-renderer-content bg-background pt-6 pb-20 min-h-[calc(100vh-3.5rem)]">
          {!hasForm ? (
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
                  Select an example from the dropdown, or import your own YAML
                  or JSON definition.
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
            <>
              <TabsContent value="form">
                <div className="pt-6 px-4 max-w-4xl mx-auto">
                  <div className="flex-1 min-w-0">
                    <EsheetRenderer
                      key={formKey}
                      formDataInput={rawInput}
                      ref={rendererRef}
                      allowDangerousJS={true}
                      touchMode="auto"
                      onTouchModeChange={setTouchMode}
                      topNavigation={topNavigation}
                      bottomNavigation={bottomNavigation}
                      validateNavigation={validateNavigation}
                      onRendererToolsReady={onRendererToolsReady}
                      fieldProviders={[fileStoreProvider, documentListProvider]}
                      onReady={() => {
                        const def = rendererRef.current
                          ?.getFormStore()
                          .getState()
                          .hydrateDefinition();
                        if (def) setDefinition(def);
                      }}
                    />
                  </div>
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
            </>
          )}
        </div>
      </Tabs>

      <Modal open={navigationOpen} onOpenChange={setNavigationOpen}>
        <ModalHeader>
          <ModalTitle>Page navigation</ModalTitle>
          <ModalClose />
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Choose where page navigation appears in the renderer.
          </p>
          <div className="divide-y divide-border rounded-lg border border-border">
            <div className="p-4">
              <Switch
                id="renderer-top-navigation"
                label="Top navigation"
                description="Show page titles above the form."
                checked={topNavigation}
                onCheckedChange={setTopNavigation}
              />
            </div>
            <div className="p-4">
              <Switch
                id="renderer-bottom-navigation"
                label="Bottom navigation"
                description="Show Previous and Next controls below the form."
                checked={bottomNavigation}
                onCheckedChange={setBottomNavigation}
              />
            </div>
            <div className="p-4">
              <Switch
                id="renderer-navigation-validation"
                label="Require page validation"
                description="Validate required fields before moving forward."
                checked={validateNavigation}
                onCheckedChange={setValidateNavigation}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNavigationOpen(false)}
          >
            Done
          </Button>
        </ModalFooter>
      </Modal>

      <DialogOverlay isOpen={pasteOpen} onClose={() => setPasteOpen(false)}>
        <div className="flex flex-col gap-3 p-1">
          <h2 className="text-base font-semibold">
            Paste YAML/JSON Definition
          </h2>
          <Textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPasteError(null);
            }}
            placeholder="Paste your eSheet YAML/JSON, FHIR, or SurveyJS definition here…"
            rows={14}
            className="font-mono text-xs"
            autoFocus
          />
          {pasteError && (
            <p className="text-sm text-destructive">{pasteError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={pasteText.trim() === ''}
              onClick={handlePasteApply}
            >
              Apply
            </Button>
          </div>
        </div>
      </DialogOverlay>

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
