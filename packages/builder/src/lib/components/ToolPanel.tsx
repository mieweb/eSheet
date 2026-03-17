import React from 'react';
import {
  getRegisteredFieldTypes,
  getFieldTypeMeta,
  type FormStore,
  type UIStore,
  type FieldType,
} from '@msheet/core';
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

import { getFieldComponent } from '../component-registry.js';

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
    () => (selectedFieldId ? form.getState().getField(selectedFieldId) : undefined),
    () => (selectedFieldId ? form.getState().getField(selectedFieldId) : undefined)
  );
  const selectedSectionId =
    selectedField?.definition.fieldType === 'section' ? selectedFieldId : undefined;
  const selectedSectionLabel = selectedSectionId
    ? selectedField?.definition.title || selectedField?.definition.id || selectedSectionId
    : null;

  const categories = React.useMemo(buildCategories, []);
  const categoryNames = React.useMemo(
    () => Object.keys(categories),
    [categories]
  );
  const orderedCategoryNames = React.useMemo(() => {
    const org = categoryNames.includes('Organization')
      ? ['Organization']
      : [];
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

      const newId = form.getState().addField(
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
    <div className="tool-panel ms:flex ms:flex-1 ms:flex-col ms:min-h-0">
      <h3 className="tool-panel-title ms:sticky ms:top-0 ms:z-10 ms:bg-mssurface ms:text-sm ms:font-semibold ms:text-mstext ms:py-2 ms:px-4 ms:border-b ms:border-msborder ms:flex ms:items-center ms:justify-between">
        <div className="ms:flex ms:min-w-0 ms:items-center ms:gap-2">
          <span>Tools</span>
          <span
            className={`ms:inline-flex ms:max-w-[200px] ms:items-center ms:gap-1 ms:rounded-full ms:px-2.5 ms:py-1 ms:text-[11px] ms:font-medium ${
              selectedSectionId
                ? 'ms:bg-msprimary/10 ms:text-msprimary'
                : 'ms:bg-msbackgroundsecondary ms:text-mstextmuted'
            }`}
            title={
              selectedSectionId
                ? `Adding into section: ${selectedSectionLabel ?? ''}`
                : 'Adding into root'
            }
          >
            <span className={`ms:inline-flex ms:h-1.5 ms:w-1.5 ms:rounded-full ${selectedSectionId ? 'ms:bg-msprimary' : 'ms:bg-mstextmuted'}`} />
            <span className="ms:truncate">
              {selectedSectionId
                ? `Adding into section: ${selectedSectionLabel}`
                : 'Adding into root'}
            </span>
          </span>
          {selectedSectionId && (
            <button
              type="button"
              onClick={() => ui.getState().selectField(null)}
              className="ms:inline-flex ms:h-7 ms:w-7 ms:items-center ms:justify-center ms:rounded-full ms:bg-msbackgroundsecondary ms:text-mstextmuted ms:hover:bg-msbackgroundhover ms:hover:text-mstext ms:border ms:border-msborder ms:outline-none ms:focus:outline-none ms:cursor-pointer"
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
          className="toggle-all-btn ms:text-xs ms:font-normal ms:text-mstextmuted ms:hover:text-mstext ms:bg-transparent ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer ms:transition-colors"
          title={allCollapsed ? 'Expand all' : 'Collapse all'}
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      </h3>

      <div className="tool-panel-body ms:flex-1 ms:min-h-0 ms:overflow-y-auto">
        {orderedCategoryNames.map((categoryName) => {
          const items = categories[categoryName] ?? [];
          const isCollapsed = collapsed.has(categoryName);
          return (
            <div key={categoryName} className="tool-category">
              <button
                type="button"
                onClick={() => toggleCategory(categoryName)}
                className="tool-category-title ms:w-full ms:sticky ms:top-0 ms:z-[5] ms:bg-mssurface ms:text-xs ms:font-semibold ms:text-mstextmuted ms:px-4 ms:py-2.5 ms:border-b ms:border-msborder ms:border-0 ms:uppercase ms:tracking-wide ms:flex ms:items-center ms:gap-1.5 ms:cursor-pointer ms:hover:bg-msbackgroundhover ms:transition-colors ms:outline-none ms:focus:outline-none"
                aria-expanded={!isCollapsed}
              >
                <ChevronIcon
                  className={`ms:w-3.5 ms:h-3.5 ms:shrink-0 ms:transition-transform ${
                    isCollapsed ? 'ms:-rotate-90' : ''
                  }`}
                />
                {CATEGORY_ICONS[categoryName] &&
                  React.createElement(CATEGORY_ICONS[categoryName], {
                    className: 'ms:w-3.5 ms:h-3.5 ms:shrink-0',
                  })}
                <span className="ms:flex-1 ms:text-left">{categoryName}</span>
              </button>
              {!isCollapsed && (
                <div className="tool-items ms:grid ms:grid-cols-1 ms:gap-1.5 ms:px-3 ms:py-2">
                  {items.map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      className="tool-btn ms:flex ms:items-center ms:gap-2 ms:px-3 ms:py-2 ms:text-sm ms:text-left ms:rounded-md ms:bg-msbackground ms:text-mstext ms:border ms:border-transparent ms:transition-colors ms:hover:bg-msprimary/10 ms:hover:border-msprimary/40 ms:hover:text-msprimary ms:cursor-pointer ms:outline-none ms:focus:outline-none ms:focus-visible:ring-2 ms:focus-visible:ring-msprimary"
                      onClick={() => handleAdd(type)}
                      title={`Add ${label}`}
                    >
                      <span className="tool-btn-plus ms:flex ms:items-center ms:justify-center ms:w-5 ms:h-5 ms:rounded ms:bg-msbackgroundsecondary ms:text-mstextmuted ms:text-xs ms:font-bold ms:shrink-0">
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
