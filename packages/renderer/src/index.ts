import './index.output.css';

// Main renderer component
export {
  EsheetRenderer,
  type EsheetRendererProps,
  type EsheetRendererHandle,
  type GetResponseOptions,
  type GetResponseResult,
  type ResponseFormat,
} from './lib/EsheetRenderer.js';

// Render tree builder (for computing setValue values in builder)
export {
  renderer,
  buildRenderTree,
  type RenderTreeOptions,
} from './lib/renderer.js';

// Core types (re-exported for consumer convenience)
export type {
  FormDefinition,
  FormResponseEnvelope,
  ValidationError,
} from '@esheet/core';

// Components (for advanced use cases)
export { RendererBody, FieldNode } from './lib/components/index.js';

// Hooks (for advanced use cases)
export { useRendererInit } from './lib/hooks/index.js';

// MCP tool integration
export {
  executeToolCall,
  RENDERER_TOOL_DEFINITIONS,
  RENDERER_SYSTEM_PROMPT,
  useRendererMcpToolHandler,
  type ToolDefinition,
  type UseRendererMcpToolHandlerOptions,
} from './lib/mcp/index.js';
export type { RendererTools } from './lib/renderer-tools.js';
