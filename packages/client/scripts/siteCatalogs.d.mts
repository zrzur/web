import type { Plugin } from "vite";

export const VIRTUAL_ID: string;
export function messageKeysIn(code: string, keys: Set<string>): Set<string>;
export function siteModules(
  roots: string[],
  getInfo: (id: string) =>
    | {
        importedIds: readonly string[];
        dynamicallyImportedIds: readonly string[];
      }
    | null
    | undefined,
): Set<string>;
export function subsetCatalog<T>(
  messages: Record<string, T>,
  used: Set<string>,
): Record<string, T>;
export function readCatalog(ts: string): Record<string, unknown>;
export function checkSiteCatalog(roots: string[], usedCount: number): void;
export function siteCatalogs(options: { catalogDir: string }): Plugin;
