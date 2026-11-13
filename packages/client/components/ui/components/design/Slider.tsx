import { type JSX, createMemo, splitProps } from "solid-js";

import { styled } from "styled-system/jsx";

type Props = Omit<
  JSX.HTMLAttributes<HTMLInputElement>,
  "onChange" | "onInput" | "value"
> & {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  tickmarks?: boolean;
  labelFormatter?: (value: number) => string;
  onChange?: (event: { currentTarget: { value: number } }) => void;
  onInput?: (event: { currentTarget: { value: number } }) => void;
};

/**
 * Zrzur range slider — native input, gaming-calm track (no Material thumb).
 */
export function Slider(props: Props) {
  const [local, rest] = splitProps(props, [
    "min",
    "max",
    "step",
    "value",
    "tickmarks",
    "labelFormatter",
    "onChange",
    "onInput",
    "class",
  ]);

  const min = () => local.min ?? 0;
  const max = () => local.max ?? 100;
  const pct = createMemo(() => {
    const span = max() - min() || 1;
    return ((Number(local.value) - min()) / span) * 100;
  });

  const label = createMemo(() =>
    local.labelFormatter
      ? local.labelFormatter(Number(local.value))
      : String(local.value),
  );

  function emit(
    handler: Props["onInput"] | Props["onChange"] | undefined,
    e: Event & { currentTarget: HTMLInputElement },
  ) {
    handler?.({ currentTarget: { value: Number(e.currentTarget.value) } });
  }

  return (
    <Wrap class={local.class}>
      <Track
        style={{
          "--z-slider-pct": `${pct()}%`,
        }}
      >
        <Range
          {...rest}
          type="range"
          min={min()}
          max={max()}
          step={local.step ?? 1}
          value={local.value}
          onInput={(e) => emit(local.onInput, e)}
          onChange={(e) => emit(local.onChange, e)}
        />
      </Track>
      <Value>{label()}</Value>
    </Wrap>
  );
}

const Wrap = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
  },
});

const Track = styled("div", {
  base: {
    position: "relative",
    flex: 1,
    height: "28px",
    display: "flex",
    alignItems: "center",
  },
});

// the line that is drawn: 6 px, filled from the start side up to the value
const trackPaint = {
  height: "6px",
  borderRadius: "999px",
  background: `linear-gradient(
      var(--z-slider-dir),
      var(--z-accent, #E0195F) 0%,
      var(--z-accent, #E0195F) var(--z-slider-pct, 0%),
      var(--z-slate-2, #4A3F59) var(--z-slider-pct, 0%),
      var(--z-slate-2, #4A3F59) 100%
    )`,
};

const Range = styled("input", {
  base: {
    width: "100%",
    // the control is a 24 px target; only the 6 px line inside it is drawn
    height: "24px",
    margin: 0,
    appearance: "none",
    background: "transparent",
    // the fill grows from the start side: left in English, right in Arabic
    "--z-slider-dir": "to right",
    "[dir='rtl'] &": { "--z-slider-dir": "to left" },
    outline: "none",
    cursor: "pointer",

    "&::-webkit-slider-runnable-track": trackPaint,
    "&::-moz-range-track": trackPaint,

    // the knob: a white button ringed in the accent, with a soft halo while
    // held
    "&::-webkit-slider-thumb": {
      appearance: "none",
      width: "18px",
      height: "18px",
      // centred on the 6 px line
      marginTop: "-6px",
      borderRadius: "50%",
      background: "#FFFFFF",
      border: "2px solid var(--z-accent, #E0195F)",
      cursor: "pointer",
      transition: "box-shadow 120ms ease",
    },
    "&:active::-webkit-slider-thumb, &:hover::-webkit-slider-thumb": {
      boxShadow:
        "0 0 0 4px color-mix(in srgb, var(--z-accent, #E0195F) 20%, transparent)",
    },
    "&::-moz-range-thumb": {
      width: "18px",
      height: "18px",
      boxSizing: "border-box",
      borderRadius: "50%",
      background: "#FFFFFF",
      border: "2px solid var(--z-accent, #E0195F)",
      cursor: "pointer",
    },
    // the ring goes around the knob, where the eye already is
    "&:focus-visible::-webkit-slider-thumb": {
      boxShadow: "var(--z-focus-ring)",
    },
    "&:focus-visible::-moz-range-thumb": {
      boxShadow: "var(--z-focus-ring)",
    },
  },
});
const Value = styled("span", {
  base: {
    minWidth: "40px",
    textAlign: "end",
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    color: "var(--z-fg-secondary)",
  },
});
