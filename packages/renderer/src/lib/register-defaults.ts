// ---------------------------------------------------------------------------
// Built-in field component registration for the renderer
// ---------------------------------------------------------------------------
// Imported as a side-effect in the package entry point so consumers using
// only @msheet/renderer get all built-in field components automatically.
// ---------------------------------------------------------------------------

import { registerFieldComponents } from '@msheet/fields';
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
  SignatureField,
  DiagramField,
  ImageField,
  HtmlField,
  DisplayField,
} from '@msheet/fields';

registerFieldComponents({
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
  signature: SignatureField,
  diagram: DiagramField,
  image: ImageField,
  html: HtmlField,
  display: DisplayField,
});
