import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  EsheetRenderer,
  type EsheetRendererHandle,
  type EsheetRendererProps,
} from '@esheet/renderer';

import {
  registerOptionsProvider,
  unregisterOptionsProvider,
  type OptionsProvider,
  type ProvidedOption,
} from '@esheet/core';

export {
  registerOptionsProvider,
  unregisterOptionsProvider,
  type OptionsProvider,
  type ProvidedOption,
};

export interface EsheetRendererStandaloneHandle {
  unmount: () => void;
  getResponse: () => ReturnType<EsheetRendererHandle['getRawResponse']> | null;
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
    getResponse: () => rendererRef.current?.getRawResponse() ?? null,
    getValidResponse: () => rendererRef.current?.getValidResponse() ?? null,
  };
}

type GlobalWithStandalone = typeof globalThis & {
  EsheetRendererStandalone?: {
    mount: typeof mountStandaloneRenderer;
    registerOptionsProvider: typeof registerOptionsProvider;
    unregisterOptionsProvider: typeof unregisterOptionsProvider;
  };
};

const globalWithStandalone = globalThis as GlobalWithStandalone;
if (!globalWithStandalone.EsheetRendererStandalone) {
  globalWithStandalone.EsheetRendererStandalone = {
    mount: mountStandaloneRenderer,
    registerOptionsProvider,
    unregisterOptionsProvider,
  };
}
