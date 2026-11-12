/** Browser-safe contracts only. Compilation lives in @esheet/catalog/compiler. */
export interface CompiledCatalog {
  dataset: string;
  locale: string;
  /** Basename only: dataset.<sha256 of compressed payload>.mcdx. */
  file: string;
  sha256: string;
  bytes: number;
  rowCount: number;
  payload: Uint8Array;
}

export interface CatalogOption {
  id: string;
  value: string;
  /** Already canonical values; omitted keys allow country-neutral options. */
  attributes?: Record<string, string>;
}

/**
 * Optional autocomplete/catalogs.json entry, keyed by exact filename stem.
 * Without a mapping, only single-column sources are accepted.
 * Multi-column sources require labelColumn; search/identity default to it.
 * Explicit columns declare headerless input, not a subset of source headers.
 */
export interface CatalogMapping {
  labelColumn?: string;
  idColumn?: string;
  /** Mutually exclusive with idColumn. Defaults to the display column. */
  identityColumns?: string[];
  searchColumns?: string[];
  /** Output attribute name -> source header. All cells remain strings. */
  captureColumns?: Record<string, string>;
  /** Output attribute -> exact original cell -> canonical value; exhaustive. */
  attributeValues?: Record<string, Record<string, string>>;
  locale?: string;
  columns?: string[];
  additionalOptions?: CatalogOption[];
}

export interface CatalogsConfig {
  schemaVersion: 1;
  catalogs: Record<string, CatalogMapping>;
}
