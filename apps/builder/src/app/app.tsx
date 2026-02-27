import { useState } from 'react';
import { MsheetBuilder } from '@msheet/builder';
import type { FormDefinition } from '@msheet/core';

export function App() {
  const [definition, setDefinition] = useState<FormDefinition>({
    schemaType: 'mieforms-v1.0',
    fields: [
      { id: 'q1', fieldType: 'text', question: 'What is your name?' },
      { id: 'q2', fieldType: 'text', question: 'What is your email?' },
    ],
  });

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Builder Demo</h1>
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
