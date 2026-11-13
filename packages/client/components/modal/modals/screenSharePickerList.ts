/**
 * The screen share picker's list, without the screen: which sources go in
 * which tab, which one is chosen first, and where the arrow keys go.
 */

export type SourceKind = "screen" | "window";

/** One thing that can be shared, as the desktop app describes it */
export type PickerSource = {
  idx: number;
  name: string;
  isFullScreen: boolean;
  /** Missing from older desktop apps: then `isFullScreen` decides */
  kind?: SourceKind;
  screenNumber?: number;
  screenCount?: number;
  /** A small picture of the screen or window (data URL) */
  thumbnail?: string;
  /** A window's app icon (data URL) */
  image?: string;
};

export function sourceKind(source: PickerSource | undefined): SourceKind {
  if (!source) return "screen";
  return source.kind ?? (source.isFullScreen ? "screen" : "window");
}

/** The sources of one tab, in the system's order */
export function sourcesOf(sources: PickerSource[], kind: SourceKind) {
  return sources.filter((source) => sourceKind(source) === kind);
}

/** Chosen when the picker opens: the first screen, else the first window (-1: nothing to share) */
export function firstChoice(sources: PickerSource[]): number {
  return (
    (sourcesOf(sources, "screen")[0] ?? sourcesOf(sources, "window")[0])?.idx ??
    -1
  );
}

/**
 * Where an arrow key, Home or End moves the choice in a grid of `columns`;
 * undefined for any other key or when there is nowhere to go.
 */
export function moveChoice(
  shown: PickerSource[],
  chosen: number,
  key: string,
  columns: number,
  rtl: boolean,
): number | undefined {
  if (!shown.length) return undefined;
  const at = Math.max(
    0,
    shown.findIndex((source) => source.idx === chosen),
  );
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const back = rtl ? "ArrowRight" : "ArrowLeft";
  let next: number;
  if (key === forward) next = at + 1;
  else if (key === back) next = at - 1;
  else if (key === "ArrowDown") next = at + Math.max(1, columns);
  else if (key === "ArrowUp") next = at - Math.max(1, columns);
  else if (key === "Home") next = 0;
  else if (key === "End") next = shown.length - 1;
  else return undefined;
  if (next < 0 || next >= shown.length || next === at) return undefined;
  return shown[next].idx;
}
