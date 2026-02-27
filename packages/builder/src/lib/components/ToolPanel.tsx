import React from 'react';
import {
  getRegisteredFieldTypes,
  getFieldTypeMeta,
  type FormEngine,
  type FieldType,
} from '@msheet/core';
import type { UIStore } from '../ui-store.js';

export interface ToolPanelProps {
  /** The form engine instance */
  engine: FormEngine;
  /** The UI store instance */
  ui: UIStore;
}

/** Category display labels. */
const CATEGORY_LABELS: Record<string, string> = {
  text: 'Text Fields',
  selection: 'Selection Fields',
  rating: 'Rating & Ranking',
  matrix: 'Matrix Fields',
  rich: 'Rich Content',
  organization: 'Organization',
};

/** Build category → field type[] map from the registry. */
function buildCategories(): Record<string, { type: string; label: string }[]> {
  const result: Record<string, { type: string; label: string }[]> = {};

  for (const type of getRegisteredFieldTypes()) {
    const meta = getFieldTypeMeta(type);
    if (!meta) continue;
    const cat = meta.category ?? 'other';
    const label = CATEGORY_LABELS[cat] ?? 'Other';
    if (!result[label]) result[label] = [];
    result[label].push({ type, label: meta.label });
  }

  return result;
}

/**
 * ToolPanel - Left panel listing available field types.
 *
 * Clicking a button calls `engine.addField(type)` and auto-selects
 * the new field. Groups field types by category from the registry.
 */
export const ToolPanel = React.memo(function ToolPanel({
  engine,
  ui,
}: ToolPanelProps) {
  const categories = React.useMemo(buildCategories, []);

  const handleAdd = React.useCallback(
    (type: string) => {
      const newId = engine.getState().addField(type as FieldType);
      if (newId) {
        ui.getState().selectField(newId);
      }
    },
    [engine, ui]
  );

  return (
    <div className="tool-panel ms:overflow-y-auto">
      <h3 className="tool-panel-title ms:sticky ms:top-0 ms:z-10 ms:bg-mssurface ms:text-sm ms:font-semibold ms:text-mstext ms:pb-2 ms:pt-3 ms:px-4 ms:border-b ms:border-msborder">
        Tools
      </h3>

      {Object.entries(categories).map(([categoryName, items]) => (
        <div key={categoryName} className="tool-category">
          <h4 className="tool-category-title ms:sticky ms:top-9 ms:z-[5] ms:bg-msbackgroundsecondary ms:text-xs ms:font-semibold ms:text-mstextmuted ms:px-4 ms:py-2 ms:border-b ms:border-msborder ms:uppercase ms:tracking-wide">
            {categoryName}
          </h4>
          <div className="tool-items ms:grid ms:grid-cols-1 ms:gap-1.5 ms:px-3 ms:py-2">
            {items.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                className="tool-btn ms:px-3 ms:py-2 ms:text-sm ms:text-left ms:border ms:border-msborder ms:rounded ms:bg-mssurface ms:text-mstext ms:transition-colors hover:ms:bg-msprimary/10 hover:ms:border-msprimary/50 hover:ms:text-msprimary ms:cursor-pointer ms:outline-none focus:ms:outline-none focus:ms:ring-2 focus:ms:ring-msprimary"
                onClick={() => handleAdd(type)}
                title={`Add ${label}`}
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
