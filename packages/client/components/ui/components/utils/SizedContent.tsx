import { JSX, createMemo } from "solid-js";
import { styled } from "styled-system/jsx";
import { fitMessageMedia } from "./mediaSize";

interface Props {
  width: number;
  height: number;
  children: JSX.Element;
}

/** Reserve the full media rectangle before loading, including on narrow screens. */
export function SizedContent(props: Props) {
  const size = createMemo(() => fitMessageMedia(props.width, props.height));
  return (
    <Container
      data-message-media
      style={{
        width: size().width + "px",
        "aspect-ratio": size().width + " / " + size().height,
      }}
    >
      {props.children}
    </Container>
  );
}

const Container = styled("div", {
  base: {
    position: "relative",
    display: "grid",
    flexShrink: 0,
    alignSelf: "start",
    minWidth: 0,
    minHeight: 0,
    maxWidth: "100%",
    height: "auto",
    overflow: "hidden",
    borderRadius: "var(--borderRadius-md)",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    "& > *": {
      // Intrinsic image dimensions must not enlarge the grid track or crop its bottom.
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      minWidth: 0,
      minHeight: 0,
      maxWidth: "100%",
      maxHeight: "100%",
      display: "block",
      objectFit: "contain",
      objectPosition: "center",
    },
  },
});
