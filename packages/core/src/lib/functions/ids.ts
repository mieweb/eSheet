// ---------------------------------------------------------------------------
// ID Generation — deterministic, human-readable, collision-free
// ---------------------------------------------------------------------------

/**
 * Generate a unique field ID.
 *
 * @param fieldType  - The field type (used as the base, e.g. `'text'`, `'radio'`).
 * @param existingIds - Set of all field IDs currently in the form.
 * @param parentId   - Optional section ID for hierarchical naming (e.g. `'s1-text'`).
 */
export function generateFieldId(
  fieldType: string,
  existingIds: ReadonlySet<string>,
  parentId?: string,
): string {
  const prefix = parentId ? `${parentId}-${fieldType}` : fieldType || 'field';
  return generateId(prefix, existingIds);
}

/**
 * Generate a unique option ID within a field.
 *
 * @param existingIds - Set of option IDs already in the field.
 * @param fieldId     - The owning field's ID (e.g. `'radio'` → `'radio-option'`).
 */
export function generateOptionId(
  existingIds: ReadonlySet<string>,
  fieldId?: string,
): string {
  const prefix = fieldId ? `${fieldId}-option` : 'option';
  return generateId(prefix, existingIds);
}

/**
 * Generate a unique row ID for a matrix field.
 *
 * @param existingIds - Set of row IDs already in the field.
 * @param fieldId     - The owning field's ID (e.g. `'matrix'` → `'matrix-row'`).
 */
export function generateRowId(
  existingIds: ReadonlySet<string>,
  fieldId?: string,
): string {
  const prefix = fieldId ? `${fieldId}-row` : 'row';
  return generateId(prefix, existingIds);
}

/**
 * Generate a unique column ID for a matrix field.
 *
 * @param existingIds - Set of column IDs already in the field.
 * @param fieldId     - The owning field's ID (e.g. `'matrix'` → `'matrix-col'`).
 */
export function generateColumnId(
  existingIds: ReadonlySet<string>,
  fieldId?: string,
): string {
  const prefix = fieldId ? `${fieldId}-col` : 'col';
  return generateId(prefix, existingIds);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique ID with the given prefix, avoiding collisions
 * with existing IDs. Appends an incrementing numeric suffix when needed.
 */
function generateId(prefix: string, existingIds: ReadonlySet<string>): string {
  if (!existingIds.has(prefix)) return prefix;

  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-(\\d+)$`);

  let max = 0;
  for (const id of existingIds) {
    const match = pattern.exec(id);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }

  return `${prefix}-${max + 1}`;
}
