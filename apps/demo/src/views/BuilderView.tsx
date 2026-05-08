import { useState, useRef, useEffect } from 'react';
import { EsheetBuilder } from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';
import type { BuilderTools } from '@esheet/builder';
import { Navbar } from '../components/Navbar.js';
import { executeToolCall } from '../ai/tools.js';

const INITIAL_DEF: FormDefinition = {
  id: 'demo-builder',
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
  const toolsRef = useRef<BuilderTools | null>(null);

  function handleChange(next: FormDefinition) {
    setDef(next);
  }

  useEffect(() => {
    function onToolCall(e: Event) {
      const { name, arguments: args, respond } = (e as CustomEvent).detail as {
        name: string;
        arguments: Record<string, unknown>;
        respond: (result: unknown) => void;
      };
      if (!toolsRef.current) {
        respond({ success: false, message: 'Builder not ready' });
        return;
      }
      const result = executeToolCall(name, args, toolsRef.current);
      if (typeof result === 'string') {
        respond({ success: true, message: result });
      } else {
        respond(result);
      }
    }
    document.addEventListener('ozwell-tool-call', onToolCall);
    return () => document.removeEventListener('ozwell-tool-call', onToolCall);
  }, []);

  return (
    <div className="demo-builder-view w-full h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="w-full flex justify-center px-2 pt-5">
          <EsheetBuilder
            definition={def}
            onChange={handleChange}
            onBuilderToolsReady={(tools) => {
              toolsRef.current = tools;
            }}
          />
        </div>
      </div>
    </div>
  );
}
