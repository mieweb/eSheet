import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { CatalogMapping, CompiledCatalog } from './index.js';
import { buildMcdxShard } from './writer.js';
import type { McdxDocument } from './writer.js';

export { buildMcdxShard, normalize } from './writer.js';
export type { McdxDocument, McdxWriterOptions } from './writer.js';
export type {
  CatalogMapping,
  CatalogsConfig,
  CompiledCatalog,
} from './index.js';

/**
 * Compile one configuration set's flat <configRoot>/autocomplete directory.
 * Missing directory means no catalogs. Does not write files or modify sources;
 * callers must publish results only after this promise resolves successfully.
 * IDs hash sorted [header, NFC-trimmed cell] tuples (NOT search normalization).
 * Changing selected identity headers/values changes IDs; row order and captured
 * non-identity values do not. Add an idColumn for durable externally owned IDs.
 */
export async function compileCatalogs({
  configRoot,
}: {
  configRoot: string;
}): Promise<CompiledCatalog[]> {
  const root = await realpath(configRoot);
  const folder = path.join(root, 'autocomplete');
  try {
    await lstat(folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const directory = await confined(root, folder, true);
  const names = (await readdir(directory)).sort();
  const sources = new Map<string, string>();
  for (const name of names) {
    if (name.startsWith('.') || /^README.*\.md$/i.test(name)) continue;
    if (name === 'catalogs.json') continue;
    if (!/\.(csv|tsv)$/i.test(name)) {
      fail(name, 'unsupported source; use a flat .csv or .tsv file');
    }
    const dataset = name.slice(0, -4);
    segment(dataset, `${name}: dataset`);
    if (sources.has(dataset)) fail(name, `duplicate dataset stem ${dataset}`);
    sources.set(dataset, name);
  }
  let mappings: Record<string, CatalogMapping> = {};
  if (names.includes('catalogs.json')) {
    const mappingFile = await confined(
      root,
      path.join(directory, 'catalogs.json')
    );
    mappings = parseMappings(await readFile(mappingFile, 'utf8'));
  }
  for (const target of Object.keys(mappings)) {
    segment(target, 'catalogs.json: dataset');
    if (!sources.has(target)) {
      fail('catalogs.json', `unknown mapping target ${JSON.stringify(target)}`);
    }
  }
  const compiled: CompiledCatalog[] = [];
  for (const [dataset, name] of sources) {
    const source = await confined(root, path.join(directory, name));
    const mapping = Object.hasOwn(mappings, dataset) ? mappings[dataset] : {};
    const locale = mapping.locale ?? 'en';
    segment(locale, `${name}: locale`);
    const docs = compileRows(await readFile(source, 'utf8'), name, mapping);
    const payload = buildMcdxShard({
      domain: dataset,
      locale,
      docs,
      catalog: true,
    });
    const sha256 = hash(payload);
    compiled.push({
      dataset,
      locale,
      file: `${dataset}.${sha256}.mcdx`,
      sha256,
      bytes: payload.byteLength,
      rowCount: docs.length,
      payload,
    });
  }
  return compiled;
}

async function confined(root: string, file: string, directory = false) {
  const resolved = await realpath(file);
  const relative = path.relative(root, resolved);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail(file, 'symlink escapes configRoot');
  }
  const info = await stat(resolved);
  if (directory ? !info.isDirectory() : !info.isFile()) {
    fail(file, directory ? 'expected a directory' : 'expected a regular file');
  }
  return resolved;
}

function compileRows(
  text: string,
  file: string,
  mapping: CatalogMapping
): McdxDocument[] {
  let records: { record: string[]; info: { lines: number } }[];
  try {
    const parsed: unknown = parse(text, {
      bom: true,
      delimiter: /\.tsv$/i.test(file) ? '\t' : ',',
      skip_empty_lines: true,
      // Check width ourselves, after ignoring wholly blank records.
      relax_column_count: true,
      info: true,
    });
    if (!Array.isArray(parsed)) throw new Error('expected CSV records');
    records = parsed.map((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !('record' in entry) ||
        !Array.isArray(entry.record) ||
        !entry.record.every((cell: unknown) => typeof cell === 'string') ||
        !('info' in entry) ||
        !entry.info ||
        typeof entry.info !== 'object' ||
        !('lines' in entry.info) ||
        typeof entry.info.lines !== 'number'
      )
        throw new Error('invalid CSV info record');
      return {
        record: entry.record as string[],
        info: { lines: entry.info.lines },
      };
    });
  } catch (error) {
    fail(file, `malformed CSV/TSV: ${(error as Error).message}`);
  }
  records = records.filter(({ record }) => record.some((cell) => cell.trim()));
  const columns = mapping.columns ?? records.shift()?.record;
  if (!columns?.length) fail(file, 'missing header/columns');
  stringList(columns, `${file}: columns`);
  const labelColumn =
    mapping.labelColumn ?? (columns.length === 1 ? columns[0] : undefined);
  if (!labelColumn) {
    fail(
      file,
      'multi-column source requires catalogs.json labelColumn (and identityColumns or idColumn when labels are not unique)'
    );
  }
  const identityColumns = mapping.identityColumns ?? [labelColumn];
  const searchColumns = mapping.searchColumns ?? [labelColumn];
  const captures = Object.entries(mapping.captureColumns ?? {});
  const used = new Set([
    labelColumn,
    ...(mapping.idColumn ? [mapping.idColumn] : identityColumns),
    ...searchColumns,
    ...captures.map(([, column]) => column),
  ]);
  for (const column of used) {
    if (!columns.includes(column))
      fail(file, `missing column ${JSON.stringify(column)}`);
  }
  const indexes = new Map(columns.map((column, index) => [column, index]));
  const ids = new Map<string, string>();
  const add = (doc: McdxDocument, location: string) => {
    const previous = ids.get(doc.fullid);
    if (previous)
      fail(
        location,
        `duplicate ID/identity ${JSON.stringify(
          doc.fullid
        )}; first at ${previous}; supply distinct idColumn values`
      );
    ids.set(doc.fullid, location);
    return doc;
  };
  const docs = records.map(({ record, info }) => {
    const location = `${file}: row ending at line ${info.lines}`;
    if (record.length !== columns.length) {
      fail(
        location,
        `expected ${columns.length} columns, received ${record.length}`
      );
    }
    const cell = (column: string) => {
      const value = record[indexes.get(column)!];
      nonempty(value, `${location}: column ${JSON.stringify(column)}`);
      return value;
    };
    const fullid = mapping.idColumn
      ? cell(mapping.idColumn)
      : hash(
          JSON.stringify(
            [...identityColumns]
              .sort()
              .map((column) => [column, cell(column).normalize('NFC').trim()])
          )
        );
    const attributes = Object.fromEntries(
      captures.map(([attribute, column]) => {
        const value = cell(column);
        const values =
          mapping.attributeValues &&
          Object.hasOwn(mapping.attributeValues, attribute)
            ? mapping.attributeValues[attribute]
            : undefined;
        if (values && !Object.hasOwn(values, value)) {
          fail(
            location,
            `column ${JSON.stringify(
              column
            )}: unknown ${attribute} mapping value ${JSON.stringify(value)}`
          );
        }
        return [attribute, values ? values[value] : value];
      })
    );
    return add(
      {
        fullid,
        fullcode: '',
        codetype: 'catalog',
        label: cell(labelColumn),
        searchText: searchColumns.map(cell).join(' '),
        ...(captures.length ? { attributes } : {}),
      },
      location
    );
  });
  for (const [index, option] of (mapping.additionalOptions ?? []).entries()) {
    docs.push(
      add(
        {
          fullid: option.id,
          label: option.value,
          fullcode: '',
          codetype: 'catalog',
          ...(option.attributes ? { attributes: option.attributes } : {}),
        },
        `${file}: additionalOptions[${index}]`
      )
    );
  }
  if (!docs.length)
    fail(file, 'catalog contains no data rows or additionalOptions');
  // Stable IDs also make the complete payload independent of source row order.
  return docs.sort((a, b) =>
    a.fullid < b.fullid ? -1 : a.fullid > b.fullid ? 1 : 0
  );
}

