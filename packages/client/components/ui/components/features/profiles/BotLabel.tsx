import { Trans, useLingui } from "@lingui/solid/macro";

import { Show } from "solid-js";

import { Icon } from "@revolt/ui/icons/Icon";

import { BadgeTag } from "./badges/BadgeMark";

/**
 * Shared bot identity label in profiles, messages and member lists.
 * `official` is a bot Zrzur runs itself, a different thing from an official
 * account: people use it like any bot. `verified` is a bot Trust & Safety
 * verified: a check mark inside the label, named for screen readers.
 */
export function BotLabel(props: { official?: boolean; verified?: boolean }) {
  const { t } = useLingui();

  return (
    <Show
      when={props.official}
      fallback={
        <BadgeTag
          icon={
            props.verified ? (
              <span
                role="img"
                aria-label={t`Verified bot`}
                title={t`Verified bot`}
                data-verified-bot
                style={{ display: "inline-flex" }}
              >
                <Icon name="seal-check" size={12} />
              </span>
            ) : undefined
          }
        >
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
