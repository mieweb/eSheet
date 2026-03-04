import React, { useSyncExternalStore } from 'react';
import type { FormStore } from '@msheet/core';
import type { UIStore, BuilderMode } from '../ui-store.js';

export interface BuilderHeaderProps {
  form: FormStore;
  ui: UIStore;
}

const MODES: { value: BuilderMode; label: string }[] = [
  { value: 'build', label: 'Build' },
  { value: 'code', label: 'Code' },
  { value: 'preview', label: 'Preview' },
];

/**
 * BuilderHeader — top bar with Build/Code/Preview mode toggle and Import/Export actions.
 */
export function BuilderHeader({ form, ui }: BuilderHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const mode = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().mode,
    () => ui.getState().mode,
  );

  const codeHasError = useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().codeEditorHasError,
    () => ui.getState().codeEditorHasError,
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
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        form.getState().loadDefinition(parsed);
      } catch {
        // TODO: surface parse error to user
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.currentTarget.value = '';
  };

  return (
    <header className="builder-header ms:flex ms:items-center ms:justify-between ms:px-4 ms:py-2 ms:bg-mssurface ms:border-b ms:border-msborder ms:shrink-0">
      {/* Left — reserved for form title / branding */}
      <div className="header-left ms:w-40" />

      {/* Center — mode toggle */}
      <div className="mode-toggle ms:flex ms:items-center ms:gap-1 ms:bg-msbackground ms:rounded-lg ms:p-1">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => ui.getState().setMode(value)}
            disabled={codeHasError && value !== 'code'}
            className={`mode-btn ms:px-4 ms:py-1 ms:text-sm ms:font-medium ms:rounded-md ms:border-0 ms:outline-none focus:ms:outline-none ms:transition-colors ${
              codeHasError && value !== 'code'
                ? 'ms:opacity-50 ms:cursor-not-allowed'
                : 'ms:cursor-pointer'
            } ${
              mode === value
                ? 'ms:bg-mssurface ms:text-msprimary ms:shadow-sm'
                : 'ms:bg-transparent ms:text-mstextmuted hover:ms:text-mstext'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right — Import / Export */}
      <div className="header-actions ms:flex ms:items-center ms:gap-2 ms:w-40 ms:justify-end">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImport}
          aria-label="Import form JSON"
          className="ms:hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="import-btn ms:px-3 ms:py-1 ms:text-sm ms:bg-transparent ms:border ms:border-msborder ms:rounded ms:text-mstextmuted hover:ms:text-mstext hover:ms:border-mstext ms:outline-none focus:ms:outline-none ms:transition-colors ms:cursor-pointer"
        >
          Import
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="export-btn ms:px-3 ms:py-1 ms:text-sm ms:bg-msprimary ms:border ms:border-msprimary ms:rounded ms:text-mstextsecondary hover:ms:bg-msprimary/90 ms:outline-none focus:ms:outline-none ms:transition-colors ms:cursor-pointer"
        >
          Export
        </button>
      </div>
    </header>
  );
}
