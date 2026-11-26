import {
  type CommunityKind,
  type CommunityPermissions,
  artFit,
  checkCommunityFile,
  COMMUNITY_MAX_DIMENSION,
} from "../communityApi";

import type { ZipEntry } from "./zip";

/**
 * Design packs: a ZIP of ready designs, one image per design. A folder
 * named after a type (decorations, nameplates, effects, frames, singular or
 * plural, any case) sets the type of what is in it; everything else gets
 * the type picked for the whole pack. The file name is the design's name.
 */

/** Most designs one pack may hold (pictures are kept small, so a big pack
 * stays light) */
export const PACK_MAX_ITEMS = 1000;

/** Shortest and longest design name the server takes */
export const NAME_MIN = 2;
export const NAME_MAX = 32;

const TYPES: Record<string, string> = {
  png: "image/png",
  apng: "image/apng",
  gif: "image/gif",
  webp: "image/webp",
};

/** Words in a folder name that say the type, checked in this order */
const FOLDER_WORDS: [string, CommunityKind][] = [
  ["nameplate", "nameplates"],
  ["effect", "effects"],
  ["frame", "frames"],
  ["decoration", "decorations"],
];

export type PackProblem =
  | "type"
  | "size"
  | "webm-size"
  | "dimension"
  | "shape"
  | "frame-size"
  | "unreadable"
  | "name";

export type PackItem = {
  /** stable key: the path in the archive */
  id: string;
  entry: ZipEntry;
  type: string;
  name: string;
  /** set by a folder, else undefined (the pack's type applies) */
  folderKind?: CommunityKind;
  /** picked by the creator for this one design */
  kind?: CommunityKind;
  include: boolean;
  width?: number;
  height?: number;
};

/** The image type of a path, by its extension; undefined: not a design */
export function typeOfPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext];
}

/** Junk archivers add: macOS forks, hidden files, thumbnails databases */
export function isJunk(path: string) {
  const parts = path.split("/");
  const file = parts[parts.length - 1];
  return (
    parts.some((part) => part === "__MACOSX" || part.startsWith(".")) ||
    file.toLowerCase() === "thumbs.db" ||
    file.toLowerCase() === "desktop.ini"
  );
}

/** The type a folder on the path names, the deepest one winning */
export function kindOfPath(path: string): CommunityKind | undefined {
  const folders = path.split("/").slice(0, -1).reverse();
  for (const folder of folders) {
    const word = folder.toLowerCase().replace(/[^a-z]/g, "");
    const found = FOLDER_WORDS.find(([part]) => word.includes(part));
    if (found) return found[1];
  }
  return undefined;
}

/**
 * The type an image's shape says, for a pack without type folders: the
 * profile frame size, a tall 9:16 effect, a wide nameplate or a square
 * decoration; undefined when the shape says nothing.
 */
export function kindOfShape(
  width: number | undefined,
  height: number | undefined,
): CommunityKind | undefined {
  if (!width || !height) return undefined;
  if (!artFit("frames", width, height)) return "frames";
  if (!artFit("effects", width, height)) return "effects";
  if (!artFit("decorations", width, height)) return "decorations";
  if (!artFit("nameplates", width, height)) return "nameplates";
  return undefined;
}

/** A readable design name from a file name: "neon_ring-02.png" → "Neon ring 02" */
export function nameOfPath(path: string) {
  const file = path.split("/").pop() ?? path;
  const base = file.replace(/\.[^.]+$/, "");
  const words = base
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const named = words ? words[0].toUpperCase() + words.slice(1) : "";
  return named.slice(0, NAME_MAX).trim();
}

/** The designs in an archive, junk and non-images left out */
export function packItems(entries: ZipEntry[]): PackItem[] {
  return entries
    .filter((entry) => !isJunk(entry.path) && typeOfPath(entry.path))
    .slice(0, PACK_MAX_ITEMS)
    .map((entry) => ({
      id: entry.path,
      entry,
      type: typeOfPath(entry.path)!,
      name: nameOfPath(entry.path),
      folderKind: kindOfPath(entry.path),
      include: true,
    }));
}

/** Whether an archive held more designs than one pack takes */
export const packTooBig = (entries: ZipEntry[]) =>
  entries.filter((entry) => !isJunk(entry.path) && typeOfPath(entry.path))
    .length > PACK_MAX_ITEMS;

/** The type a design will be sent as */
export const kindOfItem = (item: PackItem, packKind: CommunityKind) =>
  item.kind ??
  item.folderKind ??
  kindOfShape(item.width, item.height) ??
  packKind;

/**
 * Why a design can't be sent as it is; undefined when it can. The same
 * rules as one design (the media server checks again).
 */
export function packProblem(
  item: PackItem,
  kind: CommunityKind,
): PackProblem | undefined {
  const name = item.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return "name";
  const file = checkCommunityFile(
    { type: item.type, size: item.entry.size },
    kind,
  );
  if (file) return file;
  if (item.width === 0 || item.height === 0) return "unreadable";
  if (item.width === undefined || item.height === undefined) return undefined;
  const fit = artFit(kind, item.width, item.height);
  if (fit === "frame-size") return "frame-size";
  if (fit === "tall") return "shape";
  if (
    kind !== "frames" &&
    Math.max(item.width, item.height) > COMMUNITY_MAX_DIMENSION
  )
    return "dimension";
  return undefined;
}

/** How many more designs this person may make: undefined means no limit */
export function designsLeft(
  perms: CommunityPermissions | undefined,
  kept: number,
) {
  if (!perms || perms.unlimited_designs) return undefined;
  const total =
    perms.max_designs !== undefined && perms.max_designs !== null
      ? Math.max(0, perms.max_designs - kept)
      : undefined;
  const today =
    perms.max_designs_per_day !== undefined &&
    perms.max_designs_per_day !== null
      ? Math.max(0, perms.max_designs_per_day - (perms.designs_today ?? 0))
      : undefined;
  if (total === undefined) return today;
  if (today === undefined) return total;
  return Math.min(total, today);
}
