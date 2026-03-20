import { useState, useRef } from 'react';
import { MsheetBuilder } from '@msheet/builder';
import { MsheetRenderer, type MsheetRendererHandle } from '@msheet/renderer';
import type { FormDefinition } from '@msheet/core';

const INITIAL_DEF: FormDefinition = {
  schemaType: 'mieforms-v1.0',
  fields: [
    { id: 'q1', fieldType: 'text', question: 'What is your name?' },
    {
      id: 'q2',
      fieldType: 'text',
      question: 'What is your email?',
      inputType: 'email',
    },
    {
      id: 'q3',
      fieldType: 'radio',
      question: 'Favorite color?',
      options: [
        { id: 'o1', value: 'Red' },
        { id: 'o2', value: 'Blue' },
        { id: 'o3', value: 'Green' },
      ],
    },
    {
      id: 'q4',
      fieldType: 'singlematrix',
      question: 'Rate these:',
      rows: [
        { id: 'r1', value: 'Speed' },
        { id: 'r2', value: 'Quality' },
      ],
      columns: [
        { id: 'c1', value: 'Poor' },
        { id: 'c2', value: 'Good' },
        { id: 'c3', value: 'Excellent' },
      ],
    },
  ],
};

type ViewMode = 'builder' | 'renderer';

const TEST_SCHEMAS = [
  { label: 'Builder (current)', value: 'builder' },
  { label: 'Comprehensive test', value: '/test-comprehensive-schema.json' },
  { label: 'Expression schema', value: '/test-expression-schema.json' },
  { label: 'Logic schema', value: '/test-logic-schema.json' },
  { label: 'Rich content schema', value: '/test-rich-content-schema.json' },
];

export function App() {
  const [def1, setDef1] = useState<FormDefinition>(INITIAL_DEF);
  const [mode, setMode] = useState<ViewMode>('builder');
  const [rendererDef, setRendererDef] = useState<FormDefinition | string>(
    INITIAL_DEF
  );
  const [selectedSchema, setSelectedSchema] = useState<string>('builder');
  const rendererRef = useRef<MsheetRendererHandle>(null);

  const handleBuilderChange = (newDef: FormDefinition) => {
    setDef1(newDef);
    if (selectedSchema === 'builder') setRendererDef(newDef);
  };

  const handleGetResponses = () => {
    const responses = rendererRef.current?.getResponse();
    console.log('Form Responses:', responses);
    alert('Responses logged to console (F12)');
  };

  const handleSchemaChange = async (value: string) => {
    setSelectedSchema(value);
    if (value === 'builder') {
      setRendererDef(def1);
    } else {
      const res = await fetch(value);
      const json = await res.json();
      setRendererDef(json);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRendererDef(ev.target?.result as string);
      setSelectedSchema('');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '2px solid #e5e7eb',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          background: '#f9fafb',
        }}
      >
        <button
          onClick={() => setMode('builder')}
          style={{
            padding: '0.5rem 1.5rem',
            background: mode === 'builder' ? '#3b82f6' : 'white',
            color: mode === 'builder' ? 'white' : '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: mode === 'builder' ? 600 : 400,
          }}
        >
          Builder
        </button>
        <button
          onClick={() => setMode('renderer')}
          style={{
            padding: '0.5rem 1.5rem',
            background: mode === 'renderer' ? '#3b82f6' : 'white',
            color: mode === 'renderer' ? 'white' : '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: mode === 'renderer' ? 600 : 400,
          }}
        >
          Renderer Test
        </button>

        {mode === 'renderer' && (
          <>
            <select
              value={selectedSchema}
              onChange={(e) => handleSchemaChange(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
              }}
            >
              {TEST_SCHEMAS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              {selectedSchema === '' && <option value="">Custom file</option>}
            </select>
            <label
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                style={{ display: 'none' }}
              />
            </label>
            <button
              onClick={handleGetResponses}
              style={{
                marginLeft: 'auto',
                padding: '0.5rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Get Responses (Console)
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mode === 'builder' && (
          <MsheetBuilder definition={def1} onChange={handleBuilderChange} />
        )}

        {mode === 'renderer' && (
          <div style={{ padding: '2rem' }}>
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '0.5rem',
                color: '#92400e',
              }}
            >
              <strong>Renderer Test Mode:</strong> Fill out the form below.
              Click "Get Responses" to see collected data in console.
            </div>

            <MsheetRenderer formData={rendererDef} ref={rendererRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
