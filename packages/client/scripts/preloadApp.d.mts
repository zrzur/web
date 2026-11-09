import type { Plugin } from "vite";

export function appPreloads(bundle: Record<string, unknown>): string[];
export function addPreloads(
  html: string,
  files: string[],
  base: string,
): string;
export function preloadApp(): Plugin;
