import { type ComponentProps, createComponent } from "solid-js";

import { lazy } from "@revolt/common/lib/lazyPart";

import { PageBoundary } from "../../utils/PageBoundary";

/**
 * The text editor (CodeMirror) loads when the first editor is shown, not
 * with the app: it is the composer, message editing and profile fields
 */
const LazyEditor = lazy(() =>
  import("./TextEditor2").then((module) => ({ default: module.TextEditor2 })),
);

/**
 * The editor, in its own boundary: when its code could not be downloaded a
 * note with Try again takes its place, and the window or page around it
 * stays as it was (a profile being edited keeps its other fields)
 */
export const TextEditor2 = Object.assign(
  (props: ComponentProps<typeof LazyEditor>) =>
    createComponent(PageBoundary, {
      get children() {
        return createComponent(LazyEditor, props);
      },
    }),
  { preload: LazyEditor.preload },
);
