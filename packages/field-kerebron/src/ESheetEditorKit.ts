import { AnyExtensionOrReq, EditorKit } from '@kerebron/editor';
import { NodeESheetField } from './NodeESheetField.ts';

export class ESheetEditorKit implements EditorKit {
  name = 'esheet-kit';

  getExtensions(): AnyExtensionOrReq[] {
    return [
      new NodeESheetField()
    ];
  }
}
