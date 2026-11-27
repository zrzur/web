import { Match, Show, Switch, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { LineTabs } from "@revolt/ui";
import { ProfilePreview } from "@revolt/ui/components/features/profiles/frames/ProfilePreview";
import type { UserStyle } from "@revolt/ui/components/features/profiles/userStyle";

import { StyleCard } from "./Looks";
import { ChatLine, ChatScene, ListMember, MembersScene } from "./Scenes";
import type { Place } from "./gallery";

type View = Place | "all";

/**
 * A style in the places people will see it: the profile, a conversation and
 * a member list, drawn as they really are. The same picture everywhere in
 * Designs.
 *
 * `place` opens the view where the design in hand is seen best, and follows
 * it as it changes; with `whole`, nothing in hand shows everything at once.
 */
export function Mirror(props: {
  style: UserStyle;
  label?: string;
  place?: Place;
  whole?: boolean;
  /** the profile card at the size a server shows it, never shrunk */
  fullSize?: boolean;
}) {
  const { t } = useLingui();
  const client = useClient();
  const start = (): View => props.place ?? (props.whole ? "all" : "profile");
  const [view, setView] = createSignal<View>(start());
  // a new design in hand: the view goes where it is seen
  createEffect(on(start, setView, { defer: true }));

  const options = () => [
    ...(props.whole ? [{ value: "all" as View, label: t`Everything` }] : []),
    { value: "profile" as View, label: t`Profile` },
    { value: "chat" as View, label: t`Chat` },
    { value: "members" as View, label: t`Members` },
  ];

  const profile = () => (
    // signed in: your own profile card as people see it, wearing what you
    // try on (a frame shows whole round it); a visitor sees the sample card
    <Show
      when={client().user}
      fallback={<StyleCard style={props.style} feature />}
    >
      {(me) => (
        <ProfilePreview
          user={me()}
          style={props.style}
          minScale={props.fullSize ? 1 : undefined}
        />
      )}
    </Show>
  );

  return (
    <Base>
      <LineTabs
        ruled
        aria-label={props.label ?? t`Where to preview`}
        value={view()}
        onChange={setView}
        options={options()}
      />
      <Switch>
        <Match when={view() === "all"}>
          <Whole>
            <Well data-flush>{profile()}</Well>
            <Caption>
              <Trans>In a chat</Trans>
            </Caption>
            <Well data-tight>
              <ChatLine style={props.style}>
                {t`Count me in. Give me ten minutes.`}
              </ChatLine>
            </Well>
            <Caption>
              <Trans>In the member list</Trans>
            </Caption>
            <Well data-tight>
              <ListMember style={props.style} />
            </Well>
          </Whole>
        </Match>
        <Match when={view() === "profile"}>
          <Well data-flush>{profile()}</Well>
        </Match>
        <Match when={view() === "chat"}>
          <Well>
            <ChatScene style={props.style} />
          </Well>
        </Match>
        <Match when={view() === "members"}>
          <Well data-fit>
            <MembersScene style={props.style} />
          </Well>
        </Match>
      </Switch>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});

const Whole = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
});

/** the name of a place, small, over its picture */
const Caption = styled("span", {
  base: {
    marginTop: "8px",
    paddingInline: "2px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

/** where a place is drawn: the ground of the app, nothing round it */
const Well = styled("div", {
  base: {
    minWidth: 0,
    minHeight: "240px",
    padding: "8px",
    borderRadius: "var(--z-shape-card, 12px)",
    background: "var(--z-designs-art-ground)",
    "&[data-flush]": { padding: 0, background: "transparent" },
    "&[data-tight]": { minHeight: 0, padding: "4px 8px" },
    "&[data-fit]": { minHeight: 0 },
  },
});
