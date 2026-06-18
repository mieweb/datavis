/**
 * Ambient type declarations for the a3t asset loader and the minimongo backend
 * adapter. a3t ships types for its main entry but not for the `/browser` and
 * `/minimongo` subpath exports, so we declare the slices we use here.
 */

declare module 'a3t/browser' {
  export interface A3tContext {
    language?: string;
    workspace?: string;
    system?: string;
    [key: string]: unknown;
  }

  export interface A3tConfig {
    db?: { backend?: unknown };
    fs?: { httpBaseUrl?: string; backend?: unknown };
    context?: A3tContext;
    logging?: { enabled?: boolean };
  }

  interface A3t {
    init(config?: A3tConfig): void;
    get<T = unknown>(key: string, defaultValue?: T, contextOverride?: A3tContext): Promise<T>;
    set(key: string, value: unknown, contextOverride?: A3tContext): Promise<void>;
    remove(key: string, contextOverride?: A3tContext): Promise<void>;
    incrementNonce(): number;
    clearCache(): void;
  }

  const a3t: A3t;
  export default a3t;
}

declare module 'a3t/minimongo' {
  export interface A3tSeedEntry {
    key: string;
    value: unknown;
    workspace?: string;
    language?: string;
    system?: string;
  }

  export interface A3tDbBackend {
    findAsset(query: Record<string, unknown>): Promise<unknown>;
    writeAsset(query: Record<string, unknown>, value: unknown): Promise<void>;
    deleteAsset(query: Record<string, unknown>): Promise<void>;
    seedDefaults(defaults: A3tSeedEntry[]): Promise<void>;
  }

  export function createMinimongoBackend(collection: unknown): A3tDbBackend;
}
