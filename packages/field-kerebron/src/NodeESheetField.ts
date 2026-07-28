import { Node as PmNode, NodeSpec, NodeType, Schema } from '@kerebron/pm/model';
import { EditorState, Transaction } from '@kerebron/pm/state';

import {
  CommandFactories,
  CoreEditor,
  NESTING_SELF_CLOSING,
  Node,
} from '@kerebron/editor';
import { Command } from '@kerebron/editor/commands';
import {
  type InputRule,
  replaceInlineNode,
} from '@kerebron/editor/plugins/input-rules';

export function fixCharacters(text: string) {
  return text
    .replace(/’/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    // deno-lint-ignore no-control-regex
    .replace(/\x0b/g, ' ')
    .replace(/\u201d/g, '"')
    .replace(/\u201c/g, '"');
}

type Factory = (oldNode: PmNode, schema: Schema) => PmNode;

function replaceAllNodesOfType(
  tr: Transaction,
  doc: PmNode,
  oldType: NodeType,
  factory: Factory,
) {
  const replacements: Array<{ node: PmNode; pos: number }> = [];

  doc.descendants((node, pos) => {
    if (node.type === oldType) {
      replacements.push({ node, pos });
    }
  });

  for (let i = replacements.length - 1; i >= 0; i--) {
    const { node, pos } = replacements[i];
    const newNode = factory(node, tr.doc.type.schema);
    tr = tr.replaceWith(pos, pos + node.nodeSize, newNode);
  }

  return tr;
}

function metaGet(obj: unknown, key: string): unknown {
  if (obj == null) return undefined;
  if (obj instanceof Map) return obj.get(key);
  if (typeof obj === 'object') return (obj as Record<string, unknown>)[key];
  return undefined;
}

export function resolveMetaLabel(meta: unknown, id: string): string {
  if (!id || meta == null) return '';
  const entry = metaGet(meta, id);
  if (entry == null) return '';

  const fromEntry = (raw: unknown): string => {
    if (raw == null) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw);
    }
    if (typeof raw === 'object' && raw !== null && 'value' in raw && !('display' in raw)) {
      const v = (raw as { value: unknown }).value;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        return String(v);
      }
    }
    return '';
  };

  if (typeof entry === 'object' && entry !== null) {
    const display = metaGet(entry, 'display');
    if (display != null && display !== '') return String(display);
    const value = metaGet(entry, 'value');
    if (value !== undefined) {
      const label = fromEntry(value);
      if (label) return label;
    }
  }
  return fromEntry(entry);
}

export class NodeESheetField extends Node {
  override name = 'esheet_field';

  override getNodeSpec(): NodeSpec {
    return {
      inline: true,
      group: 'inline',
      selectable: true,
      atom: true,
      attrs: {
        id: {
          default: undefined,
        },
        content: {
          default: '',
        },
        nesting: {
          default: NESTING_SELF_CLOSING,
        },
        error: {
          default: '',
        },
      },
      parseDOM: [
        {
          tag: 'span.esheet',
          getAttrs: (dom: HTMLElement | string) => {
            if (typeof dom === 'string') return false;
            const meta = this.editor.state.doc.attrs.meta;
            const id = dom.getAttribute('data-id') || undefined;
            return {
              id: id,
              content: meta?.get(id)?.get('value') || dom.textContent || '',
              error: dom.getAttribute('data-error') || '',
            };
          },
        },
      ],
      toDOM(node) {
        let title = String(node.attrs.id || '');
        if (node.attrs.error) title = String(node.attrs.error);

        const attrs: Record<string, string> = {
          class: 'esheet',
          title: title,
          'data-id': String(node.attrs.id || ''),
        };
        if (node.attrs.error) attrs['data-error'] = String(node.attrs.error);
        return ['span', attrs, String(node.attrs.content || '')];
      },
    };
  }

  override getInputRules(type: NodeType): InputRule[] {
    return [
      replaceInlineNode(
        /(?:\[([^\]]+)\])?\(#([a-zA-Z_-][a-zA-Z0-9_-]*(?:\.[a-zA-Z_-][a-zA-Z0-9_-]*)*)\)/,
        type,
        (match: RegExpMatchArray) => {
          const id = match[2];
          const label = match[1] != null ? fixCharacters(match[1]) : '';
          const fromMeta = resolveMetaLabel(
            this.editor?.state?.doc?.attrs?.meta,
            id,
          );
          return {
            id,
            content: fromMeta || label || id,
            error: fromMeta ? '' : 'missing',
          };
        },
      ),
    ];
  }

