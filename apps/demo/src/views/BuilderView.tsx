import { useState, useRef, useEffect } from 'react';
import { EsheetBuilder } from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';
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
  const defRef = useRef(def);
  const [formKey, setFormKey] = useState(0);

  function handleChange(next: FormDefinition) {
    defRef.current = next;
    setDef(next);
  }

  useEffect(() => {
    function onToolCall(e: Event) {
      const { name, arguments: args, respond } = (e as CustomEvent).detail as {
        name: string;
        arguments: Record<string, unknown>;
        respond: (result: unknown) => void;
      };
      const result = executeToolCall(name, args, {
        getDefinition: () => defRef.current,
        setDefinition: handleChange,
      });
      // get_form_summary returns raw data so the LLM can chain a second tool call.
      // Mutation tools return a string confirmation wrapped as success/message.
      if (typeof result === 'string') {
        // Increment key to force EsheetBuilder to remount with the updated definition,
        // since it ignores definition prop changes after mount.
        setFormKey((k) => k + 1);
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
          <EsheetBuilder key={formKey} definition={def} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}
