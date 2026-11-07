import { JSX } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Sky } from "@revolt/ui/components/design/Sky";

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A design lands on you: a copy of what was tapped flies from where it is to
 * your avatar in the dock. The signature of the whole of Designs.
 */
export function flyToDock(from: HTMLElement) {
  const target = document.querySelector("[data-dock-ring]");
  if (!target || reduced()) return;
  const start = from.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  const copy = from.cloneNode(true) as HTMLElement;
  Object.assign(copy.style, {
    position: "fixed",
    insetBlockStart: "0",
    left: "0",
    width: `${start.width}px`,
    height: `${start.height}px`,
    margin: "0",
    zIndex: "50",
    pointerEvents: "none",
    opacity: "1",
    transition: "none",
  });
  document.body.appendChild(copy);
  const scale = Math.max(0.2, end.width / Math.max(start.width, 1));
  const dx = end.left + end.width / 2 - start.width / 2;
  const dy = end.top + end.height / 2 - start.height / 2;
  // a short arc up, then the dive
  const animation = copy.animate(
    [
      { transform: `translate(${start.left}px, ${start.top}px) scale(1)` },
      {
        transform: `translate(${(start.left + dx) / 2}px, ${Math.min(start.top, dy) - 64}px) scale(1.15)`,
        offset: 0.35,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    ],
    { duration: 560, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  );
  animation.onfinish = () => {
    copy.remove();
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.22)" },
        { transform: "scale(1)" },
      ],
      { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" },
    );
  };
}

/**
 * The top of the gallery: the app's own calm flock of dots, with the page's
 * title on the lower part of the sky. One lit bird per maker.
 */
export function FlockStage(props: {
  /** one lit bird per maker */
  lit: number;
  title: JSX.Element;
  text: JSX.Element;
}) {
  const { t } = useLingui();
  return (
    <Stage aria-label={t`The flock`}>
      <Sky lit={props.lit} />
      <Words>
        <h1>{props.title}</h1>
        <p>{props.text}</p>
      </Words>
    </Stage>
  );
}

const Stage = styled("section", {
  base: {
    position: "relative",
    width: "100cqw",
    marginInlineStart: "calc(50% - 50cqw)",
    marginBlockStart: "-104px",
    height: "340px",
    isolation: "isolate",
    background: "var(--z-designs-page)",
    // the light starts at the very top: on the site, behind its header
    "&::before": {
      content: "''",
      position: "absolute",
      zIndex: -1,
      insetInline: 0,
      insetBlock: "calc(var(--dz-under, 0px) * -1) 0",
      background:
        "radial-gradient(90% 90% at 50% -20%, var(--z-designs-glow), transparent 70%)",
      pointerEvents: "none",
    },
    "@container (max-width: 599px)": {
      marginBlockStart: "-68px",
      height: "280px",
    },
  },
});

/** the words stand on the lower part of the sky */
const Words = styled("div", {
  base: {
    position: "absolute",
    insetBlockEnd: "24px",
    insetInline: "max(16px, calc(50cqw - 560px))",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& h1": {
      margin: 0,
      // never in ch: that changes when the font arrives, and the title jumps
      maxWidth: "min(100%, 520px)",
      textWrap: "balance",
      fontSize: "clamp(30px, 3.8cqw, 48px)",
      lineHeight: "1.15",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
      "&:dir(rtl)": { lineHeight: "1.25" },
    },
    "& p": {
      margin: 0,
      maxWidth: "48ch",
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});
