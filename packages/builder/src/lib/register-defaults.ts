// ---------------------------------------------------------------------------
// Built-in field component registration
// ---------------------------------------------------------------------------
// Registers built-in field components for basic field types.
// Explicitly invoked from EsheetBuilder at runtime via
// ensureDefaultFieldComponentsRegistered().
// Safe to call multiple times; registration is idempotent.
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

let defaultFieldComponentsRegistered = false;

export function ensureDefaultFieldComponentsRegistered(): void {
  if (defaultFieldComponentsRegistered) return;

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

  defaultFieldComponentsRegistered = true;
}
