import { useState } from 'react';
import { MsheetBuilder } from '@msheet/builder';
import type { FormDefinition } from '@msheet/core';

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
    <MsheetBuilder
      definition={definition}
      onChange={(newDef) => {
        console.log('Definition changed:', newDef);
        setDefinition(newDef);
      }}
    />
  );
}

export default App;
