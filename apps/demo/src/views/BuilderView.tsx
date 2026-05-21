import { useEffect } from 'react';
import {
  EsheetBuilder,
  useBuilderMcpToolHandler,
  BUILDER_TOOL_DEFINITIONS,
} from '@esheet/builder';
import type { FormDefinition } from '@esheet/core';
import { Navbar } from '../components/Navbar.js';
import { updateOzwellTools } from '../ozwell-setup.js';

const BUILDER_SYSTEM =
  'Form builder assistant. Field types: text, longtext, multitext, radio, check, boolean, dropdown, multiselectdropdown, rating, ranking, slider, singlematrix, multimatrix, image, html, signature, diagram, display, section. ' +
  'STRICT WORKFLOW: Before editing options/rows/columns on any field, call get_form_summary first to confirm the fieldType. ' +
  'singlematrix and multimatrix fields are created empty (no default rows or columns) — after creating one, use add_row/add_column to populate it. Use update_row/remove_row for rows and update_column/remove_column for columns — NEVER use add_option on matrix fields. ' +
  'add_option is ONLY for: radio, check, boolean, dropdown, multiselectdropdown, rating, ranking, slider, multitext. ' +
  'IMPORTANT: When building a new form or questionnaire from scratch, ALWAYS call reset_form first to clear placeholder fields before adding new ones. ' +
  'When using sections: first create the section field, then pass its ID as parentId on each subsequent create_field call to place fields inside it. ' +
  'PREVIEW FILL WORKFLOW: When asked to fill the preview form, call fill_field for each field. Each response includes currentVisibleFields with hasValue flags — fill every field where hasValue is false (including newly revealed ones). Never skip a field; generate realistic mock values for all fields including dates and times. ' +
  'TEXT FIELD FORMATS: each field includes a valueFormat property — use it exactly (YYYY-MM-DD for date, YYYY-MM-DDTHH:mm for datetime-local, YYYY-MM for month, HH:mm for time). Wrong formats are rejected. ' +
  'For conversational questions reply in plain text without calling a tool.';

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
  useEffect(() => {
    updateOzwellTools([...BUILDER_TOOL_DEFINITIONS], BUILDER_SYSTEM);
  }, []);

  const onBuilderToolsReady = useBuilderMcpToolHandler({
    eventName: 'ozwell-tool-call',
  });

  return (
    <div className="demo-builder-view w-full h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 overflow-y-auto ms:bg-msbackground">
        <div className="w-full flex justify-center px-2 pt-5">
          <EsheetBuilder
            definition={INITIAL_DEF}
            onBuilderToolsReady={onBuilderToolsReady}
          />
        </div>
      </div>
    </div>
  );
}
