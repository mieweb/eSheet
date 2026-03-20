import { useState } from 'react';
import { MsheetBuilder } from '@msheet/builder';
import type { FormDefinition } from '@msheet/core';
import { Navbar } from '../components/Navbar';

const INITIAL_DEF: FormDefinition = {
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
  ],
};

export function BuilderView() {
  const [def, setDef] = useState<FormDefinition>(INITIAL_DEF);

  return (
    <div className="demo-builder-view w-full h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="w-full flex justify-center px-2 pt-5">
          <MsheetBuilder definition={def} onChange={setDef} />
        </div>
      </div>
    </div>
  );
}
