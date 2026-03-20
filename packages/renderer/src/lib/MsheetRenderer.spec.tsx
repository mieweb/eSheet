// @vitest-environment jsdom
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { SCHEMA_TYPE } from '@msheet/core';
import { MsheetRenderer, type MsheetRendererHandle } from './MsheetRenderer.js';
import './register-defaults.js';

afterEach(cleanup);

describe('MsheetRenderer', () => {
  it('mounts and exposes ref handle', async () => {
    const ref = React.createRef<MsheetRendererHandle>();
    await act(async () => {
      render(
        <MsheetRenderer
          ref={ref}
          formData={{
            schemaType: SCHEMA_TYPE,
            title: 'Test',
            fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
          }}
        />
      );
    });

    expect(ref.current).not.toBeNull();
    expect(typeof ref.current!.getResponse).toBe('function');
    expect(typeof ref.current!.getFormStore).toBe('function');
    expect(typeof ref.current!.getUIStore).toBe('function');
  });

  it('getResponse() returns initialResponses after mount', async () => {
    const ref = React.createRef<MsheetRendererHandle>();
    await act(async () => {
      render(
        <MsheetRenderer
          ref={ref}
          formData={{
            schemaType: SCHEMA_TYPE,
            title: 'Test',
            fields: [{ id: 'q1', fieldType: 'text', question: 'Name?' }],
          }}
          initialResponses={{ q1: { answer: 'Alice' } }}
        />
      );
    });

    const responses = ref.current!.getResponse();
    expect(responses['q1']).toMatchObject({ answer: 'Alice' });
  });

  it('getFormStore() has the loaded definition', async () => {
    const ref = React.createRef<MsheetRendererHandle>();
    await act(async () => {
      render(
        <MsheetRenderer
          ref={ref}
          formData={{
            schemaType: SCHEMA_TYPE,
            title: 'Test Form',
            fields: [{ id: 'f1', fieldType: 'text', question: 'Q?' }],
          }}
        />
      );
    });

    const normalized = ref.current!.getFormStore().getState().normalized;
    expect(normalized.rootIds).toContain('f1');
  });

  it('getUIStore() is in preview mode after mount', async () => {
    const ref = React.createRef<MsheetRendererHandle>();
    await act(async () => {
      render(
        <MsheetRenderer
          ref={ref}
          formData={{
            schemaType: SCHEMA_TYPE,
            title: 'Test',
            fields: [{ id: 'q1', fieldType: 'text', question: 'Q?' }],
          }}
        />
      );
    });

    const mode = ref.current!.getUIStore().getState().mode;
    expect(mode).toBe('preview');
  });
});
