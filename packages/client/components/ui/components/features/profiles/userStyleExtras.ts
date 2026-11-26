/**
 * Parts of the user style that only the editors, Designs and the galleries
 * use. Kept out of `userStyle.ts`, which every name and avatar in the app
 * needs on the first load.
 */
import {
  type UserStyle,
  communityFileUrl,
  communityStillUrl,
  localDesignUrl,
} from "./userStyle";

/**
 * The style as it is sent to save it: the server replaces the whole style,
 * so every piece that is on goes in, and only those. Image ids of community
 * designs are filled in by the server (a creator's effect keeps its file so
 * it plays at once).
 */
export function sendableStyle(style: UserStyle): UserStyle {
  const sent: Record<string, unknown> = {};
  for (const key of Object.keys(STYLE_FIELDS) as (keyof UserStyle)[]) {
    const value = style[key];
    if (Array.isArray(value) ? !value.length : !value) continue;
    // a design is a creator's (`c:<id>`); the server refuses anything else,
    // such as a built-in design Zrzur no longer ships
    if (DESIGN_FIELDS.includes(key) && !String(value).startsWith("c:"))
      continue;
    const kind = STYLE_FIELDS[key];
    // a creator's effect keeps its file so it plays at once
    if (
      kind === "server" &&
      !(key === "effect_file" && style.effect?.startsWith("c:"))
    )
      continue;
    sent[key] = value;
  }
  return sent as UserStyle;
}

/** The fields that name a design: each holds `c:<id>` of a creator's design */
const DESIGN_FIELDS: readonly (keyof UserStyle)[] = [
  "decoration",
  "nameplate",
  "effect",
  "profile_frame",
];

/**
 * Every field of `UserStyle`: a choice the person makes (always sent), or a
 * file the server fills in. Typed as a full record, so a new field cannot be
 * added to the style without saying which it is.
 */
export const STYLE_FIELDS: Record<keyof UserStyle, "choice" | "server"> = {
  theme: "choice",
  name_font: "choice",
  name_colour: "choice",
  name_effect: "choice",
  decoration: "choice",
  decoration_file: "server",
  nameplate: "choice",
  nameplate_file: "server",
  effect: "choice",
  effect_file: "server",
  profile_frame: "choice",
  profile_frame_file: "server",
};

/** Ready-made two-colour profile themes */
export const THEME_PRESETS: { id: string; colours: [string, string] }[] = [
  { id: "Sunset", colours: ["#ff6b4a", "#ffb347"] },
  { id: "Ocean", colours: ["#1e9bb8", "#6fd3e8"] },
  { id: "Grape", colours: ["#8b2be2", "#e0218a"] },
  { id: "Mint", colours: ["#11998e", "#38ef7d"] },
  { id: "Midnight", colours: ["#0f2027", "#2c5364"] },
  { id: "Cherry", colours: ["#eb3349", "#f45c43"] },
  { id: "Gold", colours: ["#f7971e", "#ffd200"] },
  { id: "Aurora", colours: ["#00c6ff", "#0072ff"] },
  { id: "Rose", colours: ["#ff9a9e", "#fecfef"] },
  { id: "Forest", colours: ["#134e5e", "#71b280"] },
  { id: "Neon", colours: ["#00f260", "#0575e6"] },
  { id: "Candy", colours: ["#ff758c", "#ff7eb3"] },
];

/** URL of an effect's file: what plays */
export function effectFileUrl(mediaUrl: string, fileId: string | undefined) {
  const local = localDesignUrl(fileId);
  if (local) return local;
  return fileId && /^[\w-]+$/.test(fileId)
    ? `${mediaUrl}/effects/${fileId}/original`
    : undefined;
}

/** URL of one still frame of an effect, drawn by the media server for tiles */
export function effectStillUrl(mediaUrl: string, fileId: string | undefined) {
  const local = localDesignUrl(fileId);
  if (local) return local;
  return fileId && /^[\w-]+$/.test(fileId)
    ? `${mediaUrl}/effects/${fileId}`
    : undefined;
}

/**
 * The address a community design is shown from in a gallery or a card: its
 * file as uploaded (it may move), or, for a viewer who is saving data, the
 * one still frame the media server draws (some twenty kilobytes instead of
 * up to a megabyte).
 */
export function communityShownUrl(
  mediaUrl: string,
  kind: string,
  fileId: string | undefined,
  saving: boolean,
) {
  if (kind === "Effect")
    return saving
      ? effectStillUrl(mediaUrl, fileId)
      : effectFileUrl(mediaUrl, fileId);
  return saving
    ? communityStillUrl(mediaUrl, fileId)
    : communityFileUrl(mediaUrl, fileId);
}
