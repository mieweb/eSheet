import React from 'react';
import type { FormStore, MatrixRow, MatrixColumn } from '@esheet/core';
import { TrashIcon } from '@esheet/fields';
import { useInstanceId } from '../../EsheetBuilder.js';

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
export function MatrixEditor({
  fieldId,
  rows,
  columns,
  form,
}: MatrixEditorProps) {
  const instanceId = useInstanceId();
  const rowsRef = React.useRef<HTMLDivElement>(null);
  const colsRef = React.useRef<HTMLDivElement>(null);

  const handleAddRow = () => {
    form.getState().addRow(fieldId);
    requestAnimationFrame(() => {
      if (rowsRef.current)
        rowsRef.current.scrollTop = rowsRef.current.scrollHeight;
    });
  };

  const handleAddColumn = () => {
    form.getState().addColumn(fieldId);
    requestAnimationFrame(() => {
      if (colsRef.current)
        colsRef.current.scrollTop = colsRef.current.scrollHeight;
    });
  };

  return (
    <div className="matrix-editor es:space-y-4">
      {/* Rows */}
      <div className="matrix-rows es:space-y-2">
        <span className="edit-label es:block es:text-sm es:font-medium es:text-estext">
          Rows
        </span>
        {rows.length >= MAX_ROWS && (
          <div className="es:text-xs es:text-estextmuted es:italic">
            Maximum {MAX_ROWS} rows
          </div>
        )}
        <div ref={rowsRef} className="row-list es:space-y-2">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="row-item es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:rounded-lg es:shadow-sm es:hover:border-esprimary/50 es:transition-colors"
            >
              <span className="es:text-xs es:text-estextmuted es:w-5 es:text-right es:shrink-0">
                {idx + 1}.
              </span>
              <input
                id={`${instanceId}-editor-row-${fieldId}-${row.id}`}
                aria-label={`Row ${idx + 1}`}
                type="text"
                value={row.value}
                onChange={(e) =>
                  form
                    .getState()
                    .updateRow(fieldId, row.id, e.currentTarget.value)
                }
                placeholder={`Row ${idx + 1}`}
                className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext es:placeholder:text-estextmuted es:border-0 es:text-sm"
              />
              <button
                type="button"
                onClick={() => form.getState().removeRow(fieldId, row.id)}
                aria-label={`Remove row ${idx + 1}`}
                className="remove-row-btn es:shrink-0 es:p-0.5 es:rounded es:bg-transparent es:text-estextmuted es:hover:text-esdanger es:border-0 es:outline-none es:focus:outline-none es:transition-colors es:cursor-pointer"
              >
                <TrashIcon className="es:w-4 es:h-4" />
              </button>
            </div>
          ))}
        </div>
        {rows.length < MAX_ROWS && (
          <button
            type="button"
            onClick={handleAddRow}
            className="add-row-btn es:w-full es:px-3 es:py-2 es:text-sm es:font-medium es:bg-essurface es:text-esprimary es:border es:border-esprimary/50 es:rounded-lg es:hover:bg-esprimary/10 es:transition-colors es:outline-none es:focus:outline-none es:cursor-pointer"
          >
            + Add Row
          </button>
        )}
      </div>

      {/* Columns */}
      <div className="matrix-columns es:space-y-2">
        <span className="edit-label es:block es:text-sm es:font-medium es:text-estext">
          Columns
        </span>
        {columns.length >= MAX_COLUMNS && (
          <div className="es:text-xs es:text-estextmuted es:italic">
            Maximum {MAX_COLUMNS} columns
          </div>
        )}
        <div ref={colsRef} className="column-list es:space-y-2">
          {columns.map((col, idx) => (
            <div
              key={col.id}
              className="column-item es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:rounded-lg es:shadow-sm es:hover:border-esprimary/50 es:transition-colors"
            >
              <span className="es:text-xs es:text-estextmuted es:w-5 es:text-right es:shrink-0">
                {idx + 1}.
              </span>
              <input
                id={`${instanceId}-editor-col-${fieldId}-${col.id}`}
                aria-label={`Column ${idx + 1}`}
                type="text"
                value={col.value}
                onChange={(e) =>
                  form
                    .getState()
                    .updateColumn(fieldId, col.id, e.currentTarget.value)
                }
                placeholder={`Column ${idx + 1}`}
                className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext es:placeholder:text-estextmuted es:border-0 es:text-sm"
              />
              <button
                type="button"
                onClick={() => form.getState().removeColumn(fieldId, col.id)}
                aria-label={`Remove column ${idx + 1}`}
                className="remove-col-btn es:shrink-0 es:p-0.5 es:rounded es:bg-transparent es:text-estextmuted es:hover:text-esdanger es:border-0 es:outline-none es:focus:outline-none es:transition-colors es:cursor-pointer"
              >
                <TrashIcon className="es:w-4 es:h-4" />
              </button>
            </div>
          ))}
        </div>
        {columns.length < MAX_COLUMNS && (
          <button
            type="button"
            onClick={handleAddColumn}
            className="add-col-btn es:w-full es:px-3 es:py-2 es:text-sm es:font-medium es:bg-essurface es:text-esprimary es:border es:border-esprimary/50 es:rounded-lg es:hover:bg-esprimary/10 es:transition-colors es:outline-none es:focus:outline-none es:cursor-pointer"
          >
            + Add Column
          </button>
        )}
      </div>
    </div>
  );
}
