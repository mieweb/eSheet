import {
  executeToolCall,
  RENDERER_SYSTEM_PROMPT,
  RENDERER_TOOL_DEFINITIONS,
  type RendererTools,
} from '@esheet/renderer';

export interface OzwellBridgeOptions {
  /** DOM event dispatched by the Ozwell loader for page tool calls. */
  eventName?: string;
  /** Event target the loader dispatches on. Defaults to `document`. */
  target?: EventTarget;
}

export interface OzwellBridge {
  /** Pass as `onRendererToolsReady` to the renderer. */
  onRendererToolsReady: (tools: RendererTools) => void;
  /** Removes the event listener. */
  dispose: () => void;
}

/**
 * Non-React equivalent of `useRendererMcpToolHandler`: routes Ozwell
 * `ozwell-tool-call` events to the renderer's MCP tool executor.
 */
export function createOzwellBridge(
  options: OzwellBridgeOptions = {}
): OzwellBridge {
  const eventName = options.eventName ?? 'ozwell-tool-call';
  const target: EventTarget = options.target ?? document;
  let tools: RendererTools | null = null;

  function onToolCall(e: Event) {
    const detail = (e as CustomEvent).detail as {
      name: string;
      arguments: Record<string, unknown>;
      respond: (result: unknown) => void;
    };
    const name = detail.name.replace(/^postMessage[:_]/, '');
    if (!tools) {
      detail.respond({ success: false, message: 'Renderer not ready' });
      return;
    }
    const toResponse = (r: string | Record<string, unknown>) =>
      typeof r === 'string' ? { result: r } : r;
    try {
      const result = executeToolCall(name, detail.arguments ?? {}, tools);
      if (result instanceof Promise) {
        result
          .then((r) => detail.respond(toResponse(r)))
          .catch((err) => detail.respond({ error: String(err) }));
      } else {
        detail.respond(toResponse(result));
      }
    } catch (err) {
      detail.respond({ error: String(err) });
    }
  }

  target.addEventListener(eventName, onToolCall);

  return {
    onRendererToolsReady: (t) => {
      tools = t;
    },
    dispose: () => {
      tools = null;
      target.removeEventListener(eventName, onToolCall);
    },
  };
}

/**
 * Page tools and system prompt for `window.OzwellChatConfig`, so the Ozwell
 * widget knows which renderer tools the page can execute.
 */
export function getOzwellChatConfig(): {
  tools: typeof RENDERER_TOOL_DEFINITIONS;
  system: string;
} {
  return {
    tools: RENDERER_TOOL_DEFINITIONS,
    system: RENDERER_SYSTEM_PROMPT,
  };
}
