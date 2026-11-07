import type { IFormControl } from "solid-forms";
import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { MAX_VOICE_USER_LIMIT } from "@revolt/rtc/moderation";

/**
 * Voice channel user limit as a slider, like Discord: the far left is
 * unlimited (∞), the far right MAX_VOICE_USER_LIMIT.
 * The control holds a string: "" for unlimited, otherwise the number.
 */
export function UserLimitSlider(props: {
  control: IFormControl<string>;
  disabled?: boolean;
}) {
  const { t } = useLingui();

  const value = () => {
    const n = Number(props.control.value || 0);
    return Number.isFinite(n)
      ? Math.min(Math.max(n, 0), MAX_VOICE_USER_LIMIT)
      : 0;
  };
  const percent = () => (value() / MAX_VOICE_USER_LIMIT) * 100;

  return (
    <Field>
      <Head>
        <Label for="voice-user-limit">{t`User limit`}</Label>
        <Value data-unlimited={value() === 0}>
          <Show when={value() > 0} fallback={t`No limit`}>
            {t`${value()} users`}
          </Show>
        </Value>
      </Head>
      <Range
        id="voice-user-limit"
        name="userLimit"
        type="range"
        min={0}
        max={MAX_VOICE_USER_LIMIT}
        step={1}
        value={value()}
        disabled={props.disabled}
        aria-valuetext={value() === 0 ? t`No limit` : t`${value()} users`}
        style={{ "--pct": `${percent()}%` }}
        onInput={(e) => {
          const n = Number(e.currentTarget.value);
          props.control.setValue(n === 0 ? "" : String(n));
          props.control.markDirty(true);
        }}
      />
      <Scale aria-hidden="true">
        <span>∞</span>
        <span>{MAX_VOICE_USER_LIMIT}</span>
      </Scale>
    </Field>
  );
}

const Field = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const Label = styled("label", {
  base: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const Value = styled("span", {
  base: {
    minWidth: "64px",
    paddingInline: "10px",
    height: "24px",
    lineHeight: "24px",
    textAlign: "center",
    borderRadius: "var(--borderRadius-full)",
    fontSize: "12px",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: "var(--z-on-accent)",
    background: "var(--z-accent-fill, var(--z-accent))",

    "&[data-unlimited='true']": {
      color: "var(--z-fg-secondary)",
      background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    },
  },
});

const Range = styled("input", {
  base: {
    appearance: "none",
    width: "100%",
    height: "20px",
    margin: 0,
    background: "transparent",
    cursor: "pointer",

    _disabled: { opacity: 0.5, cursor: "not-allowed" },
    _focusVisible: { outline: "none" },

    // track: filled part in the accent colour up to the thumb
    "&::-webkit-slider-runnable-track": {
      height: "6px",
      borderRadius: "999px",
      background:
        "linear-gradient(to right, var(--z-accent) 0 var(--pct), color-mix(in srgb, var(--z-fg-primary) 12%, transparent) var(--pct) 100%)",
    },
    "&::-moz-range-track": {
      height: "6px",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    },
    "&::-moz-range-progress": {
      height: "6px",
      borderRadius: "999px",
      background: "var(--z-accent)",
    },

    "&::-webkit-slider-thumb": {
      appearance: "none",
      width: "18px",
      height: "18px",
      marginTop: "-6px",
      borderRadius: "50%",
      background: "#fff",
      border: "none",
      boxShadow: "0 1px 4px rgba(0, 0, 0, .45)",
      transition: "transform .1s ease",
    },
    "&::-moz-range-thumb": {
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "#fff",
      border: "none",
      boxShadow: "0 1px 4px rgba(0, 0, 0, .45)",
    },
    "&:active::-webkit-slider-thumb": { transform: "scale(1.15)" },
    "&:focus-visible::-webkit-slider-thumb": {
      boxShadow: "0 0 0 3px var(--z-focus)",
    },
  },
});

const Scale = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});
