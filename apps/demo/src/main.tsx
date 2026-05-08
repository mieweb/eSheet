import './styles.css';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './views/LandingPage';
import { BuilderView } from './views/BuilderView';
import { RendererView } from './views/RendererView';
import { Navbar } from './components/Navbar';
import { BrandInitializer } from './components/BrandInitializer';

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
