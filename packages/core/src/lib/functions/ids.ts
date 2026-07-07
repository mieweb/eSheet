// ---------------------------------------------------------------------------
// ID Generation — deterministic, human-readable, collision-free
// ---------------------------------------------------------------------------

/**
 * Convert a question/label string into a URL-safe slug.
 *
 * Examples:
 *   'How old are you?' → 'how-old-are-you'
 *   'Email Address'    → 'email-address'
 */
export function slugifyQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // strip non-alphanumeric, non-space, non-hyphen
    .replace(/\s+/g, '-') // spaces → hyphens
    .replace(/-+/g, '-') // collapse repeated hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * Generate a unique field ID.
 *
 * @param fieldType   - The field type (used as the base, e.g. `'text'`, `'radio'`).
 * @param existingIds - Set of all field IDs currently in the form.
 * @param parentId    - Optional section ID for hierarchical naming (e.g. `'s1-text'`).
 * @param question    - Optional question text to derive a slug-based ID from.
 */
export function generateFieldId(
  fieldType: string,
  existingIds: ReadonlySet<string>,
  parentId?: string,
  question?: string
): string {
  const slug = question ? slugifyQuestion(question) : '';
  const base = slug || fieldType || 'field';
  // Only apply parentId prefix for type-based IDs (slugs are already descriptive)
  const prefix = !slug && parentId ? `${parentId}-${base}` : base;
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
  fieldId?: string
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
  fieldId?: string
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
  fieldId?: string
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
