import React, { useSyncExternalStore } from 'react';
import type { FormStore, UIStore, BuilderMode } from '@msheet/core';
import {
  VEditorIcon,
  CodeIcon,
  PreviewIcon,
  UploadIcon,
  DownloadIcon,
} from '../icons.js';

export interface BuilderHeaderProps {
  form: FormStore;
  ui: UIStore;
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

/**
 * BuilderHeader — top bar with Build/Code/Preview mode toggle and Import/Export actions.
 */
export function BuilderHeader({ form, ui }: BuilderHeaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    <header className="builder-header ms:w-full ms:bg-mssurface ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:shrink-0">
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
                accept=".json,application/json"
                onChange={handleImport}
                aria-label="Import form JSON"
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
          </div>
        </div>
      </div>
    </header>
  );
}
