import { Show, createSignal, createUniqueId, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

/**
 * The one place the word for a paid placement lives. To change "Ad" to
 * "Sponsored" edit the message below and its en/ar/de catalog entries
 * (Ad / Anzeige / إعلان). The explicit id keeps the short word from ever
 * sharing a catalog entry with some other "Ad".
 */
export function useAdWord() {
  const { t } = useLingui();
  return () => t({ id: "discover.paid.ad", message: "Ad" });
}

export function AdWord() {
  return <Trans id="discover.paid.ad">Ad</Trans>;
}

/**
 * Explains a paid placement in plain words: for whom, bought by whom, and
 * how it is placed (the same for everyone, never from personal data)
 */
export function WhyNote(props: { kind?: "servers" | "bots"; name?: string }) {
  const name = () => props.name ?? "";
  return (
    <Show
      when={props.kind === "bots"}
      fallback={
        <Trans>
          Paid placement for <bdi>{name()}</bdi>, bought by a manager of this
          server. Everyone who can see this server on Discover sees it in the
          same place. It is not chosen using your data or messages.
        </Trans>
      }
    >
      <Trans>
        Paid placement for <bdi>{name()}</bdi>, bought by the owner of this bot.
        Everyone browsing bots on Discover sees it in the same place. It is not
        chosen using your data or messages.
      </Trans>
    </Show>
  );
}

const NOTE_WIDTH = 264;

/**
 * "Ad" label plus a "Why am I seeing this?" disclosure. Shown next to the
 * tier on every paid placement (cards, the Headline hero, details).
 */
export function AdLabel(props: { kind?: "servers" | "bots"; name?: string }) {
  const { t } = useLingui();
  const noteId = `why-ad-${createUniqueId()}`;
  const [open, setOpen] = createSignal(false);
  const [pos, setPos] = createSignal<{ top: number; left: number }>();
  let button!: HTMLButtonElement;
  let note: HTMLDivElement | undefined;

  function place() {
    const rect = button.getBoundingClientRect();
    const rtl = getComputedStyle(button).direction === "rtl";
    const wanted = rtl ? rect.right - NOTE_WIDTH : rect.left;
    const left = Math.max(
      8,
      Math.min(wanted, window.innerWidth - NOTE_WIDTH - 8),
    );
    setPos({ top: rect.bottom + 8, left });
  }

  // capture phase: Escape closes only the note, never the dialog behind it
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close(true);
  };
  const onDown = (e: PointerEvent) => {
    const target = e.target as Node;
    if (!button.contains(target) && !note?.contains(target)) close(false);
  };
  const onResize = () => close(false);
  // scrolling closes the note only when the "?" it hangs from has moved
  // (incidental scroll events, e.g. late layout, must not close it)
  const onScroll = () => {
    const wanted = pos();
    if (!wanted || !button.isConnected) return close(false);
    if (Math.abs(button.getBoundingClientRect().bottom + 8 - wanted.top) > 2)
      close(false);
  };

  function close(restoreFocus: boolean) {
    if (!open()) return;
    setOpen(false);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
    if (restoreFocus) button?.focus();
  }

  function toggle(e: Event) {
    // the card behind opens details on click
    e.stopPropagation();
    if (open()) return close(true);
    place();
    setOpen(true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    // focus moves into the note, so a screen reader reads it
    queueMicrotask(() => note?.focus({ preventScroll: true }));
  }
  onCleanup(() => close(false));

  return (
    <Wrap
      data-testid="ad-label"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Tag>
        <AdWord />
      </Tag>
      <WhyButton
        ref={button}
        type="button"
        data-testid="ad-why"
        aria-label={t`Why am I seeing this?`}
        aria-expanded={open()}
        aria-controls={noteId}
        onClick={toggle}
      >
        <span aria-hidden="true">?</span>
      </WhyButton>
      <Show when={open() && pos()}>
        <Portal>
          <Note
            ref={note}
            id={noteId}
            data-testid="ad-note"
            role="dialog"
            tabIndex={-1}
            aria-label={t`Why am I seeing this?`}
            style={{ top: `${pos()!.top}px`, left: `${pos()!.left}px` }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Tab leaves the note and goes back to the "?" it belongs to
              if (e.key === "Tab") {
                e.preventDefault();
                close(true);
              }
            }}
          >
            <strong>
              <Trans>Why am I seeing this?</Trans>
            </strong>
            <p>
              <WhyNote kind={props.kind} name={props.name} />
            </p>
          </Note>
        </Portal>
      </Show>
    </Wrap>
  );
}

const Wrap = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "24px",
    borderRadius: "999px",
    _phone: { height: "28px" },
    // solid, so the word reaches AA over any banner artwork
    background: "var(--dz-surface-solid, var(--z-bg-raised))",
    border: "1px solid var(--z-border-strong, var(--dz-edge))",
    color: "var(--z-fg-primary)",
    paddingInlineStart: "8px",
  },
});

const Tag = styled("span", {
  base: { fontSize: "12px", fontWeight: 700, lineHeight: 1 },
});

const WhyButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    _hover: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    // phones: a 44 px tap target (phone rules) on the same small chip
    _phone: { width: "44px", height: "44px", marginBlock: "-8px" },
  },
});

const Note = styled("div", {
  base: {
    position: "fixed",
    // above the details dialog; the theme has no stacking tokens yet
    zIndex: "var(--z-layer-popover, 1000)",
    width: "264px",
    maxWidth: "calc(100vw - 16px)",
    padding: "12px",
    borderRadius: "var(--z-shape-card)",
    background: "var(--z-popover-bg)",
    border: "1px solid var(--z-popover-border)",
    boxShadow: "var(--z-popover-lift)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    lineHeight: "20px",
    outline: "none",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "& p": { margin: "4px 0 0", color: "var(--z-fg-secondary)" },
  },
});
