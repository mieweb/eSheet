import './index.css';
import { registerAllergyListFieldType } from './AllergyListField.js';
import { CodeLookup } from './CodeLookup/index.js';
import { registerMedicationListFieldType } from './MedicationListField.js';
import type { CodeLookupConfig } from '@mieweb/ui';

export interface RegisterHealthFieldTypesOptions {
  indexUrl: string;
  locale?: string;
}

export function registerHealthFieldTypes(
  options: RegisterHealthFieldTypesOptions
): void {
  const codeLookup = {
    component: CodeLookup,
    indexUrl: options.indexUrl,
    locale: options.locale,
  } satisfies CodeLookupConfig;

  registerMedicationListFieldType({ codeLookup });
  registerAllergyListFieldType({ codeLookup });
}

export {
  CodeLookup,
  normalize,
  parseShard,
  searchShards,
} from './CodeLookup/index.js';
export type {
  CodeLookupProps,
  CodifyDomain,
  CodifyResult,
  CodifyShard,
} from './CodeLookup/index.js';

export {
  AllergyListField,
  registerAllergyListFieldType,
} from './AllergyListField.js';
export type {
  AllergyListFieldProps,
  AllergyListFieldValue,
} from './AllergyListField.js';
export {
  MedicationListField,
  registerMedicationListFieldType,
} from './MedicationListField.js';
export type {
  MedicationListFieldProps,
  MedicationListFieldValue,
} from './MedicationListField.js';
