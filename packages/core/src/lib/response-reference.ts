/** A stable pointer to another response document, never its answers or grants. */
export interface ResponseReference {
  collection: string;
  id: string;
  relationship?: string;
}

/** Read a reference from an object or a field's serialized answer. */
export function parseResponseReference(
  value: unknown
): ResponseReference | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => !['collection', 'id', 'relationship'].includes(key)
    )
  )
    return null;
  const valid = (part: unknown): part is string =>
    typeof part === 'string' &&
    part.trim().length > 0 &&
    !/[\u0000-\u001f]/.test(part);
  if (!valid(record.collection) || !valid(record.id)) return null;
  if (record.relationship !== undefined && !valid(record.relationship))
    return null;
  return {
    collection: record.collection,
    id: record.id,
    ...(record.relationship === undefined
      ? {}
      : { relationship: record.relationship }),
  };
}

/** Store only the reference in an answer; the target remains separate. */
export function serializeResponseReference(
  reference: ResponseReference
): string {
  const parsed = parseResponseReference(reference);
  if (!parsed) throw new TypeError('Invalid response reference');
  return JSON.stringify(parsed);
}

export type ResponseReferenceResolution =
  | { status: 'available'; label: string; href: string }
  | { status: 'restricted'; label?: string; href?: string }
  | { status: 'missing'; label?: string };

/** Resolve approved display metadata only. The server authorizes target access. */
export type ResponseReferenceResolver = (
  reference: ResponseReference,
  signal: AbortSignal
) => ResponseReferenceResolution | Promise<ResponseReferenceResolution>;

export type ResponseReferenceNavigate = (
  reference: ResponseReference,
  resolution: ResponseReferenceResolution
) => void;
