import { JSX, Show } from "solid-js";

import { styled } from "styled-system/jsx";

/**
 * The controller face has a mood for each kind of empty place (design
 * direction §6). Files are the delivered expressions, unchanged; the mask
 * paints them white on dark surfaces and ink on light ones.
 */
const moods: Record<EmptyArt, string> = {
  friends: "relaxed",
  online: "sleepy",
  pending: "look-up",
  blocked: "focused",
  chats: "cheerful",
  communities: "excited",
  search: "look-down",
};

export type EmptyArt =
  | "friends"
  | "online"
  | "pending"
  | "blocked"
  | "chats"
  | "communities"
  | "search";

/**
 * Calm empty state: the mood, one line of context, one action
 */
export function EmptyState(props: {
  art: EmptyArt;
  title: JSX.Element;
  description?: JSX.Element;
  action?: JSX.Element;
  compact?: boolean;
  /** @deprecated every empty state now shows the same small mood */
  minimalArt?: boolean;
}) {
  return (
    <Base data-empty-state data-compact={props.compact}>
      <Mood
        aria-hidden="true"
        data-mood={moods[props.art]}
        style={{
          "--mood": `url("${import.meta.env.BASE_URL}brand/moods/${moods[props.art]}.svg")`,
        }}
      />
      <Title>{props.title}</Title>
      <Show when={props.description}>
        <Description>{props.description}</Description>
      </Show>
      <Show when={props.action}>
        <Action>{props.action}</Action>
      </Show>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "4px",
    padding: "40px 24px",
    marginInline: "auto",
    maxWidth: "420px",

    "&[data-compact='true']": { padding: "24px 12px" },
  },
});

const Mood = styled("span", {
  base: {
    width: "64px",
    height: "64px",
    marginBlockEnd: "12px",
    background: "var(--z-header-primary)",
    maskImage: "var(--mood)",
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
  },
});

const Action = styled("div", {
  base: { marginBlockStart: "12px" },
});

const Title = styled("div", {
  base: {
    fontSize: "15px",
    lineHeight: "24px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const Description = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});
