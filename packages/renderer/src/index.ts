import './index.output.css';

// Main renderer component
export {
  EsheetRenderer,
  type EsheetRendererProps,
  type EsheetRendererHandle,
} from './lib/EsheetRenderer.js';

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
} from './lib/mcp/index.js';
export type {
  ToolDefinition,
  UseRendererMcpToolHandlerOptions,
} from './lib/mcp/index.js';
export type { RendererTools } from './lib/renderer-tools.js';
