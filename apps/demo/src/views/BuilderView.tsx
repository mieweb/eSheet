import { useEffect } from 'react';
import {
  EsheetBuilder,
  useBuilderMcpToolHandler,
  type FormDefinition,
} from '@esheet/builder';
import { Navbar } from '../components/Navbar.js';
import { updateOzwellTools, FORMIE_KEY } from '../ozwell-setup.js';

const INITIAL_DEF: FormDefinition = {
  id: 'demo-builder',
  pages: [
    {
      id: 'sheet-1',
      title: 'Initial sheet',
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
          fieldType: 'richtext',
          question: 'Tell us more (rich text):',
        } as unknown as NonNullable<
          FormDefinition['pages'][number]['fields']
        >[number],
      ],
    },
  ],
};

export function BuilderView() {
  useEffect(() => {
    updateOzwellTools(FORMIE_KEY);
  }, []);

  const onBuilderToolsReady = useBuilderMcpToolHandler({
    eventName: 'ozwell-tool-call',
  });

  return (
    <div className="demo-builder-view w-full h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="w-full flex justify-center px-2 pt-5">
          <EsheetBuilder
            definition={INITIAL_DEF}
            onBuilderToolsReady={onBuilderToolsReady}
            allowDangerousJS={true}
          />
        </div>
      </div>
    </div>
  );
}
