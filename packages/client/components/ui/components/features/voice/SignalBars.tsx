import { styled } from "styled-system/jsx";

import "@revolt/app/menus/voice-menu.css";

import type { useVoice } from "@revolt/rtc";

type VoiceState = ReturnType<ReturnType<typeof useVoice>["state"]>;

/**
 * Connection strength bars for the voice connection, coloured by state
 */
export function SignalBars(props: { state: VoiceState; size?: number }) {
  return (
    <Bars
      data-state={props.state}
      aria-hidden="true"
      style={{ "--size": `${props.size ?? 16}px` }}
    >
      <span />
      <span />
      <span />
    </Bars>
  );
}

const Bars = styled("span", {
  base: {
    "--bar-color": "var(--z-presence-online)",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "calc(var(--size) / 8)",
    width: "var(--size)",
    height: "var(--size)",
    paddingBlock: "calc(var(--size) / 8)",

    "& > span": {
      width: "calc(var(--size) / 5)",
      borderRadius: "999px",
      background: "var(--bar-color)",
      transition: "background-color .2s ease, opacity .2s ease",
    },
    "& > span:nth-child(1)": { height: "40%" },
    "& > span:nth-child(2)": { height: "70%" },
    "& > span:nth-child(3)": { height: "100%" },

    "&[data-state='CONNECTING'], &[data-state='RECONNECTING']": {
      "--bar-color": "var(--z-status-warning)",
      "& > span": { animation: "zSignalPulse 1.2s ease-in-out infinite" },
      "& > span:nth-child(2)": { animationDelay: ".15s" },
      "& > span:nth-child(3)": { animationDelay: ".3s" },
    },
    "&[data-state='DISCONNECTED']": {
      "--bar-color": "var(--z-status-error)",
      "& > span:nth-child(n+2)": { opacity: 0.3 },
    },
  },
});
