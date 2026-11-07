/** Sections a person can order or hide, in their default order */
export const PROFILE_SECTIONS = [
  "about",
  "links",
  "creations",
  "wearing",
  "member_since",
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number];

export const MAX_LINKS = 5;

/** Sections only a creator has: the editor leaves them out for anyone else */
export const CREATOR_SECTIONS: readonly ProfileSectionId[] = [
  "creations",
  "wearing",
];

export type SectionRow = { id: ProfileSectionId; shown: boolean };

const known = (id: string): id is ProfileSectionId =>
  (PROFILE_SECTIONS as readonly string[]).includes(id);

/** The rows of the Sections editor: shown ones in order, hidden ones after */
export function sectionRows(
  shown?: string[],
  hidden: string[] = [],
): SectionRow[] {
  const rows: SectionRow[] = [];
  const add = (id: string, isShown: boolean) => {
    if (known(id) && !rows.some((row) => row.id === id)) {
      rows.push({ id, shown: isShown });
    }
  };
  (shown ?? []).filter(known).forEach((id) => add(id, !hidden.includes(id)));
  PROFILE_SECTIONS.forEach((id) => add(id, !hidden.includes(id)));
  return rows;
}

/**
 * What the API takes from the rows. `hidden` is what the profile has hidden
 * now: an id with no row stays hidden, or saving would show it again.
 */
export function rowsToProfile(rows: SectionRow[], hidden: string[] = []) {
  const kept = hidden.filter((id) => !known(id));
  return {
    sections: rows.filter((row) => row.shown).map((row) => row.id as string),
    hidden_sections: [
      ...rows.filter((row) => !row.shown).map((row) => row.id as string),
      ...kept,
    ],
  };
}

/** Move one row; the list stays the same when it can't move further */
export function moveRow(rows: SectionRow[], index: number, by: number) {
  const target = index + by;
  if (
    index < 0 ||
    index >= rows.length ||
    target < 0 ||
    target >= rows.length
  ) {
    return rows;
  }
  const next = [...rows];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  return next;
}

/** What is wrong with a link, as the server would see it */
export function linkProblem(link: string): "https" | "address" | undefined {
  const value = link.trim();
  if (!value) return undefined;
  if (!value.toLowerCase().startsWith("https://")) return "https";
  try {
    const { hostname } = new URL(value);
    const named = hostname.includes(".") && !/^[\d.]+$/.test(hostname);
    return named && !/\s/.test(value) ? undefined : "address";
  } catch {
    return "address";
  }
}

/** The sections to draw for a profile, in the owner's order */
export function visibleSections(sections?: string[]): ProfileSectionId[] {
  return sections ? sections.filter(known) : [...PROFILE_SECTIONS];
}

/**
 * A saved link as a URL, or nothing if it isn't a plain https address. The
 * server refuses anything else on saving; this also covers old values, so a
 * bad one is skipped instead of throwing in the card.
 */
export function profileLinkUrl(link: unknown): URL | undefined {
  if (typeof link !== "string") return undefined;
  try {
    const url = new URL(link);
    return url.protocol === "https:" && !url.username && !url.password
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

/** The links of a profile that may be shown */
export function safeProfileLinks(links?: unknown[]): URL[] {
  return (links ?? []).flatMap((link) => profileLinkUrl(link) ?? []);
}

/** Sites people link most, by their real address. Nothing else is trusted. */
const KNOWN_SITES: Record<string, string> = {
  "bsky.app": "Bluesky",
  "facebook.com": "Facebook",
  "github.com": "GitHub",
  "instagram.com": "Instagram",
  "kick.com": "Kick",
  "linkedin.com": "LinkedIn",
  "reddit.com": "Reddit",
  "soundcloud.com": "SoundCloud",
  "spotify.com": "Spotify",
  "steamcommunity.com": "Steam",
  "steampowered.com": "Steam",
  "threads.net": "Threads",
  "tiktok.com": "TikTok",
  "twitch.tv": "Twitch",
  "twitter.com": "X",
  "x.com": "X",
  "youtu.be": "YouTube",
  "youtube.com": "YouTube",
};

/** Endings under which every name is its own site, such as `example.co.uk` */
const SHARED_ENDINGS = /\.(co|com|org|net|ac|gov|edu)\.[a-z]{2}$/;

/** What a known site could be mistaken by: its name, or its domain's first part */
const LOOKALIKES = new Set(
  Object.entries(KNOWN_SITES).flatMap(([site, name]) => [
    name.toLowerCase(),
    site.split(".")[0],
  ]),
);

/** The site a link belongs to, without subdomains: `mail.google.com` is `google.com` */
export function linkDomain(url: URL) {
  const parts = url.hostname.split(".");
  return parts.slice(SHARED_ENDINGS.test(url.hostname) ? -3 : -2).join(".");
}

/**
 * The name on a link chip. Only a site in `KNOWN_SITES` gets its known name.
 * Any other site shows its name without the ending, except one that reads
 * like a known site on another domain: `instagram.xyz` shows in full, so it
 * can never pass as Instagram.
 */
export function linkName(url: URL) {
  const domain = linkDomain(url);
  const known = KNOWN_SITES[domain];
  if (known) return known;
  const name = domain.split(".")[0];
  return LOOKALIKES.has(name.toLowerCase())
    ? domain
    : name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The site name of a link. This is all that is shown, so a link can never
 * read as something it is not, and nothing is loaded from the site.
 */
export function siteAddress(link: string) {
  try {
    return new URL(link).hostname;
  } catch {
    return link;
  }
}
