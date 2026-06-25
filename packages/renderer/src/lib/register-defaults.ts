// ---------------------------------------------------------------------------
// Built-in field component registration for the renderer
// ---------------------------------------------------------------------------
// Called from EsheetRenderer runtime path so consumers get built-in defaults
// without relying on package entry side-effect imports.
// ---------------------------------------------------------------------------

import { registerFieldComponents } from '@esheet/fields';
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
  ActionField,
} from '@esheet/fields';

let defaultsRegistered = false;

export function ensureDefaultFieldComponentsRegistered(): void {
  if (defaultsRegistered) {
    return;
  }

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
    action: ActionField,
  });

  defaultsRegistered = true;
}
