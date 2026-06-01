// Side-effect import to ensure CSS is loaded when module is imported
import './touch-mode.css';

export {
  useTouchMode,
  type TouchModeConfig,
  type TouchModeState,
} from './useTouchMode.js';
