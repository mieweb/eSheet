import './styles.css';
import './ozwell-setup.js';
import { registerFieldComponents } from '@esheet/fields';
import {
  configureRichTextField,
  RichTextEditorField,
} from '@esheet/field-kerebron';
import { registerHealthFieldTypes } from '@esheet/field-health';
import {
  configureDocumentListComposeEditor,
  registerDocumentListFieldType,
} from '@esheet/document-list-field';
import { createAssetLoad } from '@kerebron/wasm/web';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer, ToastProvider, useToast } from '@mieweb/ui';
import { LandingPage } from './views/LandingPage';
import { BuilderView } from './views/BuilderView';
import { RendererView } from './views/RendererView';
import { CollabPlaygroundView } from './views/CollabPlaygroundView';
import { Navbar } from './components/Navbar';
import { BrandInitializer } from './components/BrandInitializer';

// Register plugin fields (imports also self-register metadata + Zod schema)
registerFieldComponents({ richtext: RichTextEditorField });
registerHealthFieldTypes({
  indexUrl: `${import.meta.env.BASE_URL}codify`.replace(/\/$/, ''),
});
registerDocumentListFieldType();

const kerebronAssetLoad = createAssetLoad(
  `${import.meta.env.BASE_URL}kerebron-wasm`.replace(/\/\//g, '/')
);
configureRichTextField({ assetLoad: kerebronAssetLoad });
configureDocumentListComposeEditor({ assetLoad: kerebronAssetLoad });

function App() {
  return (
    <ToastProvider>
      <DemoToastContainer />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <BrandInitializer />
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <LandingPage />
              </>
            }
          />
          <Route path="/builder" element={<BuilderView />} />
          <Route path="/renderer" element={<RendererView />} />
          <Route path="/collab-live" element={<CollabPlaygroundView />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

function DemoToastContainer() {
  const { toasts, dismiss } = useToast();
  return <ToastContainer toasts={toasts} onDismiss={dismiss} />;
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
