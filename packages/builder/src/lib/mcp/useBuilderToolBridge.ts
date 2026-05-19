import React from 'react';
import type { BuilderTools } from '../builder-tools.js';
import { executeToolCall } from './tool-executor.js';

export interface UseBuilderMcpToolHandlerOptions {
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
 * the builder's MCP tool executor. Returns the `onBuilderToolsReady` callback
 * to pass to `<EsheetBuilder>`.
 *
 * @example – default (listens on document)
 * const onBuilderToolsReady = useBuilderMcpToolHandler();
 * <EsheetBuilder onBuilderToolsReady={onBuilderToolsReady} />
 *
 * @example – scoped to a container element
 * const ref = React.useRef<HTMLDivElement>(null);
 * const onBuilderToolsReady = useBuilderMcpToolHandler({ target: ref.current ?? undefined });
 * <div ref={ref}><EsheetBuilder onBuilderToolsReady={onBuilderToolsReady} /></div>
 *
 * @example – custom event name
 * const onBuilderToolsReady = useBuilderMcpToolHandler({ eventName: 'my-ai-tool-call' });
 */
export function useBuilderMcpToolHandler(
  options: UseBuilderMcpToolHandlerOptions,
): (tools: BuilderTools) => void {
  const { target, eventName } = options;
  const toolsRef = React.useRef<BuilderTools | null>(null);

  const onBuilderToolsReady = React.useCallback((tools: BuilderTools) => {
    toolsRef.current = tools;
  }, []);

  React.useEffect(() => {
    const el: EventTarget = target ?? document;

    function onToolCall(e: Event) {
      const { name, arguments: args, respond } = (e as CustomEvent).detail as {
        name: string;
        arguments: Record<string, unknown>;
        respond: (result: unknown) => void;
      };
      if (!toolsRef.current) {
        respond({ success: false, message: 'Builder not ready' });
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

  return onBuilderToolsReady;
}
