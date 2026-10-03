import { useEffect, useMemo } from 'react';
import {
  EsheetBuilder,
  useBuilderMcpToolHandler,
  type FormDefinition,
} from '@esheet/builder';
import { createDocumentListFieldProvider } from '@esheet/fields-documents';
import { permissiveDocumentListCapabilities } from '@esheet/fields-documents';
import { createFileStoreProvider } from '@esheet/fields';
import { Navbar } from '../components/Navbar.js';
import { updateOzwellTools, FORMIE_KEY } from '../ozwell-setup.js';
import {
  DEMO_DOCUMENT_AUTHOR,
  createDemoDocumentListRepository,
  createDemoFileStore,
} from '../document-list-demo-repository.js';

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
        {
          id: 'q5',
          fieldType: 'documentList',
          question: 'Documents',
          documents: [
            {
              id: 'builder-doc-1',
              date: '2026-08-18',
              title: 'Hearing Test Results Letter',
              subject: 'Annual hearing screening',
              docType: 'Employee Letter',
              docId: '1842',
              source: 'WebChart',
              file: '1842.pdf',
              body: `# Hearing Test Results Letter

Your annual hearing screening results have been reviewed.

| Frequency | Left ear | Right ear |
| --- | ---: | ---: |
| 500 Hz | 10 dB | 10 dB |
| 1000 Hz | 10 dB | 15 dB |
| 2000 Hz | 15 dB | 15 dB |
| 4000 Hz | 20 dB | 20 dB |

No significant threshold shift was identified. Continue using the hearing protection required for your work area.`,
            },
            {
              id: 'builder-doc-2',
              date: '2026-08-12',
              title: 'Occupational Audiogram',
              subject: 'Audiometric test results',
              docType: 'Audiometric Test',
              docId: '1836',
              source: 'Clinic interface',
              file: '1836.html',
            },
          ],
        } as unknown as NonNullable<
          FormDefinition['pages'][number]['fields']
        >[number],
      ],
    },
  ],
};

export function BuilderView() {
  const documentRepository = useMemo(
    () => createDemoDocumentListRepository(),
    []
  );
  const fileStore = useMemo(() => createDemoFileStore(), []);

  useEffect(() => {
    updateOzwellTools(FORMIE_KEY);
  }, []);

  const onBuilderToolsReady = useBuilderMcpToolHandler({
    eventName: 'ozwell-tool-call',
  });

  const documentListProvider = createDocumentListFieldProvider(
    // A demo protects nothing; a real host resolves its own capabilities.
    {
      capabilities: permissiveDocumentListCapabilities,
      author: DEMO_DOCUMENT_AUTHOR,
    },
    { repository: documentRepository, fileStore }
  );
  const fileStoreProvider = createFileStoreProvider(fileStore);

  return (
    <div className="demo-builder-view w-full h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="w-full flex justify-center px-2 pt-5">
          <EsheetBuilder
            definition={INITIAL_DEF}
            onBuilderToolsReady={onBuilderToolsReady}
            allowDangerousJS={true}
            fieldProviders={[fileStoreProvider, documentListProvider]}
          />
        </div>
      </div>
    </div>
  );
}
