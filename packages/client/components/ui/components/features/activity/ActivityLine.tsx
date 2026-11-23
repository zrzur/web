import { Show, createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { User } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";

import { Symbol } from "../../utils/Symbol";

import { type Activity, activityIcon, shownActivities } from "./activityText";

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

/** The main activity of a user, if they have one to show */
export function mainActivity(user: User | undefined): Activity | undefined {
  return shownActivities(user?.activities as Activity[] | undefined)[0];
}

/**
 * One line under a name in the member list and the DM list: an icon and
 * "Playing <name>". Nothing when there is no activity.
 */
export function ActivityLine(props: { user?: User; class?: string }) {
  const label = useActivityLabel();
  const activity = createMemo(() => mainActivity(props.user));

  return (
    <Show when={activity()}>
      {(a) => (
        <span
          class={`${line()} ${props.class ?? ""}`}
          data-testid="activity-line"
          title={label(a())}
        >
          <Symbol size={14} aria-hidden="true">
            {activityIcon(a().type)}
          </Symbol>
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
    gap: "4px",
    minWidth: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-fg-muted)",
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
