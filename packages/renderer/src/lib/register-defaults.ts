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
  OpenChoiceField,
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
  FileField,
} from '@esheet/fields';

let defaultsRegistered = false;

/**
 * Built-in answer inputs are pure write surfaces, so a read-only form can
 * freeze them wholesale at the wrapper. Containers and presentation types
 * (section, display, html, image) stay interactive — their content (nested
 * fields, links) must remain browsable — and custom field types are expected
 * to gate their own write controls from `isReadOnly`.
 */
export const READ_ONLY_INERT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'text',
  'longtext',
  'multitext',
  'radio',
  'check',
  'openchoice',
  'boolean',
  'dropdown',
  'multiselectdropdown',
  'rating',
  'ranking',
  'slider',
  'singlematrix',
  'multimatrix',
  'signature',
  'diagram',
  'file',
  // Registered as an add-on (registerAutocompleteFieldType), but still a pure
  // answer input — freeze it like the built-ins.
  'autocomplete',
]);

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
    openchoice: OpenChoiceField,
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
    file: FileField,
    html: HtmlField,
    display: DisplayField,
  });

  defaultsRegistered = true;
}
