import { createSignal } from "solid-js";

/**
 * "Always load media players from other sites". Off by default: a player
 * from YouTube, Twitch and the like contacts that company from the reader's
 * browser, so each site waits for one click unless the person opts in here.
 * Kept on this device only.
 */
const KEY = "zrzur:always-load-media-players";
const ALLOWED_KEY = "zrzur:allowed-media-players";

function read() {
  try {
    return globalThis.localStorage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const [always, setAlways] = createSignal(read());

function readAllowed(): string[] {
  try {
    const saved = JSON.parse(
      globalThis.localStorage?.getItem(ALLOWED_KEY) ?? "[]",
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const [allowed, setAllowed] = createSignal(readAllowed());

function saveAllowed(value: string[]) {
  setAllowed(value);
  try {
    globalThis.localStorage?.setItem(ALLOWED_KEY, JSON.stringify(value));
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
}

export const alwaysLoadMediaPlayers = always;

/** Provider types the reader has loaded once; the warning names each company, so each asks once */
export const allowedMediaPlayers = allowed;

export const isMediaPlayerAllowed = (type?: string) =>
  !!type && allowed().includes(type);

export function allowMediaPlayer(type?: string) {
  if (type && !allowed().includes(type)) saveAllowed([...allowed(), type]);
}

export function forgetMediaPlayers() {
  saveAllowed([]);
}

export function setAlwaysLoadMediaPlayers(value: boolean) {
  setAlways(value);
  try {
    globalThis.localStorage?.setItem(KEY, value ? "1" : "0");
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
}

/** Whether an embed is one of the click-to-load players (Lightspeed is a normal link) */
export const isPlayerEmbed = (type?: string) =>
  !!type && PLAYER_PROVIDERS[type] !== undefined;

/**
 * The consent key of an embed's player: its type, or for the sites of the
 * "Player" kind, "Player:<site>" (yes to Vimeo is not yes to TikTok)
 */
export function playerKey(special?: { type: string; provider?: string }) {
  if (!special) return undefined;
  return special.type === "Player" ? `Player:${special.provider}` : special.type;
}

/** Who runs a "Player" site, for the line under the placeholder */
const PLAYER_SITE_COMPANIES: Record<string, string> = {
  Vimeo: "Vimeo",
  Dailymotion: "Dailymotion",
  TikTok: "TikTok (ByteDance)",
  Instagram: "Instagram (Meta)",
  Deezer: "Deezer",
  "Apple Podcasts": "Apple",
  Kick: "Kick",
  Mixcloud: "Mixcloud",
  Tidal: "Tidal",
  Loom: "Loom (Atlassian)",
  Bilibili: "Bilibili",
  TED: "TED",
  Coub: "Coub",
  Steam: "Steam (Valve)",
  Facebook: "Facebook (Meta)",
};

/** Name and company of the player behind a consent key */
export function playerProvider(key: string) {
  if (key.startsWith("Player:")) {
    const name = key.slice("Player:".length);
    return { name, company: PLAYER_SITE_COMPANIES[name] ?? name };
  }
  return PLAYER_PROVIDERS[key];
}

/** Who a player talks to, for the line under the placeholder */
export const PLAYER_PROVIDERS: Record<
  string,
  { name: string; company: string } | undefined
> = {
  YouTube: { name: "YouTube", company: "Google" },
  Twitch: { name: "Twitch", company: "Twitch (Amazon)" },
  Spotify: { name: "Spotify", company: "Spotify" },
  Soundcloud: { name: "SoundCloud", company: "SoundCloud" },
  Bandcamp: { name: "Bandcamp", company: "Bandcamp" },
  AppleMusic: { name: "Apple Music", company: "Apple" },
  Streamable: { name: "Streamable", company: "Streamable" },
  // the sites of the "Player" kind: see playerProvider for their names
  Player: { name: "", company: "" },
};

/** Where the players section of the privacy policy lives when the server names no page */
export const FALLBACK_POLICY = "https://zrzur.com/legal/privacy#players";

/** The server's privacy page, pointing at the players section unless it already names a section */
export function playersPolicyUrl(serverUrl?: string) {
  if (!serverUrl) return FALLBACK_POLICY;
  return serverUrl.includes("#") ? serverUrl : `${serverUrl}#players`;
}
