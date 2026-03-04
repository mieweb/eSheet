import React from 'react';
import type { FormStore, MatrixRow, MatrixColumn } from '@msheet/core';
import { useInstanceId } from '../../MsheetBuilder.js';

const MAX_ROWS = 10;
const MAX_COLUMNS = 10;

export interface MatrixEditorProps {
  fieldId: string;
  rows: readonly MatrixRow[];
  columns: readonly MatrixColumn[];
  form: FormStore;
}

/**
 * MatrixEditor — add / edit / remove rows and columns for matrix fields.
 * Max 10 rows, max 10 columns.
 */
export function MatrixEditor({ fieldId, rows, columns, form }: MatrixEditorProps) {
  const instanceId = useInstanceId();
  const rowsRef = React.useRef<HTMLDivElement>(null);
  const colsRef = React.useRef<HTMLDivElement>(null);

  const handleAddRow = () => {
    form.getState().addRow(fieldId);
    requestAnimationFrame(() => {
      if (rowsRef.current) rowsRef.current.scrollTop = rowsRef.current.scrollHeight;
    });
  };

  const handleAddColumn = () => {
    form.getState().addColumn(fieldId);
    requestAnimationFrame(() => {
      if (colsRef.current) colsRef.current.scrollTop = colsRef.current.scrollHeight;
    });
  };

  return (
    <div className="matrix-editor ms:space-y-4">
      {/* Rows */}
      <div className="matrix-rows ms:space-y-2">
        <div className="ms:flex ms:items-center ms:justify-between">
          <span className="edit-label ms:text-xs ms:font-medium ms:text-mstextmuted">Rows</span>
          {rows.length < MAX_ROWS && (
            <button
              type="button"
              onClick={handleAddRow}
              className="add-row-btn ms:text-xs ms:text-msprimary ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:hover:underline"
            >
              + Add Row
            </button>
          )}
        </div>
        {rows.length >= MAX_ROWS && (
          <div className="ms:text-xs ms:text-mstextmuted ms:italic">Maximum {MAX_ROWS} rows</div>
        )}
        <div ref={rowsRef} className="row-list ms:space-y-1 ms:max-h-36 ms:overflow-y-auto">
          {rows.map((row, idx) => (
            <div key={row.id} className="row-item ms:flex ms:items-center ms:gap-1">
              <span className="ms:text-xs ms:text-mstextmuted ms:w-5 ms:text-right ms:shrink-0">
                {idx + 1}.
              </span>
              <input
                id={`${instanceId}-editor-row-${fieldId}-${row.id}`}
                aria-label={`Row ${idx + 1}`}
                type="text"
                value={row.value}
                onChange={(e) => form.getState().updateRow(fieldId, row.id, e.currentTarget.value)}
                placeholder={`Row ${idx + 1}`}
                className="ms:flex-1 ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-transparent ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-2 ms:focus:ring-msprimary ms:focus:border-msprimary"
              />
              <button
                type="button"
                onClick={() => form.getState().removeRow(fieldId, row.id)}
                aria-label={`Remove row ${idx + 1}`}
                className="remove-row-btn ms:p-1 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:shrink-0"
              >
                <svg className="ms:w-3.5 ms:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Columns */}
      <div className="matrix-columns ms:space-y-2">
        <div className="ms:flex ms:items-center ms:justify-between">
          <span className="edit-label ms:text-xs ms:font-medium ms:text-mstextmuted">Columns</span>
          {columns.length < MAX_COLUMNS && (
            <button
              type="button"
              onClick={handleAddColumn}
              className="add-col-btn ms:text-xs ms:text-msprimary ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:hover:underline"
            >
              + Add Column
            </button>
          )}
        </div>
        {columns.length >= MAX_COLUMNS && (
          <div className="ms:text-xs ms:text-mstextmuted ms:italic">Maximum {MAX_COLUMNS} columns</div>
        )}
        <div ref={colsRef} className="column-list ms:space-y-1 ms:max-h-36 ms:overflow-y-auto">
          {columns.map((col, idx) => (
            <div key={col.id} className="column-item ms:flex ms:items-center ms:gap-1">
              <span className="ms:text-xs ms:text-mstextmuted ms:w-5 ms:text-right ms:shrink-0">
                {idx + 1}.
              </span>
              <input
                id={`${instanceId}-editor-col-${fieldId}-${col.id}`}
                aria-label={`Column ${idx + 1}`}
                type="text"
                value={col.value}
                onChange={(e) => form.getState().updateColumn(fieldId, col.id, e.currentTarget.value)}
                placeholder={`Column ${idx + 1}`}
                className="ms:flex-1 ms:min-w-0 ms:px-2 ms:py-1 ms:text-sm ms:bg-transparent ms:border ms:border-msborder ms:rounded ms:text-mstext ms:placeholder:text-mstextmuted ms:focus:outline-none ms:focus:ring-2 ms:focus:ring-msprimary ms:focus:border-msprimary"
              />
              <button
                type="button"
                onClick={() => form.getState().removeColumn(fieldId, col.id)}
                aria-label={`Remove column ${idx + 1}`}
                className="remove-col-btn ms:p-1 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:shrink-0"
              >
                <svg className="ms:w-3.5 ms:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
