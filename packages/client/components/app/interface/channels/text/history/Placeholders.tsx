import { For, createSignal, onCleanup, onMount } from "solid-js";

import { styled } from "styled-system/jsx";

import { Column, Row } from "@revolt/ui/components/layout";

import type { PageSide } from "./reader";

/** Rows that are on their way */
export function Placeholders(props: {
  align: "start" | "end";
  side: PageSide;
}) {
  let ref: HTMLDivElement | undefined;

  // The shimmer runs only while the placeholders are on screen. Most of the
  // time they sit out of sight above the messages, where their animations
  // still cost about a quarter of a processor core.
  const [onScreen, setOnScreen] = createSignal(
    typeof IntersectionObserver === "undefined",
  );
  onMount(() => {
    if (!ref || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => entry && setOnScreen(entry.isIntersecting),
    );
    observer.observe(ref);
    onCleanup(() => observer.disconnect());
  });

  return (
    <PlaceholderColumn
      ref={ref}
      align={props.align}
      data-history-skeleton={props.side}
      aria-hidden="true"
      style={{ "--skeleton-shimmer": onScreen() ? "running" : "paused" }}
    >
      <For each={new Array(30).fill(0)}>
        {() => (
          <Column gap="none">
            <Row>
              <AvatarFrame>
                <Frame shape="avatar" />
              </AvatarFrame>
              <Column gap="sm">
                <Frame
                  shape="username"
                  style={{
                    width: `${Math.floor(Math.random() * 5 + 5)}em`,
                  }}
                />
                <For each={new Array(Math.ceil(Math.random() * 3)).fill(0)}>
                  {() => (
                    <Frame
                      shape="content"
                      style={{
                        width: `${Math.floor(Math.random() * 10 + 15)}em`,
                      }}
                    />
                  )}
                </For>
              </Column>
            </Row>
          </Column>
        )}
      </For>
    </PlaceholderColumn>
  );
}

const PlaceholderColumn = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--message-group-spacing)",

    height: "100rem",
    overflow: "hidden",
    pointerEvents: "none",
  },
  variants: {
    align: {
      start: {
        justifyContent: "start",
      },
      end: {
        justifyContent: "end",
      },
    },
  },
});

const AvatarFrame = styled("div", {
  base: {
    width: "52px",
    alignSelf: "start",

    display: "flex",
    justifyContent: "end",
    paddingInline: "var(--gap-sm)",
  },
});

const Frame = styled("div", {
  base: {
    background:
      "linear-gradient(90deg, var(--md-sys-color-surface-container-highest) 25%, var(--md-sys-color-surface-container-high) 50%, var(--md-sys-color-surface-container-highest) 75%)",
    backgroundSize: "200% 100%",
    backgroundAttachment: "fixed",
    animation: "skeletonShimmer 1.5s infinite",
    animationPlayState: "var(--skeleton-shimmer, running)",
  },
  variants: {
    shape: {
      avatar: {
        width: "36px",
        height: "36px",
        borderRadius: "var(--borderRadius-full)",
      },
      username: {
        height: "0.8em",
        borderRadius: "var(--borderRadius-sm)",
      },
      content: {
        height: "var(--message-size)",
        marginTop: "var(--gap-sm)",
        borderRadius: "var(--borderRadius-sm)",
      },
    },
  },
});
