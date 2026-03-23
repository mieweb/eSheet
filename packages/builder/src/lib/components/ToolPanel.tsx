import React from 'react';
import {
  getRegisteredFieldTypes,
  getFieldTypeMeta,
  type FormStore,
  type UIStore,
  type FieldType,
} from '@esheet/core';
import {
  TextFieldsIcon,
  SelectionFieldsIcon,
  RatingIcon,
  MatrixIcon,
  RichContentIcon,
  OrganizationIcon,
  ChevronIcon,
} from '../icons.js';

export interface ToolPanelProps {
  /** The form store */
  form: FormStore;
  /** The UI store */
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

type IconComponent = React.ComponentType<{ className?: string }>;

/** Category icons mapped by display label. */
const CATEGORY_ICONS: Record<string, IconComponent> = {
  'Text Fields': TextFieldsIcon,
  'Selection Fields': SelectionFieldsIcon,
  'Rating & Ranking': RatingIcon,
  'Matrix Fields': MatrixIcon,
  'Rich Content': RichContentIcon,
  Organization: OrganizationIcon,
};

import { getFieldComponent } from '@esheet/fields';

/** Build category → field type[] map from the registry. Only includes types with a registered React component. */
function buildCategories(): Record<string, { type: string; label: string }[]> {
  const result: Record<string, { type: string; label: string }[]> = {};

  for (const type of getRegisteredFieldTypes()) {
    if (!getFieldComponent(type)) continue;
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
 * Clicking a button calls `form.addField(type)` and auto-selects
 * the new field. Groups field types by category from the registry.
 */
export const ToolPanel = React.memo(function ToolPanel({
  form,
  ui,
}: ToolPanelProps) {
  const selectedFieldId = React.useSyncExternalStore(
    (cb) => ui.subscribe(cb),
    () => ui.getState().selectedFieldId,
    () => ui.getState().selectedFieldId
  );
  const selectedField = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () =>
      selectedFieldId ? form.getState().getField(selectedFieldId) : undefined,
    () =>
      selectedFieldId ? form.getState().getField(selectedFieldId) : undefined
  );
  const selectedSectionId =
    selectedField?.definition.fieldType === 'section'
      ? selectedFieldId
      : undefined;
  const selectedSectionLabel = selectedSectionId
    ? selectedField?.definition.title ||
      selectedField?.definition.id ||
      selectedSectionId
    : null;

  const categories = React.useMemo(buildCategories, []);
  const categoryNames = React.useMemo(
    () => Object.keys(categories),
    [categories]
  );
  const orderedCategoryNames = React.useMemo(() => {
    const org = categoryNames.includes('Organization') ? ['Organization'] : [];
    const rest = categoryNames.filter((name) => name !== 'Organization');
    return [...org, ...rest];
  }, [categoryNames]);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set()
  );

  const toggleCategory = React.useCallback((name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setCollapsed((prev) =>
      prev.size === categoryNames.length ? new Set() : new Set(categoryNames)
    );
  }, [categoryNames]);

  const handleAdd = React.useCallback(
    (type: string) => {
      const selectedFieldId = ui.getState().selectedFieldId;
      const selectedField = selectedFieldId
        ? form.getState().getField(selectedFieldId)
        : undefined;
      const sectionParentId =
        selectedField?.definition.fieldType === 'section'
          ? selectedFieldId
          : undefined;

      const newId = form
        .getState()
        .addField(
          type as FieldType,
          sectionParentId ? { parentId: sectionParentId } : undefined
        );
      if (newId) {
        if (sectionParentId) {
          ui.getState().selectFieldChild(sectionParentId, newId);
        } else {
          ui.getState().selectField(newId);
        }
      }
    },
    [form, ui]
  );

  const allCollapsed = collapsed.size === categoryNames.length;

  return (
    <div className="tool-panel es:flex es:flex-1 es:flex-col es:min-h-0">
      <h3 className="tool-panel-title es:sticky es:top-0 es:z-10 es:bg-essurface es:text-sm es:font-semibold es:text-estext es:py-2 es:px-4 es:border-b es:border-esborder es:flex es:items-center es:justify-between">
        <div className="es:flex es:min-w-0 es:items-center es:gap-2">
          <span>Tools</span>
          <span
            className={`es:inline-flex es:max-w-[200px] es:items-center es:gap-1 es:rounded-full es:px-2.5 es:py-1 es:text-[11px] es:font-medium ${
              selectedSectionId
                ? 'es:bg-esprimary/10 es:text-esprimary'
                : 'es:bg-esbackgroundsecondary es:text-estextmuted'
            }`}
            title={
              selectedSectionId
                ? `Adding into section: ${selectedSectionLabel ?? ''}`
                : 'Adding into root'
            }
          >
            <span
              className={`es:inline-flex es:h-1.5 es:w-1.5 es:rounded-full ${
                selectedSectionId ? 'es:bg-esprimary' : 'es:bg-estextmuted'
              }`}
            />
            <span className="es:truncate">
              {selectedSectionId
                ? `Adding into section: ${selectedSectionLabel}`
                : 'Adding into root'}
            </span>
          </span>
          {selectedSectionId && (
            <button
              type="button"
              onClick={() => ui.getState().selectField(null)}
              className="es:inline-flex es:h-7 es:w-7 es:items-center es:justify-center es:rounded-full es:bg-esbackgroundsecondary es:text-estextmuted es:hover:bg-esbackgroundhover es:hover:text-estext es:border es:border-esborder es:outline-none es:focus:outline-none es:cursor-pointer"
              title="Switch to adding into root"
              aria-label="Switch to adding into root"
            >
              ×
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="toggle-all-btn es:text-xs es:font-normal es:text-estextmuted es:hover:text-estext es:bg-transparent es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer es:transition-colors"
          title={allCollapsed ? 'Expand all' : 'Collapse all'}
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      </h3>

      <div className="tool-panel-body es:flex-1 es:min-h-0 es:overflow-y-auto">
        {orderedCategoryNames.map((categoryName) => {
          const items = categories[categoryName] ?? [];
          const isCollapsed = collapsed.has(categoryName);
          return (
            <div key={categoryName} className="tool-category">
              <button
                type="button"
                onClick={() => toggleCategory(categoryName)}
                className="tool-category-title es:w-full es:sticky es:top-0 es:z-[5] es:bg-essurface es:text-xs es:font-semibold es:text-estextmuted es:px-4 es:py-2.5 es:border-b es:border-esborder es:border-0 es:uppercase es:tracking-wide es:flex es:items-center es:gap-1.5 es:cursor-pointer es:hover:bg-esbackgroundhover es:transition-colors es:outline-none es:focus:outline-none"
                aria-expanded={!isCollapsed}
              >
                <ChevronIcon
                  className={`es:w-3.5 es:h-3.5 es:shrink-0 es:transition-transform ${
                    isCollapsed ? 'es:-rotate-90' : ''
                  }`}
                />
                {CATEGORY_ICONS[categoryName] &&
                  React.createElement(CATEGORY_ICONS[categoryName], {
                    className: 'es:w-3.5 es:h-3.5 es:shrink-0',
                  })}
                <span className="es:flex-1 es:text-left">{categoryName}</span>
              </button>
              {!isCollapsed && (
                <div className="tool-items es:grid es:grid-cols-1 es:gap-1.5 es:px-3 es:py-2">
                  {items.map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      className="tool-btn es:flex es:items-center es:gap-2 es:px-3 es:py-2 es:text-sm es:text-left es:rounded-md es:bg-esbackground es:text-estext es:border es:border-transparent es:transition-colors es:hover:bg-esprimary/10 es:hover:border-esprimary/40 es:hover:text-esprimary es:cursor-pointer es:outline-none es:focus:outline-none es:focus-visible:ring-2 es:focus-visible:ring-esprimary"
                      onClick={() => handleAdd(type)}
                      title={`Add ${label}`}
                    >
                      <span className="tool-btn-plus es:flex es:items-center es:justify-center es:w-5 es:h-5 es:rounded es:bg-esbackgroundsecondary es:text-estextmuted es:text-xs es:font-bold es:shrink-0">
                        +
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
