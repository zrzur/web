import { For, Show, createSignal, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Button } from "@revolt/ui";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { Mirror } from "./Mirror";
import { WornAvatar, useWearer } from "./Scenes";
import { useTryOn } from "./TryOn";

/**
 * You, at the bottom of the gallery: everything you tap lands on your own
 * avatar here, on a phone and on a desktop alike. It opens upward into the
 * whole mirror and never covers more than it must. Save is the one action.
 */
export function Dock() {
  const { t } = useLingui();
  const tryOn = useTryOn();
  const wearer = useWearer();
  const [open, setOpen] = createSignal(false);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  return (
    <Base aria-label={t`Your look`}>
      <Show when={open()}>
        <Sheet>
          <Mirror style={tryOn.shown()} />
          <Parts>
            <For
              each={tryOn.parts()}
              fallback={
                <span>
                  <Trans>Nothing on yet. Pick something to try on.</Trans>
                </span>
              }
            >
              {(part) => (
                <Chip>
                  <span>{part.label}</span>
                  <button
                    type="button"
                    aria-label={t`Take off ${part.label}`}
                    onClick={() => tryOn.put(part.clear)}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </Chip>
              )}
            </For>
          </Parts>
          <Show when={tryOn.changed()}>
            <Button size="lg" variant="tonal" onPress={() => tryOn.reset()}>
              <Trans>Reset</Trans>
            </Button>
          </Show>
        </Sheet>
      </Show>

      <Show when={tryOn.error()}>
        <Line role="alert" data-error>
          {tryOn.error()}
        </Line>
      </Show>
      <Show when={tryOn.saved() && !tryOn.changed()}>
        <Line role="status">
          <Icon name="check-circle" size={16} />
          <span>
            <Trans>Saved to your profile.</Trans>
          </span>
          <button type="button" onClick={() => void tryOn.undo()}>
            <Trans>Undo</Trans>
          </button>
        </Line>
      </Show>

      <Bar>
        <You
          type="button"
          aria-expanded={open()}
          aria-label={open() ? t`Hide preview` : t`Show preview`}
          onClick={() => setOpen(!open())}
        >
          <Ring data-dock-ring>
            <WornAvatar size={40} style={tryOn.shown()} />
          </Ring>
          <div>
            <strong dir="auto" style={nameStyle(tryOn.shown())}>
              {wearer.name()}
            </strong>
            <small>
              <Show
                when={tryOn.lastName()}
                fallback={
                  <Show
                    when={tryOn.changed()}
                    fallback={<Trans>Tap any design to try it on</Trans>}
                  >
                    <Trans>Not saved yet</Trans>
                  </Show>
                }
              >
                <bdi>{tryOn.lastName()}</bdi>
              </Show>
            </small>
          </div>
          <Icon name={open() ? "caret-down" : "caret-up"} size={16} />
        </You>
        <Show when={tryOn.changed()}>
          <Button
            size="xl"
            variant="filled"
            isDisabled={tryOn.saving()}
            onPress={() => void tryOn.save()}
          >
            <Show when={tryOn.saving()} fallback={<Trans>Save</Trans>}>
              <Trans>Saving…</Trans>
            </Show>
          </Button>
        </Show>
      </Bar>
    </Base>
  );
}

const Base = styled("aside", {
  base: {
    position: "sticky",
    bottom: "12px",
    zIndex: 4,
    alignSelf: "center",
    width: "min(100%, 480px)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "8px",
    boxSizing: "border-box",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-designs-edge)",
    background: "var(--z-bg-floating, var(--z-designs-well))",
    boxShadow: "0 12px 32px rgb(0 0 0 / 0.45)",
  },
});

const Bar = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 },
});

const You = styled("button", {
  base: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    minHeight: "48px",
    padding: "0 8px 0 4px",
    borderRadius: "var(--z-shape-button, 10px)",
    border: "none",
    background: "none",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-fg-muted)",
    transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
    _hover: { background: "var(--z-designs-button)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > div": {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    },
    "& strong": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "15px",
      lineHeight: "20px",
      fontWeight: 600,
    },
    "& small": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
    },
  },
});

/** decoration art reaches past the avatar: keep its room */
const Ring = styled("span", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
  },
});

const Sheet = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "min(64vh, 560px)",
    overflowY: "auto",
    padding: "4px",
    "& > button": { flexShrink: 0 },
  },
});

const Parts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    "& > span": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const Chip = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "32px",
    maxWidth: "100%",
    paddingInline: "12px 4px",
    boxSizing: "border-box",
    borderRadius: "var(--z-shape-chip, 6px)",
    background: "var(--z-designs-button)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    fontWeight: 500,
    "& > span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& button": {
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      width: "24px",
      height: "24px",
      padding: 0,
      borderRadius: "6px",
      border: "none",
      background: "transparent",
      color: "var(--z-fg-muted)",
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "1px",
      },
      _phone: { width: "44px", height: "44px", marginInlineEnd: "-4px" },
    },
    _phone: { height: "44px" },
  },
});

const Line = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingInline: "8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-designs-status-online)",
    "--z-icon-color": "currentColor",
    "&[data-error]": { color: "var(--z-danger)" },
    "& > span:nth-child(2)": { flex: 1 },
    "& button": {
      minHeight: "32px",
      border: "none",
      background: "none",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontWeight: 600,
      textDecoration: "underline",
      cursor: "pointer",
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      _phone: { minHeight: "44px" },
    },
  },
});
