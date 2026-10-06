import {
  createCatalogHandler,
  type CatalogRequest,
  type CatalogReply,
} from './runtime/catalog-worker.js';

// Only this executable entry installs a worker message handler. The runtime
// export remains safe to import on the main thread and during SSR.
interface CatalogWorkerScope {
  onmessage: ((event: MessageEvent<CatalogRequest>) => void) | null;
  postMessage(message: CatalogReply): void;
}

const scope = globalThis as unknown as CatalogWorkerScope;
const handle = createCatalogHandler((reply) => scope.postMessage(reply));
scope.onmessage = (event) => handle(event.data);
