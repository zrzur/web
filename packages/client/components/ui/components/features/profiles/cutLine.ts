import { cva } from "styled-system/css";

/**
 * One line of text in a language of its own (a game's English name on an
 * Arabic profile), given `dir="auto"`: it is cut at its own end, and still
 * starts on the side the row starts. `bdi` alone would cut the start of the
 * name.
 */
export const cutLine = cva({
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    ":dir(rtl) > &": { textAlign: "right" },
    ":dir(ltr) > &": { textAlign: "left" },
  },
});
