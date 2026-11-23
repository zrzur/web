import type { HtmlTagDescriptor } from "vite";

export function preconnectOrigin(
  apiUrl: string | undefined,
  host: string | undefined,
): string | undefined;
export function preconnectApi(options?: { apiUrl?: string; host?: string }): {
  name: string;
  transformIndexHtml(): HtmlTagDescriptor[];
};
