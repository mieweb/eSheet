import { useState } from 'react';
import { MsheetBuilder, registerBuilderComponents } from '@msheet/builder';
import {
  TextField,
  LongTextField,
  MultiTextField,
  RadioField,
  CheckField,
  BooleanField,
  DropdownField,
  MultiSelectDropdownField,
} from '@msheet/fields';
import type { FormDefinition } from '@msheet/core';

// Register field components once at module scope
registerBuilderComponents({
  text: TextField,
  longtext: LongTextField,
  multitext: MultiTextField,
  radio: RadioField,
  check: CheckField,
  boolean: BooleanField,
  dropdown: DropdownField,
  multiselect: MultiSelectDropdownField,
});

export function App() {
  const [definition, setDefinition] = useState<FormDefinition>({
    schemaType: 'mieforms-v1.0',
    fields: [
      { id: 'q1', fieldType: 'text', question: 'What is your name?' },
      {
        id: 'q2',
        fieldType: 'text',
        question: 'What is your email?',
        inputType: 'email',
      },
      {
        id: 'q3',
        fieldType: 'radio',
        question: 'Favorite color?',
        options: [
          { id: 'o1', value: 'Red' },
          { id: 'o2', value: 'Blue' },
          { id: 'o3', value: 'Green' },
        ],
      },
      {
        id: 'q4',
        fieldType: 'singlematrix',
        question: 'Rate these:',
        rows: [
          { id: 'r1', value: 'Speed' },
          { id: 'r2', value: 'Quality' },
        ],
        columns: [
          { id: 'c1', value: 'Poor' },
          { id: 'c2', value: 'Good' },
          { id: 'c3', value: 'Excellent' },
        ],
      },
    ],
  });

  return (
    <div style={{ padding: '2rem' }}>
      <MsheetBuilder
        definition={definition}
        onChange={(newDef) => {
          console.log('Definition changed:', newDef);
          setDefinition(newDef);
        }}
      />
    </div>
  );
}

export default App;
