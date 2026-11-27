import { JSX } from "solid-js";

import { styled } from "styled-system/jsx";

const Codeblock = styled("pre", {
  base: {
    color: "#c9d1d9",
    background: "#0d1117",

    width: "fit-content",

    padding: "var(--gap-md)",
    marginY: "var(--gap-sm)",
    borderRadius: "var(--borderRadius-md)",

    wordWrap: "break-word",
    whiteSpace: "pre-wrap",

    "&> code": {
      color: "inherit !important",
      background: "transparent !important",
    },

    // ```ansi: the eight text and background colours Discord draws
    "& [data-fg='30']": { color: "#4f545c" },
    "& [data-fg='31']": { color: "#dc322f" },
    "& [data-fg='32']": { color: "#859900" },
    "& [data-fg='33']": { color: "#b58900" },
    "& [data-fg='34']": { color: "#268bd2" },
    "& [data-fg='35']": { color: "#d33682" },
    "& [data-fg='36']": { color: "#2aa198" },
    "& [data-fg='37']": { color: "#ffffff" },
    "& [data-bg='40']": { background: "#002b36" },
    "& [data-bg='41']": { background: "#cb4b16" },
    "& [data-bg='42']": { background: "#586e75" },
    "& [data-bg='43']": { background: "#657b83" },
    "& [data-bg='44']": { background: "#839496" },
    "& [data-bg='45']": { background: "#6c71c4" },
    "& [data-bg='46']": { background: "#93a1a1" },
    "& [data-bg='47']": { background: "#fdf6e3" },
    "& [data-bold]": { fontWeight: 700 },
    "& [data-underline]": { textDecoration: "underline" },
    // ```fix: the whole block in yellow
    "& > code[data-tone=fix]": { color: "#e3b341 !important" },
  },
});

/**
 * Render a code block with copy text button
 */
export function RenderCodeblock(props: {
  children: JSX.Element;
  class?: string;
}) {
  // code reads left to right in every language: in an Arabic page the
  // punctuation at the end of a line otherwise jumps to its start
  return <Codeblock dir="ltr">{props.children}</Codeblock>;
}
