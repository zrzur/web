import { Show, createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { User } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";

import { useClient } from "@revolt/client";

import { ActivityArt } from "./ActivityArt";
import { type Activity, ownPicture, shownActivities } from "./activityText";

/** "Playing Star Kebab", in the reader's language */
export function useActivityLabel() {
  const { t } = useLingui();
  return (activity: Activity) => {
    const name = activity.name;
    switch (activity.type) {
      case "Listening":
        return t`Listening to ${name}`;
      case "Watching":
        return t`Watching ${name}`;
      case "Streaming":
        return t`Streaming ${name}`;
      case "Competing":
        return t`Competing in ${name}`;
      case "Using":
        return t`Using ${name}`;
      default:
        return t`Playing ${name}`;
    }
  };
}

/** What someone is doing, as one word over the name: "Playing", "Using" */
export function useActivityKind() {
  const { t } = useLingui();
  return (activity: Activity) => {
    switch (activity.type) {
      case "Listening":
        return t({ message: "Listening", context: "activity" });
      case "Watching":
        return t({ message: "Watching", context: "activity" });
      case "Streaming":
        return t({ message: "Streaming", context: "activity" });
      case "Competing":
        return t({ message: "Competing", context: "activity" });
      case "Using":
        return t({ message: "Using", context: "activity" });
      default:
        return t({ message: "Playing", context: "activity" });
    }
  };
}

/** The main activity of a user, if they have one to show */
export function mainActivity(user: User | undefined): Activity | undefined {
  return shownActivities(user?.activities as Activity[] | undefined)[0];
}

/**
 * Loaded by `ActivityLine` the first time someone has an activity to show.
 * One line under a name in the member list and the DM list: the game's or
 * app's own small picture (a letter tile without one) and "Playing <name>".
 * Nothing when there is no activity.
 */
export default function ActivityLineBody(props: {
  user?: User;
  class?: string;
}) {
  const label = useActivityLabel();
  const client = useClient();
  const activity = createMemo(() => mainActivity(props.user));
  const picture = (a: Activity) => {
    const features = client()?.configuration?.features;
    const hosts = [
      features?.january?.enabled ? features.january.url : undefined,
      features?.autumn?.url,
    ];
    return ownPicture(a.large_image, hosts) ?? ownPicture(a.small_image, hosts);
  };

  return (
    <Show when={activity()}>
      {(a) => (
        <span
          class={`${line()} ${props.class ?? ""}`}
          data-testid="activity-line"
          title={label(a())}
        >
          <ActivityArt size="line" name={a().name} src={picture(a())} />
          <span class={text()} dir="auto">
            {label(a())}
          </span>
        </span>
      )}
    </Show>
  );
}

const line = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
    "& > :first-child": { flexShrink: 0 },
  },
});

const text = cva({
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
