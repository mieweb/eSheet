import React from 'react';
import type { RendererTools } from '../renderer-tools.js';
import { executeToolCall } from './tool-executor.js';

export interface UseRendererMcpToolHandlerOptions {
  /**
   * The DOM element to listen on for tool-call events.
   * Pass `document` to listen globally, or a specific element to scope it.
   */
  target?: EventTarget;
  /**
   * The event name to listen for, e.g. `'ozwell-tool-call'`.
   */
  eventName: string;
}

/**
 * Listens for AI tool-call events on a target element and dispatches them to
 * the renderer's MCP tool executor. Returns the `onRendererToolsReady` callback
 * to pass to `<EsheetRenderer>`.
 *
 * @example – default (listens on document)
 * const onRendererToolsReady = useRendererMcpToolHandler({ eventName: 'ozwell-tool-call' });
 * <EsheetRenderer onRendererToolsReady={onRendererToolsReady} ... />
 *
 * @example – scoped to a container element
 * const ref = React.useRef<HTMLDivElement>(null);
 * const onRendererToolsReady = useRendererMcpToolHandler({ target: ref.current ?? undefined, eventName: 'ozwell-tool-call' });
 * <div ref={ref}><EsheetRenderer onRendererToolsReady={onRendererToolsReady} ... /></div>
 */
export function useRendererMcpToolHandler(
  options: UseRendererMcpToolHandlerOptions
): (tools: RendererTools) => void {
  const { target, eventName } = options;
  const toolsRef = React.useRef<RendererTools | null>(null);

  const onRendererToolsReady = React.useCallback((tools: RendererTools) => {
    toolsRef.current = tools;
  }, []);

  React.useEffect(() => {
    const el: EventTarget = target ?? document;

    function onToolCall(e: Event) {
      const {
        name: rawName,
        arguments: args,
        respond,
      } = (e as CustomEvent).detail as {
        name: string;
        arguments: Record<string, unknown>;
        respond: (result: unknown) => void;
      };
      // Strip 'postMessage:' prefix if present (added by Ozwell widget internally)
      const name = rawName.replace(/^postMessage:/, '');
      if (!toolsRef.current) {
        respond({ success: false, message: 'Renderer not ready' });
        return;
      }
      const toResponse = (r: string | Record<string, unknown>) =>
        typeof r === 'string' ? { result: r } : r;
      try {
        const result = executeToolCall(name, args, toolsRef.current);
        if (result instanceof Promise) {
          result
            .then((r) => respond(toResponse(r)))
            .catch((err) => respond({ error: String(err) }));
        } else {
          respond(toResponse(result));
        }
      } catch (err) {
        respond({ error: String(err) });
      }
    }

    el.addEventListener(eventName, onToolCall);
    return () => el.removeEventListener(eventName, onToolCall);
  }, [target, eventName]);

  return onRendererToolsReady;
}
