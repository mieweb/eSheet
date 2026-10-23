import { getFieldTypeMeta } from '../registry.js';
import {
  fieldDefinitionSchema,
  type FormDefinition,
  type FieldResponseMap,
  type FieldOption,
} from '../types.js';
import { normalizeDefinition } from './normalize.js';

/** Initial answers derived from the definition, never from a separate option-ID map. */
export function defaultResponses(
  pages: FormDefinition['pages']
): FieldResponseMap {
  const responses: FieldResponseMap = {};
  for (const { definition } of Object.values(normalizeDefinition(pages).byId)) {
    const options: FieldOption[] =
      'options' in definition && Array.isArray(definition.options)
        ? definition.options
        : [];
    const hasTextDefault =
      'defaultAnswer' in definition && definition.defaultAnswer !== undefined;
    if (!hasTextDefault && !options.some((option) => option.defaultOption))
      continue;
    fieldDefinitionSchema.parse(definition);
    const meta = getFieldTypeMeta(definition.fieldType);
    if (
      'defaultAnswer' in definition &&
      definition.defaultAnswer !== undefined
    ) {
      responses[definition.id] = { answer: definition.defaultAnswer };
    }
    const selected = options
      .filter((option) => option.defaultOption)
      .map(({ id, value }) => ({ id, value }));
    if (selected.length) {
      responses[definition.id] = {
        selected:
          meta?.answerType === 'multiselection' ? selected : selected[0],
      };
    }
  }
  return responses;
}
