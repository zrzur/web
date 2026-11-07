// Build-time release information: version, git commit and tag of this build.
// Used by the Vite configs (as the `__ZRZUR_BUILD__` constant) so every
// "source code" link points at the exact source of the running build
// (AGPL section 13 / L-01). Plain Node, no dependencies.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ORG = "https://github.com/zrzur";

function git(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function clean(value) {
  const v = (value ?? "").trim();
  // Docker builds pass a placeholder through when nothing was provided
  return v && !v.startsWith("__") ? v : "";
}

/**
 * @param {{ dir: string, env?: Record<string,string|undefined>, releaseFile?: string }} opts
 *   dir: the repository root (where RELEASE.json lives)
 * @returns {{ version: string, commit: string, tag: string }}
 *   commit / tag are "" when unknown (for example a build from a tarball)
 */
export function readReleaseInfo({ dir, env = process.env, releaseFile }) {
  let version = "0.0.0-unknown";
  const file = releaseFile ?? join(dir, "RELEASE.json");
  if (existsSync(file)) {
    try {
      version = JSON.parse(readFileSync(file, "utf8")).version || version;
    } catch {
      /* keep the fallback */
    }
  }
  const commit =
    clean(env.ZRZUR_GIT_COMMIT) ||
    clean(env.GITHUB_SHA) ||
    git(dir, ["rev-parse", "HEAD"]);
  const tag =
    clean(env.ZRZUR_GIT_TAG) ||
    (env.GITHUB_REF_TYPE === "tag" ? clean(env.GITHUB_REF_NAME) : "") ||
    git(dir, ["describe", "--tags", "--exact-match", "--match", "v[0-9]*", "HEAD"]);
  return { version, commit: commit.toLowerCase(), tag };
}

/** The GitHub URL of the source of this build; the repo root if unknown */
export function sourceUrl(info, repo) {
  const base = `${ORG}/${repo}`;
  const ref = info?.tag || info?.commit;
  return ref ? `${base}/tree/${encodeURIComponent(ref)}` : base;
}

/** The JSON exposed to the app as the `__ZRZUR_BUILD__` constant */
export function buildDefine(info, repo) {
  return JSON.stringify({ ...info, repo, sourceUrl: sourceUrl(info, repo) });
}
