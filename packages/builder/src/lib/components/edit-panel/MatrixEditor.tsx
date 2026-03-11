import React from 'react';
import type { FormStore, MatrixRow, MatrixColumn } from '@msheet/core';
import { TrashIcon } from '@msheet/fields';
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
        <span className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext">Rows</span>
        {rows.length >= MAX_ROWS && (
          <div className="ms:text-xs ms:text-mstextmuted ms:italic">Maximum {MAX_ROWS} rows</div>
        )}
        <div ref={rowsRef} className="row-list ms:space-y-2">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="row-item ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:hover:border-msprimary/50 ms:transition-colors"
            >
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
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext ms:placeholder:text-mstextmuted ms:border-0 ms:text-sm"
              />
              <button
                type="button"
                onClick={() => form.getState().removeRow(fieldId, row.id)}
                aria-label={`Remove row ${idx + 1}`}
                className="remove-row-btn ms:shrink-0 ms:p-0.5 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:transition-colors ms:cursor-pointer"
              >
                <TrashIcon className="ms:w-4 ms:h-4" />
              </button>
            </div>
          ))}
        </div>
        {rows.length < MAX_ROWS && (
          <button
            type="button"
            onClick={handleAddRow}
            className="add-row-btn ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:bg-mssurface ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:hover:bg-msprimary/10 ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer"
          >
            + Add Row
          </button>
        )}
      </div>

      {/* Columns */}
      <div className="matrix-columns ms:space-y-2">
        <span className="edit-label ms:block ms:text-sm ms:font-medium ms:text-mstext">Columns</span>
        {columns.length >= MAX_COLUMNS && (
          <div className="ms:text-xs ms:text-mstextmuted ms:italic">Maximum {MAX_COLUMNS} columns</div>
        )}
        <div ref={colsRef} className="column-list ms:space-y-2">
          {columns.map((col, idx) => (
            <div
              key={col.id}
              className="column-item ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:rounded-lg ms:shadow-sm ms:hover:border-msprimary/50 ms:transition-colors"
            >
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
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext ms:placeholder:text-mstextmuted ms:border-0 ms:text-sm"
              />
              <button
                type="button"
                onClick={() => form.getState().removeColumn(fieldId, col.id)}
                aria-label={`Remove column ${idx + 1}`}
                className="remove-col-btn ms:shrink-0 ms:p-0.5 ms:rounded ms:bg-transparent ms:text-mstextmuted ms:hover:text-msdanger ms:border-0 ms:outline-none ms:focus:outline-none ms:transition-colors ms:cursor-pointer"
              >
                <TrashIcon className="ms:w-4 ms:h-4" />
              </button>
            </div>
          ))}
        </div>
        {columns.length < MAX_COLUMNS && (
          <button
            type="button"
            onClick={handleAddColumn}
            className="add-col-btn ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:bg-mssurface ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:hover:bg-msprimary/10 ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer"
          >
            + Add Column
          </button>
        )}
      </div>
    </div>
  );
}
