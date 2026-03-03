import React from 'react';
import { Editor, type Monaco } from '@monaco-editor/react';
import { configureMonacoYaml } from 'monaco-yaml';
import YAML from 'js-yaml';
import type { FormEngine } from '@msheet/core';
import type { UIStore } from '../ui-store.js';
import {
  formDefinitionSchema,
  FORM_SCHEMA_URI,
} from '../form-definition-schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CodeFormat = 'json' | 'yaml';

export interface CodeViewProps {
  engine: FormEngine;
  ui: UIStore;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serialize(data: unknown, format: CodeFormat): string {
  return format === 'json'
    ? JSON.stringify(data, null, 2)
    : YAML.dump(data, { indent: 2, lineWidth: -1 });
}

function parse(text: string, format: CodeFormat): unknown {
  return format === 'json' ? JSON.parse(text) : YAML.load(text);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CodeView — Monaco-based JSON/YAML editor for the form definition.
 *
 * Serialize on mount, live-validate on edit, auto-save on unmount.
 */
export function CodeView({ engine, ui }: CodeViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Track whether user actually edited (avoids spurious saves from StrictMode double-mount)
  const dirtyRef = React.useRef(false);

  const [format, setFormat] = React.useState<CodeFormat>('yaml');
  const initialCode = React.useMemo(() => {
    try {
      return serialize(engine.getState().hydrateDefinition(), 'yaml');
    } catch {
      return '';
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const codeRef = React.useRef(initialCode);
  const formatRef = React.useRef<CodeFormat>('yaml');
  const engineRef = React.useRef(engine);
  const uiRef = React.useRef(ui);

  const [code, setCode] = React.useState(initialCode);
  const [error, setError] = React.useState('');
  const [editorHeight, setEditorHeight] = React.useState(640);

  // Keep refs in sync
  React.useEffect(() => {
    engineRef.current = engine;
    uiRef.current = ui;
    formatRef.current = format;
  });

  // Clear error flag on mount
  React.useEffect(() => {
    ui.getState().setCodeEditorHasError(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate available height
  React.useEffect(() => {
    const calculateHeight = () => {
      if (containerRef.current) {
        const top = containerRef.current.getBoundingClientRect().top;
        setEditorHeight(Math.max(400, window.innerHeight - top - 20));
      }
    };
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  // --- Handlers ---

  /** Register JSON + YAML schemas before Monaco creates the editor. */
  const handleBeforeMount = (monaco: Monaco) => {
    // JSON schema IntelliSense
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [
        {
          uri: FORM_SCHEMA_URI,
          fileMatch: ['*'],
          schema: formDefinitionSchema as Record<string, unknown>,
        },
      ],
    });

    // YAML schema IntelliSense (via monaco-yaml)
    configureMonacoYaml(monaco, {
      validate: true,
      schemas: [
        {
          uri: FORM_SCHEMA_URI,
          fileMatch: ['*'],
          schema: formDefinitionSchema as Record<string, unknown>,
        },
      ],
    });
  };

  const handleCodeChange = (value: string | undefined) => {
    const text = value ?? '';
    setCode(text);
    codeRef.current = text;
    dirtyRef.current = true;

    // Live validation
    try {
      const parsed = parse(text || '{}', format);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Must be an object');
      }
      setError('');
      ui.getState().setCodeEditorHasError(false);
    } catch (err) {
      setError(`Invalid ${format.toUpperCase()}: ${(err as Error).message}`);
      ui.getState().setCodeEditorHasError(true);
    }
  };

  const handleFormatChange = (newFormat: CodeFormat) => {
    try {
      const data = parse(code, format);
      const converted = serialize(data, newFormat);
      setCode(converted);
      codeRef.current = converted;
      setFormat(newFormat);
      setError('');
      ui.getState().setCodeEditorHasError(false);
    } catch (err) {
      setError(`Cannot convert: ${(err as Error).message}`);
      ui.getState().setCodeEditorHasError(true);
    }
  };

  // Auto-save on unmount (switching away from Code mode)
  React.useEffect(() => {
    return () => {
      if (!dirtyRef.current) return;

      const text = codeRef.current.trim();
      const eng = engineRef.current;
      const uiApi = uiRef.current;
      const fmt = formatRef.current;

      if (!text) {
        eng.getState().loadDefinition({ schemaType: 'mieforms-v1.0', fields: [] });
        return;
      }

      try {
        const parsed = parse(text, fmt);
        if (!parsed || typeof parsed !== 'object') return;

        // Only save if different from current definition
        const current = eng.getState().hydrateDefinition();
        if (JSON.stringify(current) === JSON.stringify(parsed)) return;

        eng.getState().loadDefinition(parsed as Parameters<ReturnType<typeof eng.getState>['loadDefinition']>[0]);
        uiApi.getState().setCodeEditorHasError(false);
      } catch {
        // Error already shown in the editor header — don't push invalid data
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="code-view-container ms:flex ms:flex-col ms:bg-msbackground"
      style={{ height: `${editorHeight}px` }}
    >
      {/* Header — format toggle + status */}
      <div className="code-view-header ms:flex ms:items-center ms:justify-between ms:gap-3 ms:p-3 ms:bg-mssurface ms:border-b ms:border-msborder">
        <div className="format-toggle ms:flex ms:gap-1 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackground ms:p-1">
          {(['yaml', 'json'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => handleFormatChange(fmt)}
              className={`format-btn ms:px-3 ms:py-1 ms:rounded-md ms:text-sm ms:font-medium ms:transition-colors ms:border-0 ms:outline-none focus:ms:outline-none ms:cursor-pointer ${
                format === fmt
                  ? 'ms:bg-msprimary ms:text-mstextsecondary ms:shadow-sm'
                  : 'ms:bg-transparent ms:text-mstextmuted hover:ms:text-mstext hover:ms:bg-mssurface'
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="code-view-status ms:flex ms:items-center ms:gap-2">
          <span className="ms:text-xs ms:text-mstextmuted">Auto-saves when switching tabs</span>
          {error && (
            <span className="ms:text-xs ms:text-msdanger ms:bg-msdanger/10 ms:px-3 ms:py-1 ms:rounded-lg">
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="code-view-editor ms:flex-1 ms:overflow-hidden">
        <Editor
          height="100%"
          language={format === 'yaml' ? 'yaml' : 'json'}
          value={code}
          onChange={handleCodeChange}
          beforeMount={handleBeforeMount}
          theme="light"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 1.5,
            wordWrap: 'on',
            formatOnPaste: false,
            formatOnType: false,
            tabSize: 2,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 16 },
            contextmenu: true,
            accessibilitySupport: 'auto',
            ariaLabel: 'Code editor for form schema',
          }}
        />
      </div>
    </div>
  );
}
