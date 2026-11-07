import { useLingui } from "@lingui/solid/macro";

import { styled } from "styled-system/jsx";

/**
 * Indeterminate circular progress — Zrzur native (replaces MDUI).
 */
export function CircularProgress() {
  const { t } = useLingui();
  return (
    <Base role="status" aria-label={t`Loading`}>
      <Spinner />
    </Base>
  );
}

const Base = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: "40px",
    minHeight: "40px",
  },
});

const Spinner = styled("div", {
  base: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "28px",
    height: "28px",
    marginLeft: "-14px",
    marginTop: "-14px",
    borderRadius: "50%",
    border:
      "2.5px solid color-mix(in srgb, var(--z-accent, #E0195F) 25%, transparent)",
    borderTopColor: "var(--z-accent, #E0195F)",
    animation: "zSpin 0.7s linear infinite",
  },
});
