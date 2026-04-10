import { useState, useCallback, useRef } from 'react';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';
import type { FormDefinition } from '@esheet/core';
import { Navbar } from '../components/Navbar';
import { Button, Select } from '@mieweb/ui';

const TEST_SCHEMAS = [
  { label: 'Comprehensive test', value: '/test-comprehensive-schema.json' },
  { label: 'Expression schema', value: '/test-expression-schema.json' },
  { label: 'Logic schema', value: '/test-logic-schema.json' },
  { label: 'Rich content schema', value: '/test-rich-content-schema.json' },
];

export function RendererView() {
  const [formData, setFormData] = useState<FormDefinition | null>(null);
  const [formKey, setFormKey] = useState(0);
  const rendererRef = useRef<EsheetRendererHandle>(null);

  const resetFormKey = useCallback(() => {
    setFormKey((prev) => prev + 1);
  }, []);

  const handleLoadSchema = async (url: string) => {
    const res = await fetch(url);
    const json = await res.json();
    setFormData(json);
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
        resetFormKey();
      } catch (err) {
        alert(`Failed to parse JSON: ${err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleGetResponses = () => {
    const responses = rendererRef.current?.getResponse();
    console.log('Form Responses:', responses);
    alert('Responses logged to console (F12)');
  };

  return (
    <>
      <Navbar>
        <Select
          value=""
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
            onClick={handleGetResponses}
            variant="primary"
            size="sm"
            className="ml-auto"
          >
            Get Responses
          </Button>
        )}
      </Navbar>

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
