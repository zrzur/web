import { styled } from "styled-system/jsx";

import { FRAME_TEMPLATE } from "./communityFrame";

const T = FRAME_TEMPLATE;
const CARD_WIDTH = T.card.right - T.card.left;

/**
 * The community frame template's guides over a card `width` px wide, drawn
 * in the card's own box (put it next to the card, inside `FramedCard`): how
 * far the art may reach, the safe zone that must stay clear, and the crest
 * window over the banner where the art may cross into the card. The numbers
 * scale with the width, like the frame itself (`frameBorderImage`).
 */
export function FrameGuides(props: { width: number }) {
  const s = () => props.width / CARD_WIDTH;
  const px = (n: number) => `${+(n * s()).toFixed(2)}px`;
  const inset = T.safe.left - T.card.left;
  const crest = () => ({
    left: px(T.crest.left - T.safe.left),
    right: px(T.crest.right - T.safe.left),
    bottom: px(T.crest.bottom - T.safe.top),
  });
  return (
    <Guides aria-hidden="true" data-testid="frame-guides">
      <Reach
        data-guide="reach"
        style={{
          top: `-${px(T.card.top)}`,
          bottom: `-${px(T.height - T.card.bottom)}`,
          left: `-${px(T.card.left)}`,
          right: `-${px(T.card.left)}`,
        }}
      />
      <Card data-guide="card" />
      <Safe
        data-guide="safe"
        style={{
          inset: px(inset),
          // the safe zone less the crest window, cut out of its top
          "clip-path": `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${crest().left} 0, ${crest().right} 0, ${crest().right} ${crest().bottom}, ${crest().left} ${crest().bottom}, ${crest().left} 0)`,
        }}
      />
      <Crest
        data-guide="crest"
        style={{
          top: px(inset),
          left: px(T.crest.left - T.card.left),
          width: px(T.crest.right - T.crest.left),
          height: px(T.crest.bottom - T.crest.top),
        }}
      />
    </Guides>
  );
}

const Guides = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: 3,
    pointerEvents: "none",
    // the template is the same in either direction
    direction: "ltr",
  },
});

/** how far the art may reach round the card */
const Reach = styled("div", {
  base: {
    position: "absolute",
    border: "1px dashed var(--z-fg-secondary)",
  },
});

/** the card's own edge */
const Card = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    border: "1px solid var(--z-fg-primary)",
    borderRadius: "14px",
  },
});

/** must stay clear: the card less 10 px, without the crest window */
const Safe = styled("div", {
  base: {
    position: "absolute",
    background: "color-mix(in srgb, var(--z-focus) 22%, transparent)",
    outline: "2px dashed var(--z-focus)",
    outlineOffset: "-2px",
  },
});

/** where the crest may cross into the card, over the banner */
const Crest = styled("div", {
  base: {
    position: "absolute",
    border: "2px solid var(--z-fg-primary)",
  },
});
