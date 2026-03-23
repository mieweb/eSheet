import React from 'react';
import type { FieldComponentProps, SelectedOption } from '@esheet/core';
import { CustomCheckbox } from '../../controls/CustomCheckbox.js';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const MultiMatrixField = React.memo(function MultiMatrixField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition;
  const instanceId = form.getState().instanceId;
  const rows = def.rows || [];
  const columns = def.columns || [];

  // selected is Record<rowId, SelectedOption[]> for multi-select per row
  const selected = (response?.selected ?? {}) as Record<
    string,
    SelectedOption[]
  >;

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
      <div className="multimatrix-field-preview es:text-estext es:pb-4">
        <div className="es:font-light es:mb-3 es:text-estext es:break-words es:overflow-hidden">
          {def.question || 'Question'}
          {isRequired && <span className="es:text-esdanger es:ml-0.5">*</span>}
        </div>

        {rows.length > 0 && columns.length > 0 ? (
          <div
            className="multimatrix-field-grid es:border-t es:border-esborder es:pt-3"
            style={{
              display: 'grid',
              gridTemplateColumns: `auto repeat(${columns.length}, 1fr)`,
              gap: '0.5rem 1rem',
              alignItees: 'center',
            }}
          >
            <div />
            {columns.map((col) => (
              <div
                key={col.id}
                className="es:text-center es:font-normal es:text-estext es:py-1"
              >
                {col.value}
              </div>
            ))}

            {rows.map((row, rowIndex) => {
              const rowSelections = selected[row.id] || [];

              return (
                <React.Fragment key={row.id}>
                  <div className="es:font-normal es:text-estext es:py-2">
                    {row.value}
                  </div>
                  {columns.map((col, colIndex) => {
                    const isChecked = rowSelections.some(
                      (s) => s.id === col.id
                    );
                    const inputId = `${instanceId}-multimatrix-answer-${def.id}-${rowIndex}-${colIndex}`;

                    return (
                      <div
                        key={col.id}
                        className="es:flex es:justify-center es:py-2"
                      >
                        <CustomCheckbox
                          id={inputId}
                          checked={isChecked}
                          onChange={() =>
                            toggleSelection(row.id, col.id, col.value)
                          }
                          disabled={!isEnabled}
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
          <div className="es:text-estextmuted es:text-sm">
            Configure rows and columns in edit mode
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="multimatrix-field-edit es:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          aria-label="Question"
          className="es:px-3 es:py-2 es:h-10 es:w-full es:border es:border-esborder es:bg-essurface es:text-estext es:rounded-lg es:focus:border-esprimary es:focus:ring-1 es:focus:ring-esprimary es:outline-none"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
        />
      </div>

      {/* Rows */}
      <div>
        <span className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-2">
          Rows
        </span>
        <div className="es:space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:bg-essurface es:rounded-lg es:shadow-sm es:hover:border-estextmuted es:transition-colors"
            >
              <input
                id={`${instanceId}-canvas-row-${def.id}-${row.id}`}
                aria-label={`Row ${row.id}`}
                type="text"
                value={row.value}
                onChange={(e) =>
                  form.getState().updateRow(def.id, row.id, e.target.value)
                }
                placeholder="Row text"
                className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext"
              />
              <button
                onClick={() => form.getState().removeRow(def.id, row.id)}
                className="es:shrink-0 es:text-estextmuted es:hover:text-esdanger es:transition-colors es:bg-transparent es:border-0 es:outline-none es:focus:outline-none"
                title="Remove row"
              >
                <TrashIcon className="es:w-5 es:h-5" />
              </button>
            </div>
          ))}
        </div>
        {rows.length >= 10 ? (
          <div className="es:mt-2 es:text-estextmuted es:text-sm">
            Max rows reached
          </div>
        ) : (
          <button
            onClick={() =>
              form.getState().addRow(def.id, `Row ${rows.length + 1}`)
            }
            className="es:mt-2 es:w-full es:px-3 es:py-2 es:text-sm es:font-medium es:text-esprimary es:border es:border-esprimary/50 es:rounded-lg es:bg-essurface es:hover:bg-esprimary/10 es:transition-colors es:flex es:items-center es:justify-center es:gap-2"
          >
            <PlusIcon className="es:w-5 es:h-5" /> Add Row
          </button>
        )}
      </div>

      {/* Columns */}
      <div>
        <span className="es:block es:text-sm es:font-medium es:text-estextmuted es:mb-2">
          Columns
        </span>
        <div className="es:space-y-2">
          {columns.map((col) => (
            <div
              key={col.id}
              className="es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:border es:border-esborder es:bg-essurface es:rounded-lg es:shadow-sm es:hover:border-estextmuted es:transition-colors"
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
                className="es:flex-1 es:min-w-0 es:outline-none es:bg-transparent es:text-estext"
              />
              <button
                onClick={() => form.getState().removeColumn(def.id, col.id)}
                className="es:shrink-0 es:text-estextmuted es:hover:text-esdanger es:transition-colors es:bg-transparent es:border-0 es:outline-none es:focus:outline-none"
                title="Remove column"
              >
                <TrashIcon className="es:w-5 es:h-5" />
              </button>
            </div>
          ))}
        </div>
        {columns.length >= 10 ? (
          <div className="es:mt-2 es:text-estextmuted es:text-sm">
            Max columns reached
          </div>
        ) : (
          <button
            onClick={() =>
              form.getState().addColumn(def.id, `Column ${columns.length + 1}`)
            }
            className="es:mt-2 es:w-full es:px-3 es:py-2 es:text-sm es:font-medium es:text-esprimary es:border es:border-esprimary/50 es:rounded-lg es:bg-essurface es:hover:bg-esprimary/10 es:transition-colors es:flex es:items-center es:justify-center es:gap-2"
          >
            <PlusIcon className="es:w-5 es:h-5" /> Add Column
          </button>
        )}
      </div>
    </div>
  );
});
