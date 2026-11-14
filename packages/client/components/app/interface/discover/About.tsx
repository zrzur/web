import { Markdown } from "@revolt/markdown";
import { styled } from "styled-system/jsx";

/**
 * A listing's description, formatted: the same safe renderer the server
 * info panel uses (bold, lists, links; no pictures, no HTML). Links to other
 * sites ask before they open, as they do in a chat.
 */
export function ListingAbout(props: { text: string }) {
  return (
    <AboutText data-about>
      <Markdown content={props.text} disallowBigEmoji />
    </AboutText>
  );
}

const AboutText = styled("div", {
  base: {
    maxWidth: "680px",
    // no gap of its own: the renderer keeps the writer's empty lines, as in
    // a chat message and the server info panel
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
    // Arabic needs a little more room between lines
    "&:lang(ar)": { lineHeight: "26px" },

    "& p, & ul, & ol, & blockquote": { margin: 0 },
    "& ul, & ol": { marginBlock: "4px" },
    "& li + li": { marginTop: "4px" },
    // a writer's headings stay below the page's own "About" heading
    "& h1, & h2, & h3, & h4, & h5, & h6": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
    },
    "& a": {
      overflowWrap: "anywhere",
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
    "& pre": { maxWidth: "100%", overflowX: "auto" },
    "& table": { display: "block", maxWidth: "100%", overflowX: "auto" },
  },
});
