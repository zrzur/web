import {
  type Completion,
  acceptCompletion,
  autocompletion,
  currentCompletions,
} from "@codemirror/autocomplete";
import { EditorView, keymap } from "@codemirror/view";
import { Accessor } from "solid-js";

import { scrollableStyles } from "../../../directives/scrollable";
import { AutoCompleteSearchSpace } from "../../utils/autoComplete";
import { codeMirrorAutoCompleteSource } from "./codeMirrorAutoCompleteSource";

const completionTheme = EditorView.theme({
  ".cm-scroller": {
    "font-family": "inherit",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "none",
    display: "flex",
    "flex-direction": "column",
    padding: "var(--gap-md) 0",
    overflow: "hidden",
    "border-radius": "var(--borderRadius-xs)",
    background: "var(--md-sys-color-surface-container)",
    color: "var(--md-sys-color-on-surface)",
    fill: "var(--md-sys-color-on-surface)",
    "box-shadow": "0 0 3px var(--md-sys-color-shadow)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    "min-width": "10em",
    "max-width": "50vw",
    "max-height": "min(50vh, 490px)",
    "font-family": "inherit",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    "align-items": "center",

    cursor: "pointer",
    gap: "var(--gap-md)",
    background: "transparent",
    padding: "var(--gap-sm) var(--gap-md)",
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected="true"]': {
    background:
      "color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent)",
  },
  ".cm-completionMatchedText": {
    "text-decoration": "inherit",
  },
  ".cm-user-preview": {
    display: "inline-block",
    width: "24px",
    height: "24px",
    "vertical-align": "baseline",
    // "margin-bottom": "-0.2em",
    "object-fit": "cover",
    padding: "var(--gap-xxs)",
    "border-radius": "var(--borderRadius-circle)",
  },
  ".cm-emoji-preview": {
    display: "inline-block",
    width: "24px",
    height: "24px",
    "vertical-align": "baseline",
    // "margin-bottom": "-0.2em",
    "object-fit": "contain",
    padding: "var(--gap-xxs)",
  },
  ".cm-role-preview": {
    display: "inline-block",
    width: "12px",
    height: "12px",
    "vertical-align": "baseline",
    // "margin-bottom": "-0.2em",
    margin: "6px",
    "border-radius": "var(--borderRadius-circle)",
  },
});

export function codeMirrorAutoComplete(
  searchSpace?: Accessor<AutoCompleteSearchSpace>,
) {
  const autocompleteScrollbarClasses = scrollableStyles();

  const extension = autocompletion({
    activateOnTyping: true,
    aboveCursor: true,
    icons: false,
    override: [codeMirrorAutoCompleteSource(() => searchSpace?.() ?? {})],
    closeOnBlur: false, // note: disable to debug styles
    tooltipClass: (state) => {
      const completions = currentCompletions(state);
      if (completions[0]?.type == "emoji") {
        return (
          "autocomplete-tooltip autocomplete-tooltip-emoji " +
          autocompleteScrollbarClasses
        );
      } else if (
        completions[0]?.type == "user" ||
        completions[0]?.type == "role"
      ) {
        return (
          "autocomplete-tooltip autocomplete-tooltip-mention " +
          autocompleteScrollbarClasses
        );
      } else if (completions[0]?.type == "channel") {
        return (
          "autocomplete-tooltip autocomplete-tooltip-channel " +
          autocompleteScrollbarClasses
        );
      } else {
        return (
          "autocomplete-tooltip autocomplete-tooltip-unknown " +
          autocompleteScrollbarClasses
        );
      }
    },
    // optionClass: (completion) => "example-option-class",
    addToOptions: [
      {
        render: (completion, _state, _view) => {
          const blankSvg =
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
          if (completion.type == "emoji") {
            const preview = document.createElement("span");
            preview.className = "cm-emoji-preview";
            preview.style.fontFamily =
              '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
            const text = String(completion.apply ?? completion.label)
              .replace(/^[\uE0E0-\uE0E6]/, "")
              .replace(/^\u200C(?=[\u{1F1E6}-\u{1F1FF}]$)/u, "");
            const url = (completion as Completion & { url?: string }).url;
            const fallback = () => {
              preview.textContent = text;
            };
            if (url) {
              const img = document.createElement("img");
              img.loading = "lazy";
              img.alt = text;
              img.style.cssText = "width:100%;height:100%;object-fit:contain";
              img.addEventListener("error", fallback, { once: true });
              img.src = url;
              preview.appendChild(img);
            } else fallback();
            return preview;
          } else if (completion.type == "user") {
            const img = document.createElement("img");
            img.classList.add("cm-user-preview");
            img.loading = "lazy";
            img.src = (completion as Completion & { url?: string }).url || blankSvg;
            return img;
          } else if (completion.type == "role") {
            const span = document.createElement("span");
            span.classList.add("cm-role-preview");
            span.style.background =
              (completion as Completion & { colour?: string }).colour ||
              "var(--md-sys-color-surface-container-highest)";
            return span;
          } else if (completion.type == "channel") {
            const span = document.createElement("span");
            span.classList.add("cm-channel-preview");
            return span;
          } else {
            return null;
          }
        },
        position: 30,
      },
    ],
  });

  function accept(view: EditorView, key: string) {
    const completions = currentCompletions(view.state);
    if (
      key === ":" ? completions[0]?.type === "emoji" : completions.length > 0
    ) {
      acceptCompletion(view as unknown as Parameters<typeof acceptCompletion>[0]);
      return true;
    }
    return false;
  }

  const emojiKeymap = keymap.of([
    { key: ":", run: (v) => accept(v, ":") },
    { key: "Tab", run: (v) => accept(v, "Tab") },
  ]);

  return [extension, emojiKeymap, completionTheme];
}
