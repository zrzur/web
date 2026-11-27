import { Show, createSignal, onCleanup, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Button } from "@revolt/ui";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { Mirror } from "./Mirror";
import { WornAvatar, useWearer } from "./Scenes";
import { useTryOn } from "./TryOn";

/**
 * How wide the Designs page has to be for you to stand beside the gallery;
 * the same width as the page's own layout (WithLook in Designs.tsx)
 */
const LOOK_SIDE_PX = 1100;

/**
 * You, in what you try on, wherever designs are on show. Every tap on a
 * design lands on you here, and the preview opens where that design is seen:
 * a nameplate in a member list, a frame on the profile, a name style in a
 * conversation. With nothing in hand you see your whole look.
 *
 * On a wide page you stand beside the gallery, always open; on a narrower
 * one you are a bar along the bottom that opens upward. Save is the one
 * action.
 */
export function Dock() {
  const [side, setSide] = createSignal(false);
  let probe: HTMLSpanElement | undefined;

  onMount(() => {
    const scroll = probe?.closest<HTMLElement>("[data-designs-scroll]");
    if (!scroll) return;
    const observer = new ResizeObserver(() => {
      setSide(scroll.clientWidth >= LOOK_SIDE_PX);
      // how tall the page's scrolling box is: the panel beside the gallery
      // fits in it and scrolls on its own to the very end
      // (nothing laid out yet, a hidden tab: keep what the page had)
      if (scroll.clientHeight)
        scroll.style.setProperty("--dz-view-h", `${scroll.clientHeight}px`);
    });
    observer.observe(scroll);
    onCleanup(() => observer.disconnect());
  });

  return (
    <>
      <span ref={probe} hidden />
      <Show when={side()} fallback={<Bottom />}>
        <Side />
      </Show>
    </>
  );
}

/** Beside the gallery: always open, the preview and Save */
function Side() {
  const { t } = useLingui();
  const tryOn = useTryOn();
  let panel: HTMLElement | undefined;

  // The panel and the gallery scroll each on their own: the panel always
  // ends at the bottom of the page's box, wherever it stands now (high on
  // the page before it sticks), so its last part is always in reach, and
  // the wheel over it moves it alone.
  onMount(() => {
    const scroll = panel?.closest<HTMLElement>("[data-designs-scroll]");
    if (!panel || !scroll) return;
    let frame = 0;
    const fit = () => {
      frame = 0;
      const room =
        scroll.getBoundingClientRect().bottom -
        panel!.getBoundingClientRect().top -
        16;
      if (room > 120) panel!.style.maxHeight = `${Math.floor(room)}px`;
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    fit();
    scroll.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      scroll.removeEventListener("scroll", later);
      window.removeEventListener("resize", later);
    });
  });

  return (
    <SidePanel ref={panel} aria-label={t`Your look`}>
      <SideHead>
        <h2>
          <Trans>Your look</Trans>
        </h2>
        <Show when={tryOn.changed()}>
          <button type="button" onClick={() => tryOn.reset()}>
            <Trans>Reset</Trans>
          </button>
        </Show>
      </SideHead>

      <Mirror
        style={tryOn.shown()}
        place={tryOn.place()}
        whole
        fullSize
        label={t`Where to preview`}
      />

      <Status />

      <Show when={tryOn.changed()}>
        <SaveBar>
          <Button
            size="lg"
            variant="filled"
            isDisabled={tryOn.saving()}
            onPress={() => void tryOn.save()}
          >
            <Show when={tryOn.saving()} fallback={<Trans>Save</Trans>}>
              <Trans>Saving…</Trans>
            </Show>
          </Button>
        </SaveBar>
      </Show>
    </SidePanel>
  );
}

/** Along the bottom: you, small, opening upward into the preview */
function Bottom() {
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
    <BottomBar aria-label={t`Your look`}>
      <Show when={open()}>
        <Sheet>
          <Mirror
            style={tryOn.shown()}
            place={tryOn.place()}
            whole
            label={t`Where to preview`}
          />
          <Show when={tryOn.changed()}>
            <Button size="lg" variant="tonal" onPress={() => tryOn.reset()}>
              <Trans>Reset</Trans>
            </Button>
          </Show>
        </Sheet>
      </Show>

      <Status />

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
    </BottomBar>
  );
}

/** Saved, or why not */
function Status() {
  const tryOn = useTryOn();
  return (
    <>
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
    </>
  );
}

/**
 * Beside the gallery, it stays in view under the page's own bar and keeps
 * its own scroll when the preview is taller than the window
 */
const SidePanel = styled("aside", {
  base: {
    position: "sticky",
    // under the page's own bar, level with the kinds row beside it
    top: "calc(var(--dz-under, 0px) + 64px)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    // the page's own scrolling box, less the bar above and a margin below
    maxHeight: "calc(var(--dz-view-h, 100dvh) - var(--dz-under, 0px) - 80px)",
    overflowY: "auto",
    // the wheel over the panel never moves the gallery beside it
    overscrollBehavior: "contain",
    scrollbarWidth: "thin",
    minWidth: 0,
  },
});

const SideHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "8px",
    "& h2": {
      margin: 0,
      fontSize: "16px",
      lineHeight: "24px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& button": {
      padding: 0,
      border: "none",
      background: "none",
      color: "var(--z-fg-secondary)",
      font: "inherit",
      fontSize: "13px",
      fontWeight: 600,
      cursor: "pointer",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
        borderRadius: "4px",
      },
    },
  },
});

/** Save, kept at the foot of the panel while it scrolls */
const SaveBar = styled("div", {
  base: {
    position: "sticky",
    bottom: 0,
    paddingBlock: "8px 0",
    background: "var(--z-designs-page)",
    "& > button": { width: "100%" },
  },
});

const BottomBar = styled("aside", {
  base: {
    position: "sticky",
    bottom: "12px",
    zIndex: 4,
    justifySelf: "center",
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
