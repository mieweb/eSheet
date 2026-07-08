import React from 'react';
import type {
  FieldComponentProps,
  SelectedOption,
  SingleMatrixFieldDefinition,
} from '@esheet/core';
import { RadioGroup, Radio } from '@mieweb/ui';
import { TrashIcon, PlusIcon } from '../../icons.js';

export const SingleMatrixField = React.memo(function SingleMatrixField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  isSoftRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as SingleMatrixFieldDefinition;
  const instanceId = form.getState().instanceId;
  const rows = def.rows || [];
  const columns = def.columns || [];

  // selected is Record<rowId, SelectedOption> for single-select per row
  const selected = (response?.selected ?? {}) as Record<string, SelectedOption>;

  if (isPreview) {
    return (
      <div className="singlematrix-field-preview ms:text-mstext ms:pb-4">
        <div className="ms:font-light ms:mb-3 ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Question'}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
        </div>

        {rows.length > 0 && columns.length > 0 ? (
          <>
            {/* Mobile: card-per-row layout */}
            <div className="singlematrix-mobile ms:block ms:sm:hidden ms:space-y-3 ms:border-t ms:border-msborder ms:pt-3">
              {rows.map((row, rowIndex) => (
                <div
                  key={row.id}
                  className="ms:border ms:border-msborder ms:rounded-lg ms:p-3"
                >
                  <div className="ms:font-medium ms:text-mstext ms:mb-2">
                    {row.value}
                  </div>
                  <RadioGroup
                    value={selected[row.id]?.id || ''}
                    onValueChange={(val) => {
                      const updated: Record<string, SelectedOption> = {};
                      for (const r of rows) {
                        if (r.id === row.id) {
                          const col = columns.find((c) => c.id === val);
                          if (col)
                            updated[r.id] = { id: col.id, value: col.value };
                        } else if (selected[r.id]) {
                          updated[r.id] = selected[r.id];
                        }
                      }
                      onResponse({ selected: updated });
                    }}
                    disabled={!isEnabled}
                    orientation="vertical"
                  >
                    {columns.map((col, colIndex) => {
                      const inputId = `${instanceId}-singlematrix-answer-${def.id}-${rowIndex}-${colIndex}-m`;
                      return (
                        <label
                          key={col.id}
                          htmlFor={inputId}
                        className={`ms:flex ms:items-center ms:gap-2 ms:rounded ms:transition-colors ms:py-1 ms:px-1 ms:select-none ${
                            isEnabled
                              ? 'ms:cursor-pointer ms:hover:bg-msprimary/5'
                              : 'ms:cursor-not-allowed'
                          }`}
                        >
                          <Radio
                            id={inputId}
                            value={col.id}
                            size="lg"
                            onClick={() => {
                              if (selected[row.id]?.id === col.id) {
                                const updated: Record<string, SelectedOption> =
                                  {};
                                for (const r of rows) {
                                  if (r.id !== row.id && selected[r.id])
                                    updated[r.id] = selected[r.id];
                                }
                                onResponse({ selected: updated });
                              }
                            }}
                          />
                          <span className="ms:text-sm ms:text-mstext">
                            {col.value}
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>
              ))}
            </div>

            {/* Desktop: grid layout */}
            <div className="singlematrix-field-grid ms:hidden ms:sm:block ms:border-t ms:border-msborder ms:pt-3">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `auto repeat(${columns.length}, 1fr)`,
                  gap: '0.5rem 1rem',
                  alignItems: 'center',
                }}
              >
                <div />
                {columns.map((col) => (
                  <div
                    key={col.id}
                    className="ms:text-center ms:font-normal ms:text-mstext ms:py-1"
                  >
                    {col.value}
                  </div>
                ))}

                {rows.map((row, rowIndex) => (
                  <RadioGroup
                    key={row.id}
                    value={selected[row.id]?.id || ''}
                    onValueChange={(val) => {
                      const updated: Record<string, SelectedOption> = {};
                      for (const r of rows) {
                        if (r.id === row.id) {
                          const col = columns.find((c) => c.id === val);
                          if (col)
                            updated[r.id] = { id: col.id, value: col.value };
                        } else if (selected[r.id]) {
                          updated[r.id] = selected[r.id];
                        }
                      }
                      onResponse({ selected: updated });
                    }}
                    disabled={!isEnabled}
                    orientation="horizontal"
                  >
                    <div className="ms:font-normal ms:text-mstext ms:py-2">
                      {row.value}
                    </div>
                    {columns.map((col, colIndex) => {
                      const inputId = `${instanceId}-singlematrix-answer-${def.id}-${rowIndex}-${colIndex}`;
                      return (
                        <label
                          key={col.id}
                          htmlFor={inputId}
                          className={`ms:flex ms:justify-center ms:rounded ms:transition-colors ms:py-2 ms:select-none ${
                            isEnabled
                              ? 'ms:cursor-pointer ms:hover:bg-msprimary/5'
                              : 'ms:cursor-not-allowed'
                          }`}
                        >
                          <Radio
                            id={inputId}
                            value={col.id}
                            size="lg"
                            onClick={() => {
                              if (selected[row.id]?.id === col.id) {
                                const updated: Record<string, SelectedOption> =
                                  {};
                                for (const r of rows) {
                                  if (r.id !== row.id && selected[r.id])
                                    updated[r.id] = selected[r.id];
                                }
                                onResponse({ selected: updated });
                              }
                            }}
                          />
                        </label>
                      );
                    })}
                  </RadioGroup>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="ms:text-mstextmuted ms:text-sm">
            Configure rows and columns in edit mode
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="singlematrix-field-edit ms:space-y-3">
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
                onChange={(e) =>
                  form.getState().updateRow(def.id, row.id, e.target.value)
                }
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
          <div className="ms:mt-2 ms:text-mstextmuted ms:text-sm">
            Max rows reached
          </div>
        ) : (
          <button
            onClick={() =>
              form.getState().addRow(def.id, `Row ${rows.length + 1}`)
            }
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
          <div className="ms:mt-2 ms:text-mstextmuted ms:text-sm">
            Max columns reached
          </div>
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
