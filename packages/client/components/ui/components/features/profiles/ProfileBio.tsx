import { Show, createSignal, onCleanup } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Markdown } from "@revolt/markdown";

import { ProfileSection } from "./ProfileCard";

/**
 * About me. A long text is clipped to a few lines, on the card and the full
 * profile, with Show more to open it where it is and Show less to close it.
 */
export function ProfileBio(props: { content?: string; full?: boolean }) {
  const [open, setOpen] = createSignal(false);
  const [long, setLong] = createSignal(false);

  function measure(element: HTMLDivElement) {
    const observer = new ResizeObserver(() =>
      setLong((was) => was || element.scrollHeight > element.clientHeight + 1),
    );
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  }

  return (
    <Show when={props.content}>
      <ProfileSection title={<Trans>About me</Trans>}>
        <Bio
          ref={measure}
          data-clamped={!open() || undefined}
          data-long={long() || undefined}
          dir="auto"
        >
          <Markdown content={props.content} />
        </Bio>
        <Show when={long()}>
          <More
            type="button"
            aria-expanded={open()}
            onClick={() => setOpen(!open())}
          >
            <Show when={open()} fallback={<Trans>Show more</Trans>}>
              <Trans>Show less</Trans>
            </Show>
          </More>
        </Show>
      </ProfileSection>
    </Show>
  );
}

const Bio = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    overflowWrap: "anywhere",
    userSelect: "text",

    "& p": { margin: 0 },
    "& a": { textDecoration: "underline" },

    "&[data-clamped]": {
      // four lines
      maxHeight: "80px",
      overflow: "hidden",
      "&[data-long]": {
        maskImage: "linear-gradient(to bottom, black 75%, transparent)",
      },
    },
  },
});

const More = styled("button", {
  base: {
    alignSelf: "flex-start",
    minHeight: "24px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--profile-ink, var(--z-fg-primary))",
    cursor: "pointer",
    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
      borderRadius: "4px",
    },
    _phone: { minHeight: "44px" },
  },
});
