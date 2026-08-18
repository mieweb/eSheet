import { useMemo } from 'react';
import type { FieldComponentProps } from '@esheet/core';
import {
  DocumentListGrid,
  useDocumentListFieldHost,
} from './DocumentListGrid.js';
import { normalizeDocumentRows, parseDocumentListAnswer } from './data.js';
import type { DocumentListDefinition } from './types.js';

export function DocumentListField({
  field,
  response,
}: FieldComponentProps): React.JSX.Element {
  const definition = field.definition as DocumentListDefinition;
  const host = useDocumentListFieldHost();
  const rows = useMemo(
    () =>
      response?.answer
        ? parseDocumentListAnswer(response.answer)
        : normalizeDocumentRows(definition.documents),
    [definition.documents, response?.answer]
  );
  const title =
    typeof definition.question === 'string' && definition.question.trim()
      ? definition.question
      : 'Documents';

  return (
    <section className="document-list-field" aria-label={title}>
      <DocumentListGrid rows={rows} title={title} {...(host ?? {})} />
    </section>
  );
}
