import './index.output.css';
import './lib/register-defaults.js';

// Main renderer component
export {
  MsheetRenderer,
  type MsheetRendererProps,
  type MsheetRendererHandle,
} from './lib/MsheetRenderer.js';

// Components (for advanced use cases)
export { RendererBody, FieldNode } from './lib/components/index.js';

// Hooks (for advanced use cases)
export { useRendererInit } from './lib/hooks/index.js';
