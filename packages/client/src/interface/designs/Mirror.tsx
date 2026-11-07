import { Match, Switch, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Segmented } from "@revolt/ui";
import type { UserStyle } from "@revolt/ui/components/features/profiles/userStyle";

import { StyleCard } from "./Looks";
import { ChatScene, MembersScene } from "./Scenes";

type Place = "profile" | "chat" | "members";

/**
 * A style in the three places people will see it: the profile, a
 * conversation and a member list. The same picture everywhere in Designs.
 */
export function Mirror(props: { style: UserStyle; label?: string }) {
  const { t } = useLingui();
  const [place, setPlace] = createSignal<Place>("profile");
  return (
    <Base>
      <Segmented
        aria-label={props.label ?? t`Where to preview`}
        value={place()}
        onChange={setPlace}
        options={[
          { value: "profile", label: t`Profile` },
          { value: "chat", label: t`Chat` },
          { value: "members", label: t`Members` },
        ]}
      />
      <Well>
        <Switch>
          <Match when={place() === "profile"}>
            <StyleCard style={props.style} feature />
          </Match>
          <Match when={place() === "chat"}>
            <ChatScene style={props.style} />
          </Match>
          <Match when={place() === "members"}>
            <MembersScene style={props.style} />
          </Match>
        </Switch>
      </Well>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    "& [role='radiogroup']": {
      display: "flex",
      "& > button": { flex: "1 1 0", minWidth: 0 },
      _phone: { "& > button": { height: "44px" } },
    },
  },
});

const Well = styled("div", {
  base: {
    minWidth: 0,
    minHeight: "280px",
    padding: "8px",
    borderRadius: "var(--z-shape-card, 14px)",
    background: "var(--z-designs-art-ground)",
  },
});
