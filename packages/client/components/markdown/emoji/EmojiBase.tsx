import { styled } from "styled-system/jsx";

/**
 * Image component for rendering emojis
 */
export const EmojiBase = styled("img", {
  base: {
    objectFit: "contain",
    display: "inline-block",
    width: "var(--emoji-size)",
    height: "var(--emoji-size)",
    margin: "0 0.05em 0 0.1em",
    verticalAlign: "middle",

    // hide alt text
    color: "transparent",
  },
});
