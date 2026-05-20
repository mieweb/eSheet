import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  EsheetRenderer,
  type EsheetRendererHandle,
  type EsheetRendererProps,
} from '@esheet/renderer';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

function toRendererProps(data: unknown): EsheetRendererProps {
  const fallback: EsheetRendererProps = { formDataInput: '' };
  if (!isRecord(data)) {
    return fallback;
  }

  const formDataInput = data.formDataInput;
  if (typeof formDataInput !== 'string' && !isRecord(formDataInput)) {
    return fallback;
  }

  const className =
    typeof data.className === 'string' ? data.className : undefined;
  const initialResponses = isRecord(data.initialResponses)
    ? (data.initialResponses as EsheetRendererProps['initialResponses'])
    : undefined;

  return {
    formDataInput: formDataInput as EsheetRendererProps['formDataInput'],
    className,
    initialResponses,
  };
}

export function registerBlazeTemplate(
  templateName = 'esheetRenderer'
): boolean {
  const globals = globalThis as UnknownRecord;
  const templateApi = globals.Template;
  const blazeApi = globals.Blaze;
  const htmlApi = globals.HTML;

  if (!isRecord(templateApi) || !isRecord(blazeApi) || !isRecord(htmlApi)) {
    return false;
  }

  const createTemplate = blazeApi.Template;
  const createDiv = htmlApi.DIV;

  if (!isFunction(createTemplate) || !isFunction(createDiv)) {
    return false;
  }

  const template = createTemplate(`Template.${templateName}`, () =>
    createDiv({ class: 'esheet-renderer-mount' })
  );

  templateApi[templateName] = template;

  if (!isRecord(template) || !isFunction(template.onRendered)) {
    return true;
  }

  template.onRendered(function onRendered(this: UnknownRecord) {
    const find = this.find;
    if (!isFunction(find)) {
      return;
    }

    const mountNode = find.call(this, '.esheet-renderer-mount') as
      | Parameters<typeof createRoot>[0]
      | null;

    if (!mountNode) {
      return;
    }

    const root: Root = createRoot(mountNode);
    const rendererRef = React.createRef<EsheetRendererHandle>();

    this.getResponse = () => rendererRef.current?.getRawResponse() ?? null;
    this.getValidResponse = () =>
      rendererRef.current?.getValidResponse() ?? null;

    const currentData = templateApi.currentData;
    const render = () => {
      const data = isFunction(currentData) ? currentData() : undefined;
      const props = toRendererProps(data);
      root.render(
        React.createElement(EsheetRenderer, { ...props, ref: rendererRef })
      );
    };

    const autorun = this.autorun;
    if (isFunction(autorun)) {
      autorun.call(this, render);
    } else {
      render();
    }

    const view = this.view;
    if (isRecord(view) && isFunction(view.onViewDestroyed)) {
      view.onViewDestroyed(() => root.unmount());
    }
  });

  return true;
}

const globals = globalThis as UnknownRecord;
if (globals.Meteor !== undefined) {
  registerBlazeTemplate();
}
