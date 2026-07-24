import './styles.css';
import './ozwell-setup.js';
import { registerFieldComponents } from '@esheet/fields';
import {
  RichTextEditorField,
  configureRichTextField,
} from '@esheet/field-kerebron';
import { createAssetLoad } from '@kerebron/wasm/web';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './views/LandingPage';
import { BuilderView } from './views/BuilderView';
import { RendererView } from './views/RendererView';
import { RendererPdfView } from './views/RendererPdfView';
import { CollabPlaygroundView } from './views/CollabPlaygroundView';
import { Navbar } from './components/Navbar';
import { BrandInitializer } from './components/BrandInitializer';

// Register plugin fields (imports also self-register metadata + Zod schema)
registerFieldComponents({ richtext: RichTextEditorField });

// The Vite plugin serves and emits these assets from the installed package.
configureRichTextField({
  assetLoad: createAssetLoad(
    `${import.meta.env.BASE_URL}kerebron-wasm`.replace(/\/\//g, '/')
  ),
});

if (import.meta.env.DEV) {
  await import('../../../packages/builder/src/index.output.css');
  await import('../../../packages/renderer/src/index.output.css');
}

function App() {
  return (
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
        <Route path="/renderer-pdf" element={<RendererPdfView />} />
        <Route path="/collab-live" element={<CollabPlaygroundView />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
