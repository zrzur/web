import { Trans } from "@lingui/solid/macro";

import { Show } from "solid-js";

import { Icon } from "@revolt/ui/icons/Icon";

import { BadgeTag } from "./badges/BadgeMark";

/**
 * Shared bot identity label in profiles, messages and member lists.
 * `official` is a bot Zrzur runs itself, a different thing from an official
 * account: people use it like any bot.
 */
export function BotLabel(props: { official?: boolean }) {
  return (
    <Show
      when={props.official}
      fallback={
        <BadgeTag>
          <Trans>Bot</Trans>
        </BadgeTag>
      }
    >
      <BadgeTag icon={<Icon name="shield-check" size={12} />}>
        <Trans>Official bot</Trans>
      </BadgeTag>
    </Show>
  );
}
