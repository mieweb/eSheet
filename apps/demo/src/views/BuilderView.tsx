import { useEffect, useRef, useState } from 'react';
import {
  EsheetBuilder,
  useBuilderMcpToolHandler,
  type FormDefinition,
} from '@esheet/builder';
import { createDocumentListFieldProvider } from '@esheet/document-list-field';
import { useToast } from '@mieweb/ui';
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
  const [detailRowsExpanded, setDetailRowsExpanded] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { info } = useToast();

  useEffect(() => {
    updateOzwellTools(FORMIE_KEY);
  }, []);

  const onBuilderToolsReady = useBuilderMcpToolHandler({
    eventName: 'ozwell-tool-call',
  });

  const handleUpload = () => {
    info('Choose a document to upload.', { title: 'Upload button clicked' });
    uploadInputRef.current?.click();
  };

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) info(`${file.name} would be uploaded.`, { title: 'Upload' });
    event.target.value = '';
  };

  const documentListProvider = createDocumentListFieldProvider({
    detailRowsExpanded,
    onToggleDetails: () => setDetailRowsExpanded((expanded) => !expanded),
    onCompose: () =>
      info('Your functionality goes here. Compose button clicked.', {
        title: 'Compose',
      }),
    onUpload: handleUpload,
    renderDetailRow: (row) => (
      <div className="document-list-demo__detail px-4 py-3">
        <strong className="block text-sm">{row.title}</strong>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div>
            <dt className="font-medium">Date</dt>
            <dd>{row.date}</dd>
          </div>
          <div>
            <dt className="font-medium">Subject</dt>
            <dd>{row.subject}</dd>
          </div>
          <div>
            <dt className="font-medium">Document type</dt>
            <dd>{row.docType}</dd>
          </div>
          <div>
            <dt className="font-medium">Source</dt>
            <dd>{row.source}</dd>
          </div>
        </dl>
      </div>
    ),
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
            fieldProviders={[documentListProvider]}
          />
        </div>
        <input
          ref={uploadInputRef}
          id="document-list-demo-upload"
          type="file"
          aria-label="Select a document to upload"
          className="hidden"
          onChange={handleUploadChange}
        />
      </div>
    </div>
  );
}
