import { lazy } from "solid-js";

/**
 * The text editor (CodeMirror) loads when the first editor is shown, not
 * with the app: it is the composer, message editing and profile fields
 */
export const TextEditor2 = lazy(() =>
  import("./TextEditor2").then((module) => ({ default: module.TextEditor2 })),
);
