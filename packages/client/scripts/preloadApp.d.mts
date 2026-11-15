import type { Plugin } from "vite";

export function appPreloads(bundle: Record<string, unknown>): string[];
export function addPreloads(
  html: string,
  files: string[],
  base: string,
): string;
export function preloadApp(): Plugin;
export function sitePreloads(
  bundle: Record<string, unknown>,
): Partial<Record<"designs" | "discover" | "docs", string[]>>;
export function afterEntry(html: string, match: RegExpExecArray): number;
