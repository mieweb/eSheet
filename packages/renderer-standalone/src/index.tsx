import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  EsheetRenderer,
  createDocumentPickerProvider,
  type DocumentPicker,
  type EsheetRendererHandle,
  type EsheetRendererProps,
} from '@esheet/renderer';

import {
  registerOptionsProvider,
  unregisterOptionsProvider,
  type OptionsProvider,
  type ProvidedOption,
} from '@esheet/core';

import {
  createOzwellBridge,
  getOzwellChatConfig,
  type OzwellBridge,
  type OzwellBridgeOptions,
} from './ozwell.js';

export {
  registerOptionsProvider,
  unregisterOptionsProvider,
  type OptionsProvider,
  type ProvidedOption,
};

export type { DocumentPicker };

export {
  createOzwellBridge,
  getOzwellChatConfig,
  type OzwellBridge,
  type OzwellBridgeOptions,
};

export type EsheetStandaloneRendererProps = EsheetRendererProps & {
  /** Adds a "Choose from chart" button to file fields, backed by this host-supplied source. */
  documentPicker?: DocumentPicker;
  /**
   * Lets the Ozwell AI widget fill fields: routes its `ozwell-tool-call`
   * events to the renderer's tools. Pass `true` or bridge options.
   */
  ozwell?: boolean | OzwellBridgeOptions;
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
  { documentPicker, ozwell, ...props }: EsheetStandaloneRendererProps
): EsheetRendererStandaloneHandle {
  const ozwellBridge = ozwell
    ? createOzwellBridge(ozwell === true ? {} : ozwell)
    : null;
  let root: Root;
  try {
    root = createRoot(container);
  } catch (error) {
    ozwellBridge?.dispose();
    throw error;
  }
  const rendererRef = React.createRef<EsheetRendererHandle>();
  const fieldProviders = documentPicker
    ? [
        ...(props.fieldProviders ?? []),
        createDocumentPickerProvider(documentPicker),
      ]
    : props.fieldProviders;

  let toolsReady = false;
  let pendingReady = false;
  const onReady = ozwellBridge
    ? () => {
        if (toolsReady) props.onReady?.();
        else pendingReady = true;
      }
    : props.onReady;
  const onRendererToolsReady = ozwellBridge
    ? (tools: Parameters<OzwellBridge['onRendererToolsReady']>[0]) => {
        ozwellBridge.onRendererToolsReady(tools);
        toolsReady = true;
        props.onRendererToolsReady?.(tools);
        if (pendingReady) {
          pendingReady = false;
          props.onReady?.();
        }
      }
    : props.onRendererToolsReady;

  root.render(
    React.createElement(EsheetRenderer, {
      ...props,
      onReady,
      onRendererToolsReady,
      fieldProviders,
      ref: rendererRef,
    })
  );

  return {
    unmount: () => {
      ozwellBridge?.dispose();
      root.unmount();
    },
    getResponse: () => rendererRef.current?.getRawResponse() ?? null,
    getValidResponse: () => rendererRef.current?.getValidResponse() ?? null,
  };
}

type GlobalWithStandalone = typeof globalThis & {
  EsheetRendererStandalone?: {
    mount: typeof mountStandaloneRenderer;
    getOzwellChatConfig: typeof getOzwellChatConfig;
    registerOptionsProvider: typeof registerOptionsProvider;
    unregisterOptionsProvider: typeof unregisterOptionsProvider;
  };
};

const globalWithStandalone = globalThis as GlobalWithStandalone;
if (!globalWithStandalone.EsheetRendererStandalone) {
  globalWithStandalone.EsheetRendererStandalone = {
    mount: mountStandaloneRenderer,
    getOzwellChatConfig,
    registerOptionsProvider,
    unregisterOptionsProvider,
  };
}
