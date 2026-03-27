import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  EsheetRenderer,
  type EsheetRendererHandle,
  type EsheetRendererProps,
} from '@esheet/renderer';

export interface EsheetRendererStandaloneHandle {
  unmount: () => void;
  getResponse: () => ReturnType<EsheetRendererHandle['getResponse']> | null;
  getValidResponse: () => ReturnType<
    EsheetRendererHandle['getValidResponse']
  > | null;
}

export function mountStandaloneRenderer(
  container: Parameters<typeof createRoot>[0],
  props: EsheetRendererProps
): EsheetRendererStandaloneHandle {
  const root: Root = createRoot(container);
  const rendererRef = React.createRef<EsheetRendererHandle>();

  root.render(
    React.createElement(EsheetRenderer, { ...props, ref: rendererRef })
  );

  return {
    unmount: () => root.unmount(),
    getResponse: () => rendererRef.current?.getResponse() ?? null,
    getValidResponse: () => rendererRef.current?.getValidResponse() ?? null,
  };
}

type GlobalWithStandalone = typeof globalThis & {
  EsheetRendererStandalone?: {
    mount: typeof mountStandaloneRenderer;
  };
};

const globalWithStandalone = globalThis as GlobalWithStandalone;
if (!globalWithStandalone.EsheetRendererStandalone) {
  globalWithStandalone.EsheetRendererStandalone = {
    mount: mountStandaloneRenderer,
  };
}
