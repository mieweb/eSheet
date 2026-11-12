/** Browser/main-thread safe: importing this module never installs a worker. */
export {
  parseShard,
  searchShards,
  searchCatalog,
  findByCodes,
  normalize,
  familyKey,
  familyTerm,
  billableMask,
} from './engine.js';
export type { CodifyShard, CodifyResult, SearchOptions } from './engine.js';
export { createCatalogHandler, maybeGunzip } from './catalog-worker.js';
export type {
  CatalogLoadRequest,
  CatalogRequest,
  CatalogReply,
  CatalogLimits,
} from './catalog-worker.js';
export type { CatalogOption } from '../index.js';
