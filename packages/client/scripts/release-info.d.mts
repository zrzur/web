export interface ReleaseInfo {
  version: string;
  commit: string;
  tag: string;
}
export function readReleaseInfo(opts: {
  dir: string;
  env?: Record<string, string | undefined>;
  releaseFile?: string;
}): ReleaseInfo;
export function sourceUrl(info: Partial<ReleaseInfo>, repo: string): string;
export function buildDefine(info: ReleaseInfo, repo: string): string;
