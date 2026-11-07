/** Minimal instance surface needed to build absolute invite URLs. */
export type InviteLinkHost = {
  href: (path: string) => string;
};

/**
 * Absolute invite URL.
 * Prefer short invite origin (VITE_INVITE_ORIGIN, e.g. https://zrzur.cc/{code}).
 * Never use upstream stt.gg / rvlt.gg shortlinks.
 */
export function getInviteLink(
  id: string,
  inst: InviteLinkHost,
  inviteOrigin: string | undefined = import.meta.env.VITE_INVITE_ORIGIN as
    | string
    | undefined,
): string {
  const raw = inviteOrigin?.trim();
  if (raw) {
    try {
      const base = new URL(raw.endsWith("/") ? raw : `${raw}/`);
      if (base.protocol === "https:" || base.protocol === "http:") {
        // Short form: https://zrzur.cc/{code} (no /invite/ path segment)
        return new URL(id, base).href.replace(/\/$/, "");
      }
    } catch {
      /* fall through to app host */
    }
  }
  return inst.href(`/invite/${id}`);
}

/**
 * Invite codes are short alphanumeric ids; custom links (zrzur.cc/<name>)
 * may also join words with single hyphens.
 */
const RE_CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** Whether `value` is a plain code or id that is safe to put in an API path. */
export function isInviteCode(value: string): boolean {
  return value.length <= 32 && RE_CODE.test(value);
}

/**
 * Read an invite code from a pasted code or link: `zrzur.cc/{code}`,
 * `{inviteOrigin}/{code}` or `…/invite/{code}` on the app host.
 * Returns "" when no valid code is found, so the input never reaches the API path.
 */
export function parseInviteCode(
  raw: string,
  inviteOrigin: string | undefined = import.meta.env.VITE_INVITE_ORIGIN as
    | string
    | undefined,
): string {
  const input = raw.trim();
  if (isInviteCode(input)) return input;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";

  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1) ?? "";
  if (!isInviteCode(last)) return "";

  // short form: {host}/{code} on zrzur.cc or under the configured invite origin;
  // scheme, `www.`, a trailing slash, query and fragment don't matter
  const host = url.host.replace(/^www\./, "");
  const shortBases: { host: string; path: string[] }[] = [
    { host: "zrzur.cc", path: [] },
  ];
  try {
    const base = inviteOrigin?.trim();
    if (base) {
      const origin = new URL(base);
      shortBases.push({
        host: origin.host.replace(/^www\./, ""),
        path: origin.pathname.split("/").filter(Boolean),
      });
    }
  } catch {
    /* ignore a malformed invite origin */
  }
  const isShort = shortBases.some(
    (base) =>
      base.host === host &&
      segments.length === base.path.length + 1 &&
      base.path.every((segment, i) => segments[i] === segment),
  );
  if (isShort) return last;

  // app form: …/invite/{code}
  if (segments.length >= 2 && segments.at(-2) === "invite") return last;
  return "";
}
