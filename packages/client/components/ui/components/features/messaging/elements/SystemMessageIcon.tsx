import { Match, Switch } from "solid-js";

import { SystemMessage } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useTime } from "@revolt/i18n";
import { Tooltip } from "@revolt/ui/components/floating";
import { Time, formatTime } from "@revolt/ui/components/utils";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * System Message Icon
 */
export function SystemMessageIcon(props: {
  createdAt: Date;
  isServer: boolean;
  systemMessage: SystemMessage;
}) {
  const dayjs = useTime();

  return (
    <Base type={props.systemMessage.type}>
      <Tooltip
        content={() => <Time format="relative" value={props.createdAt} />}
        aria={
          formatTime(dayjs, {
            format: "relative",
            value: props.createdAt,
          }) as string
        }
        placement="top"
      >
        <Switch fallback={<Icon name="info" size={16} filled />}>
          <Match when={props.systemMessage.type === "user_added"}>
            <Icon name="plus" size={16} />
          </Match>
          <Match
            when={props.systemMessage.type === "user_left" && !props.isServer}
          >
            <Icon name="minus" size={16} />
          </Match>
          <Match when={props.systemMessage.type === "user_remove"}>
            <Icon name="x" size={16} />
          </Match>
          <Match when={props.systemMessage.type === "user_kicked"}>
            <Icon name="x-circle" size={16} filled />
          </Match>
          <Match when={props.systemMessage.type === "user_banned"}>
            <Icon name="warning-octagon" size={16} filled />
          </Match>
          <Match when={props.systemMessage.type === "user_joined"}>
            <Icon name="arrow-right" size={16} />
          </Match>
          <Match
            when={props.systemMessage.type === "user_left" && props.isServer}
          >
            <Icon name="arrow-left" size={16} />
          </Match>
          <Match when={props.systemMessage.type === "channel_renamed"}>
            <Icon name="hash" size={16} />
          </Match>
          <Match
            when={props.systemMessage.type === "channel_description_changed"}
          >
            <Icon name="list" size={16} />
          </Match>
          <Match when={props.systemMessage.type === "channel_icon_changed"}>
            <Icon name="image" size={16} filled />
          </Match>
          <Match
            when={props.systemMessage.type === "channel_ownership_changed"}
          >
            <Icon name="key" size={16} filled />
          </Match>
          <Match
            when={
              props.systemMessage.type === "message_pinned" ||
              props.systemMessage.type === "message_unpinned"
            }
          >
            <Icon name="push-pin" size={16} />
          </Match>
          <Match when={props.systemMessage.type === "call_started"}>
            <Icon name="phone" size={16} />
          </Match>
          <Match when={props.systemMessage.type === "raid_alert"}>
            <Icon name="warning-circle" size={16} />
          </Match>
          <Match when={props.systemMessage.type === "automod_alert"}>
            <Icon name="shield-check" size={16} />
          </Match>
        </Switch>
      </Tooltip>
    </Base>
  );
}

const Base = styled("div", {
  base: {
    width: "62px",
    display: "grid",
    placeItems: "center",
  },
  variants: {
    type: {
      user_added: {
        color: "var(--md-sys-color-primary)",
      },
      user_joined: {
        color: "var(--md-sys-color-primary)",
      },
      channel_ownership_changed: {
        color: "var(--md-sys-color-primary)",
      },
      user_left: {
        color: "var(--md-sys-color-error)",
      },
      user_kicked: {
        color: "var(--md-sys-color-error)",
      },
      user_banned: {
        color: "var(--md-sys-color-error)",
      },
      text: {
        color: "var(--md-sys-color-primary)",
      },
      user_remove: {
        color: "var(--md-sys-color-primary)",
      },
      channel_renamed: {
        color: "var(--md-sys-color-primary)",
      },
      channel_description_changed: {
        color: "var(--md-sys-color-primary)",
      },
      channel_icon_changed: {
        color: "var(--md-sys-color-primary)",
      },
      message_pinned: {
        color: "var(--md-sys-color-primary)",
      },
      message_unpinned: {
        color: "var(--md-sys-color-primary)",
      },
      call_started: {
        color: "var(--md-sys-color-primary)",
      },
      raid_alert: {
        color: "var(--z-warning, var(--md-sys-color-primary))",
      },
      automod_alert: {
        color: "var(--z-warning, var(--md-sys-color-primary))",
      },
    },
  },
});