function parseMappings(text: string): Record<string, CatalogMapping> {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    fail('catalogs.json', `invalid JSON: ${(error as Error).message}`);
  }
  object(value, 'catalogs.json');
  keys(value, ['schemaVersion', 'catalogs'], 'catalogs.json');
  if (value.schemaVersion !== 1)
    fail('catalogs.json', 'schemaVersion must be 1');
  object(value.catalogs, 'catalogs.json: catalogs');
  for (const [name, mapping] of Object.entries(value.catalogs)) {
    const location = `catalogs.json: ${name}`;
    object(mapping, location);
    keys(
      mapping,
      [
        'labelColumn',
        'idColumn',
        'identityColumns',
        'searchColumns',
        'captureColumns',
        'attributeValues',
        'locale',
        'columns',
        'additionalOptions',
      ],
      location
    );
    for (const key of ['labelColumn', 'idColumn', 'locale']) {
      if (Object.hasOwn(mapping, key))
        nonempty(mapping[key], `${location}: ${key}`);
    }
    for (const key of ['identityColumns', 'searchColumns', 'columns']) {
      if (Object.hasOwn(mapping, key))
        stringList(mapping[key], `${location}: ${key}`);
    }
    if (mapping.idColumn && mapping.identityColumns)
      fail(location, 'choose idColumn OR identityColumns, not both');
    if (Object.hasOwn(mapping, 'captureColumns'))
      stringMap(mapping.captureColumns, `${location}: captureColumns`);
    if (Object.hasOwn(mapping, 'attributeValues')) {
      object(mapping.attributeValues, `${location}: attributeValues`);
      for (const [attribute, values] of Object.entries(
        mapping.attributeValues
      )) {
        if (
          !mapping.captureColumns ||
          !Object.hasOwn(mapping.captureColumns, attribute)
        ) {
          fail(
            location,
            `attributeValues target ${attribute} is not in captureColumns`
          );
        }
        stringMap(values, `${location}: attributeValues.${attribute}`);
      }
    }
    if (Object.hasOwn(mapping, 'additionalOptions')) {
      if (!Array.isArray(mapping.additionalOptions))
        fail(location, 'additionalOptions must be an array');
      for (const [index, option] of mapping.additionalOptions.entries()) {
        const at = `${location}: additionalOptions[${index}]`;
        object(option, at);
        keys(option, ['id', 'value', 'attributes'], at);
        nonempty(option.id, `${at}: id`);
        nonempty(option.value, `${at}: value`);
        if (Object.hasOwn(option, 'attributes'))
          stringMap(option.attributes, `${at}: attributes`);
      }
    }
  }
  return value.catalogs as Record<string, CatalogMapping>;
}

function fail(location: string, message: string): never {
  throw new Error(`${location}: ${message}`);
}

function nonempty(value: unknown, location: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim())
    fail(location, 'expected a nonempty string');
}

function object(
  value: unknown,
  location: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(location, 'expected an object');
}

function stringList(
  value: unknown,
  location: string
): asserts value is string[] {
  if (!Array.isArray(value) || !value.length)
    fail(location, 'expected a nonempty column array');
  for (const item of value) nonempty(item, location);
  if (new Set(value).size !== value.length) fail(location, 'duplicate columns');
}

function stringMap(
  value: unknown,
  location: string
): asserts value is Record<string, string> {
  object(value, location);
  for (const [key, item] of Object.entries(value)) {
    nonempty(key, location);
    nonempty(item, `${location}: ${key}`);
  }
}

function keys(
  value: Record<string, unknown>,
  allowed: string[],
  location: string
) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(location, `unknown property ${key}`);
  }
}

function segment(value: string, location: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)) {
    fail(
      location,
      `invalid literal path segment ${JSON.stringify(
        value
      )}; use letters, digits, underscore or hyphen`
    );
  }
}

function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
