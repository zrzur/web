import { styled } from "styled-system/jsx";

/**
 * Three birds in a shallow V, the small mark of the flock: on the open phone
 * tab, and rising and falling while someone types (`moving`). Decoration, so
 * it is hidden from screen readers; with "reduce motion" the birds hold still.
 */
export function FlockDots(props: { moving?: boolean }) {
  return (
    <Dots aria-hidden="true" data-flock-dots data-moving={props.moving}>
      <i />
      <i />
      <i />
    </Dots>
  );
}

const Dots = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "2px",
    width: "fit-content",
    height: "6px",
    color: "inherit",

    "& i": {
      display: "block",
      width: "3px",
      height: "3px",
      borderRadius: "999px",
      background: "currentColor",
    },
    // the lead bird flies a step ahead
    "& i:nth-child(2)": { marginBlockEnd: "3px" },

    "&[data-moving='true'] i": {
      animation: "zFlock 1.1s ease-in-out infinite",
      _motionReduce: { animation: "none" },
    },
    "&[data-moving='true'] i:nth-child(2)": { animationDelay: "140ms" },
    "&[data-moving='true'] i:nth-child(3)": { animationDelay: "280ms" },
  },
});