  override getCommandFactories(
    _editor: CoreEditor,
    type: NodeType,
  ): Partial<CommandFactories> {
    return {
      /**
       * Rebuild every esheet_field content from doc.attrs.meta.
       * editor.run.refreshEsheetFieldsFromMeta()
       */
      refreshEsheetFieldsFromMeta: (): Command => {
        return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
          const meta = state.doc.attrs.meta;
          let tr = state.tr;

          tr = replaceAllNodesOfType(tr, state.doc, type, (oldNode, schema) => {
            const id = String(oldNode.attrs.id || '');
            const fromMeta = resolveMetaLabel(meta, id);
            const content =
              fromMeta || String(oldNode.attrs.content || id || '');
            const hasEntry = id ? metaGet(meta, id) != null : false;
            return schema.nodes[type.name].create({
              id: oldNode.attrs.id,
              content,
              nesting: oldNode.attrs.nesting ?? NESTING_SELF_CLOSING,
              error: hasEntry || fromMeta ? '' : id ? 'missing' : '',
            });
          });

          if (tr.docChanged && dispatch) {
            dispatch(tr);
          }

          return tr.docChanged;
        };
      },
    };
  }

  override created() {
    const fieldName = this.name;
    const editor = this.editor;

    const pm2md = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
      const fieldType = state.schema.nodes[fieldName];
      const linkType = state.schema.marks.link;
      if (!fieldType || !linkType) return false;

      const hits: { pos: number; node: PmNode }[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type === fieldType) hits.push({ pos, node });
      });
      if (!hits.length) return false;

      const tr = state.tr;
      for (let i = hits.length - 1; i >= 0; i--) {
        const { pos, node } = hits[i];
        const id = String(node.attrs.id || '');
        const label = String(node.attrs.content || id);
        const text = state.schema.text(label, [
          linkType.create({ href: `#${id}` }),
        ]);
        tr.replaceWith(
          tr.mapping.map(pos),
          tr.mapping.map(pos + node.nodeSize),
          text,
        );
      }
      if (dispatch) dispatch(tr);
      return tr.docChanged;
    };

    const md2pm = (state: EditorState, dispatch?: (tr: Transaction) => void) => {
      const fieldType = state.schema.nodes[fieldName];
      const linkType = state.schema.marks.link;
      if (!fieldType || !linkType) return false;

      const hits: { pos: number; size: number; id: string; text: string }[] = [];
      state.doc.descendants((node, pos) => {
        if (!node.isText) return;
        const mark = linkType.isInSet(node.marks);
        if (!mark) return;
        const href = String(mark.attrs.href || '');
        if (!href.startsWith('#')) return;
        const id = href.slice(1);
        if (!/^[a-zA-Z_][\w.]*$/.test(id)) return;
        hits.push({ pos, size: node.nodeSize, id, text: node.text || '' });
      });
      if (!hits.length) return false;

      const tr = state.tr;
      const meta = state.doc.attrs.meta;
      for (let i = hits.length - 1; i >= 0; i--) {
        const { pos, size, id, text } = hits[i];
        const fromMeta = resolveMetaLabel(meta, id);
        const node = fieldType.create({
          id,
          content: fromMeta || text || id,
          nesting: NESTING_SELF_CLOSING,
          error: fromMeta ? '' : 'missing',
        });
        tr.replaceWith(tr.mapping.map(pos), tr.mapping.map(pos + size), node);
      }
      if (dispatch) dispatch(tr);
      return tr.docChanged;
    };

    const append = async (
      hookType: 'pm2md.pre' | 'md2pm.post',
      hook: typeof pm2md
    ) => {
      const list: unknown[] = await new Promise(resolve => editor.run.getMarkdownHooks(hookType, resolve));
      if (list.includes(hook)) return;
      list.push(hook);
      editor.run.setMarkdownHooks(hookType, list);
      return;
    };

    const register = async () => {
      await append('pm2md.pre', pm2md);
      await append('md2pm.post', md2pm);
    };

    editor.addEventListener('ready', register as EventListener);
  }
}
