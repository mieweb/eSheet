import { registerFieldType } from '@esheet/core';
import type { AssetLoad } from '@kerebron/editor';
import { setAssetLoad } from './asset-load.js';

/**
 * Configure the Kerebron rich text editor.
 * Call this once at app startup before rendering any richtext fields.
 *
 * @param assetLoad - Function that fetches WASM assets by filename.
 *   Use `createAssetLoad(url)` from `@kerebron/wasm/web` (browser).
 *
 * @example
 * import { createAssetLoad } from '@kerebron/wasm/web';
 * configureRichTextField({ assetLoad: createAssetLoad('/kerebron-wasm') });
 */
export function configureRichTextField(options: { assetLoad: AssetLoad }) {
  setAssetLoad(options.assetLoad);
}

// Register field type metadata (label, category, etc.)
registerFieldType('richtext', {
  label: 'Rich Text Editor',
  category: 'rich',
  answerType: 'text',
  hasOptions: false,
  hasMatrix: false,
  defaultProps: {},
  placeholder: { question: 'Enter your question...' },
});

export { RichTextEditorField } from './RichTextEditorField.js';
export type { RichTextFieldDefinition } from './RichTextEditorField.js';
export {
  answersToFrontmatterMeta,
  buildRichTextAnswer,
  getRichTextBody,
  isRichTextAnswer,
  rewriteEsheetMarkdownRefs,
  rewriteRichTextAnswerRefs,
  stripFrontmatter,
  toMetaEntry,
} from './richtext-mdy.js';
export type { RichTextFrontmatterEntry } from './richtext-mdy.js';
