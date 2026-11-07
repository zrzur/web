import type { Plugin } from "vite";

export const NOTICES_FILE: string;
export interface NoticeExtra {
  name: string;
  dir: string;
  license: string;
  source?: string;
  files?: string[];
}
export function thirdPartyNotices(options: {
  productName: string;
  extras?: NoticeExtra[];
  /** shipped components that are not in the module graph */
  packages?: { name: string; dir?: string }[];
  root?: string;
}): Plugin;
