/// <reference types="vite/client" />

declare module 'datavis-ace' {
  export class Source {
    constructor(
      spec: Record<string, unknown>,
      params?: unknown,
      userTypeInfo?: unknown,
      opts?: unknown
    );
    source?: unknown;
    [key: string]: unknown;
  }

  export class ComputedView {
    constructor(source: Source);
    clearCache(): void;
    getData(
      callback?: (ok: boolean, data: unknown) => void,
      reason?: string
    ): void;
    source: Source;
    [key: string]: unknown;
  }
}
