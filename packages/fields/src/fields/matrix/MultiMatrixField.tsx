import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@msheet/core';
import { CustomCheckbox } from '../../controls/CustomCheckbox.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const MultiMatrixField = React.memo(function MultiMatrixField({
  field,
  form,
  isPreview,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;
  const rows = def.rows || [];
  const columns = def.columns || [];

  // selected is Record<rowId, SelectedOption[]> for multi-select per row
  const selected = (response?.selected ?? {}) as Record<string, SelectedOption[]>;

  const toggleSelection = (rowId: string, colId: string, colValue: string) => {
    const updated: Record<string, SelectedOption[]> = {};
    for (const r of rows) {
      const current = selected[r.id] || [];
      if (r.id === rowId) {
        const exists = current.some((s) => s.id === colId);
        updated[r.id] = exists
          ? current.filter((s) => s.id !== colId)
          : [...current, { id: colId, value: colValue }];
      } else if (current.length > 0) {
        updated[r.id] = current;
      }
    }
    onResponse({ selected: updated });
  };

  if (isPreview) {
    return (
      <div className="multimatrix-field-preview ms:text-mstext">
        <div className="ms:pb-4">
          <div className="ms:font-light ms:mb-3 ms:text-mstext ms:break-words ms:overflow-hidden">
            {def.question || 'Question'}
          </div>

          {rows.length > 0 && columns.length > 0 ? (
            <div
              className="multimatrix-field-grid ms:border-t ms:border-msborder ms:pt-3"
              style={{ display: 'grid', gridTemplateColumns: `auto repeat(${columns.length}, 1fr)`, gap: '0.5rem 1rem', alignItems: 'center' }}
            >
              {/* Top-left empty cell */}
              <div />
              {/* Column headers */}
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="ms:text-center ms:font-normal ms:text-mstext ms:py-1"
                >
                  {col.value}
                </div>
              ))}

              {/* Data rows */}
              {rows.map((row, rowIndex) => {
                const rowSelections = selected[row.id] || [];

                return (
                  <React.Fragment key={row.id}>
                    <div className="ms:font-normal ms:text-mstext ms:py-2">{row.value}</div>
                    {columns.map((col, colIndex) => {
                      const isChecked = rowSelections.some((s) => s.id === col.id);
                      const inputId = `${instanceId}-multimatrix-answer-${def.id}-${rowIndex}-${colIndex}`;

                      return (
                        <div key={col.id} className="ms:flex ms:justify-center ms:py-2">
                          <CustomCheckbox
                            id={inputId}
                            checked={isChecked}
                            onChange={() => toggleSelection(row.id, col.id, col.value)}
                            size="lg"
                          />
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="ms:text-mstextmuted ms:text-sm">
              Configure rows and columns in edit mode
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="multimatrix-field-edit ms:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          aria-label="Question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary ms:outline-none"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
        />
      </div>

      {/* Rows */}
      <div>
        <span className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Rows
        </span>
        <div className="ms:space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm ms:hover:border-mstextmuted ms:transition-colors"
            >
              <input
                id={`${instanceId}-canvas-row-${def.id}-${row.id}`}
                aria-label={`Row ${row.id}`}
                type="text"
                value={row.value}
                onChange={(e) => form.getState().updateRow(def.id, row.id, e.target.value)}
                placeholder="Row text"
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                onClick={() => form.getState().removeRow(def.id, row.id)}
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                title="Remove row"
              >
                <TrashIcon className="ms:w-5 ms:h-5" />
              </button>
            </div>
          ))}
        </div>
        {rows.length >= 10 ? (
          <div className="ms:mt-2 ms:text-mstextmuted ms:text-sm">Max rows reached</div>
        ) : (
          <button
            onClick={() => form.getState().addRow(def.id, `Row ${rows.length + 1}`)}
            className="ms:mt-2 ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:bg-mssurface ms:hover:bg-msprimary/10 ms:transition-colors ms:flex ms:items-center ms:justify-center ms:gap-2"
          >
            <PlusIcon className="ms:w-5 ms:h-5" /> Add Row
          </button>
        )}
      </div>

      {/* Columns */}
      <div>
        <span className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2">
          Columns
        </span>
        <div className="ms:space-y-2">
          {columns.map((col) => (
            <div
              key={col.id}
              className="ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:shadow-sm ms:hover:border-mstextmuted ms:transition-colors"
            >
              <input
                id={`${instanceId}-canvas-col-${def.id}-${col.id}`}
                aria-label={`Column ${col.id}`}
                type="text"
                value={col.value}
                onChange={(e) =>
                  form.getState().updateColumn(def.id, col.id, e.target.value)
                }
                placeholder="Column text"
                className="ms:flex-1 ms:min-w-0 ms:outline-none ms:bg-transparent ms:text-mstext"
              />
              <button
                onClick={() => form.getState().removeColumn(def.id, col.id)}
                className="ms:shrink-0 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none"
                title="Remove column"
              >
                <TrashIcon className="ms:w-5 ms:h-5" />
              </button>
            </div>
          ))}
        </div>
        {columns.length >= 10 ? (
          <div className="ms:mt-2 ms:text-mstextmuted ms:text-sm">Max columns reached</div>
        ) : (
          <button
            onClick={() =>
              form.getState().addColumn(def.id, `Column ${columns.length + 1}`)
            }
            className="ms:mt-2 ms:w-full ms:px-3 ms:py-2 ms:text-sm ms:font-medium ms:text-msprimary ms:border ms:border-msprimary/50 ms:rounded-lg ms:bg-mssurface ms:hover:bg-msprimary/10 ms:transition-colors ms:flex ms:items-center ms:justify-center ms:gap-2"
          >
            <PlusIcon className="ms:w-5 ms:h-5" /> Add Column
          </button>
        )}
      </div>
    </div>
  );
});
