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

/*
 * The list of suggestions is one more floating surface: the same fill, border,
 * radius and shadow as menus and popovers, rows of menu height (44 px on
 * phones) and names that shorten with "…" instead of being cut off.
 */
const completionTheme = EditorView.theme({
  ".cm-scroller": {
    "font-family": "inherit",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--z-popover-border, var(--z-border-strong))",
    display: "flex",
    "flex-direction": "column",
    padding: "6px",
    overflow: "hidden",
    "border-radius": "12px",
    background: "var(--z-popover-bg, var(--z-bg-raised))",
    color: "var(--z-fg-primary)",
    fill: "var(--z-fg-primary)",
    "box-shadow": "var(--z-popover-lift)",
    "font-size": "14px",
    "line-height": "20px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    "min-width": "min(220px, calc(100vw - 32px))",
    "max-width": "min(360px, calc(100vw - 32px))",
    "max-height": "min(50vh, 320px)",
    "font-family": "inherit",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    "align-items": "center",

    cursor: "pointer",
    gap: "8px",
    "min-height": "36px",
    "border-radius": "6px",
    background: "transparent",
    padding: "0 8px",
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected="true"]': {
    background: "var(--z-float-hover, var(--z-nav-selected))",
    color: "var(--z-fg-primary)",
  },
  // the name takes the room it needs and shortens first; its direction
  // follows its own letters, so "…" lands at the end of the word
  ".cm-tooltip.cm-tooltip-autocomplete .cm-completionLabel": {
    flex: "0 1 auto",
    "min-width": "0",
    overflow: "hidden",
    "white-space": "nowrap",
    "text-overflow": "ellipsis",
    "unicode-bidi": "plaintext",
    "font-weight": "500",
  },
  // emoji codes are Latin in every language
  ".cm-tooltip.cm-tooltip-autocomplete.autocomplete-tooltip-emoji .cm-completionLabel":
    {
      direction: "ltr",
      "unicode-bidi": "isolate",
    },
  // the second part (username, description): quiet, upright, at the far side
  ".cm-tooltip.cm-tooltip-autocomplete .cm-completionDetail": {
    flex: "0 10 auto",
    "min-width": "0",
    "margin-inline-start": "auto",
    "padding-inline-start": "8px",
    overflow: "hidden",
    "white-space": "nowrap",
    "text-overflow": "ellipsis",
    "unicode-bidi": "plaintext",
    "font-style": "normal",
    "font-size": "12px",
    color: "var(--z-fg-muted)",
  },
  ".cm-completionMatchedText": {
    "text-decoration": "inherit",
  },
  ".cm-user-preview": {
    display: "block",
    "flex-shrink": "0",
    width: "24px",
    height: "24px",
    "object-fit": "cover",
    "border-radius": "50%",
  },
  ".cm-emoji-preview": {
    display: "block",
    "flex-shrink": "0",
    width: "24px",
    height: "24px",
    "object-fit": "contain",
    padding: "2px",
  },
  ".cm-role-preview": {
    display: "block",
    "flex-shrink": "0",
    width: "12px",
    height: "12px",
    margin: "6px",
    "border-radius": "50%",
  },
  "@media (max-width: 600px)": {
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
      "min-height": "44px",
    },
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
            // decoration: the name beside it is the label
            img.alt = "";
            img.src =
              (completion as Completion & { url?: string }).url || blankSvg;
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
      acceptCompletion(
        view as unknown as Parameters<typeof acceptCompletion>[0],
      );
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
