// ---------------------------------------------------------------------------
// Built-in field component registration
// ---------------------------------------------------------------------------
// Registers built-in field components for basic field types.
// Imported as a side-effect in the package entry point so consumers don't
// need to manually wire up every field.
// ---------------------------------------------------------------------------

import { registerBuilderComponents } from './component-registry.js';
import {
  TextField,
  LongTextField,
  MultiTextField,
  RadioField,
  CheckField,
  BooleanField,
  DropdownField,
  MultiSelectDropdownField,
  RatingField,
  RankingField,
  SliderField,
  SingleMatrixField,
  MultiMatrixField,
  SectionField,
} from '@msheet/fields';

registerBuilderComponents({
  text: TextField,
  longtext: LongTextField,
  multitext: MultiTextField,
  radio: RadioField,
  check: CheckField,
  boolean: BooleanField,
  dropdown: DropdownField,
  multiselectdropdown: MultiSelectDropdownField,
  rating: RatingField,
  ranking: RankingField,
  slider: SliderField,
  singlematrix: SingleMatrixField,
  multimatrix: MultiMatrixField,
  section: SectionField,
});
