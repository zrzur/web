/**
 * Version, commit and tag of the running build, injected by Vite
 * (`define` in vite.config.ts, from scripts/release-info.mjs).
 * Every "source code" link uses `sourceCodeUrl` so it points at the exact
 * source of this build (AGPL section 13).
 */
export interface BuildInfo {
  version: string;
  commit: string;
  tag: string;
  repo: string;
  sourceUrl: string;
}

declare const __ZRZUR_BUILD__: BuildInfo | undefined;

const FALLBACK: BuildInfo = {
  version: "dev",
  commit: "",
  tag: "",
  repo: "web",
  sourceUrl: "https://github.com/zrzur/web",
};

export const buildInfo: BuildInfo =
  typeof __ZRZUR_BUILD__ !== "undefined" && __ZRZUR_BUILD__
    ? __ZRZUR_BUILD__
    : FALLBACK;

/** Source of this build: tag or commit tree, else the repository root */
export const SOURCE_CODE_URL = buildInfo.sourceUrl;

/** What the API root reports about the running server (commit is optional) */
export function serverBuildOf(
  // the API root; typed loosely because the SDK types lag the server
  raw: unknown,
): { version: string; commit: string; sourceUrl: string } | null {
  const config = raw as { zrzur?: string; commit?: string } | null | undefined;
  if (!config?.zrzur) return null;
  const commit = /^[0-9a-f]{7,64}$/i.test(config.commit ?? "")
    ? (config.commit as string)
    : "";
  return {
    version: config.zrzur,
    commit,
    sourceUrl: commit
      ? `https://github.com/zrzur/backend/tree/${commit}`
      : "https://github.com/zrzur/backend",
  };
}

/** Short commit for display, empty when unknown */
export function shortCommit(info: Pick<BuildInfo, "commit"> = buildInfo) {
  return info.commit ? info.commit.slice(0, 7) : "";
}

/** The notices file written next to the app by every build (L-08) */
export const THIRD_PARTY_NOTICES_URL = `${import.meta.env?.BASE_URL ?? "/"}THIRD-PARTY-NOTICES.txt`;
