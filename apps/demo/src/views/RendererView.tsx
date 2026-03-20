import { useState, useCallback, useRef } from 'react';
import { MsheetRenderer, type MsheetRendererHandle } from '@msheet/renderer';
import type { FormDefinition } from '@msheet/core';
import { Navbar } from '../components/Navbar';

const TEST_SCHEMAS = [
  { label: 'Comprehensive test', value: '/test-comprehensive-schema.json' },
  { label: 'Expression schema', value: '/test-expression-schema.json' },
  { label: 'Logic schema', value: '/test-logic-schema.json' },
  { label: 'Rich content schema', value: '/test-rich-content-schema.json' },
];

export function RendererView() {
  const [formData, setFormData] = useState<FormDefinition | null>(null);
  const [formKey, setFormKey] = useState(0);
  const rendererRef = useRef<MsheetRendererHandle>(null);

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
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) handleLoadSchema(e.target.value);
          }}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="" disabled>
            Load example…
          </option>
          {TEST_SCHEMAS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white cursor-pointer hover:bg-slate-50">
          Import JSON
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="hidden"
          />
        </label>

        {formData && (
          <button
            onClick={handleGetResponses}
            className="ml-auto px-4 py-1.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            Get Responses
          </button>
        )}
      </Navbar>

      <div className="demo-renderer-content bg-gray-100 pt-6 pb-20 min-h-[calc(100vh-3.5rem)]">
        {!formData ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] gap-6">
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                No Form Loaded
              </h2>
              <p className="text-slate-600 mb-6">
                Select an example from the dropdown above, or import your own
                JSON form definition.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4">
            <MsheetRenderer
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
