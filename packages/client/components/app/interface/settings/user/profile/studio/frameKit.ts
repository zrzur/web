/**
 * The frame kit: a template, an example and a palette for drawing a profile
 * frame, made by `scripts/designs/frame-kit.mjs` into `public/frame-kit/`.
 * Static files, fetched only when someone downloads them: the service worker
 * keeps scripts and styles only, so none of them is in its precache.
 */
export const FRAME_KIT_FILES = {
  /** everything in one zip */
  kit: "zrzur-frame-kit.zip",
  /** the template with named guide layers */
  svg: "template.svg",
  /** the same template as a picture of the file's exact size */
  png: "template.png",
  /** a finished frame that passes every check */
  example: "example-frame.png",
} as const;

export type FrameKitFile = keyof typeof FRAME_KIT_FILES;

/** Where the kit's files are served, under the app's base */
export const frameKitUrl = (file: FrameKitFile) =>
  `${import.meta.env?.BASE_URL ?? "/"}frame-kit/${FRAME_KIT_FILES[file]}`;

/** Save one file of the kit */
export function downloadFrameKit(file: FrameKitFile) {
  const link = document.createElement("a");
  link.href = frameKitUrl(file);
  link.download = FRAME_KIT_FILES[file];
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
