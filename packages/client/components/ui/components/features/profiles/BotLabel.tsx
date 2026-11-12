import { Trans, useLingui } from "@lingui/solid/macro";

import { Show } from "solid-js";

import { Icon } from "@revolt/ui/icons/Icon";

import { BadgeTag, BadgeTextTip } from "./badges/BadgeMark";

/**
 * Shared bot identity label in profiles, messages and member lists.
 * `official` is a bot Zrzur runs itself, a different thing from an official
 * account: people use it like any bot. `verified` is a bot Trust & Safety
 * verified: a check mark inside the label, and hover, focus or a tap explain
 * it. This label is the only verified mark next to a bot's name (owner,
 * 2026-11-12: no second seal beside it).
 */
export function BotLabel(props: { official?: boolean; verified?: boolean }) {
  const { t } = useLingui();
  const spoken = () =>
    `${t`Verified bot`}: ${t`The Zrzur team reviewed this bot.`}`;

  return (
    <Show
      when={props.official}
      fallback={
        <Show
          when={props.verified}
          fallback={
            <BadgeTag filled>
              <Trans>Bot</Trans>
            </BadgeTag>
          }
        >
          <span
            data-verified-bot
            tabindex="0"
            role="group"
            aria-label={spoken()}
            style={{ display: "inline-flex", cursor: "default" }}
            use:floating={{
              tooltip: {
                placement: "top",
                press: true,
                aria: spoken(),
                content: () => <BadgeTextTip id="bot_verified" />,
              },
            }}
          >
            <BadgeTag filled icon={<Icon name="check" size={11} />}>
              <Trans>Bot</Trans>
            </BadgeTag>
          </span>
        </Show>
      }
    >
      <BadgeTag filled icon={<Icon name="shield-check" size={11} />}>
        <Trans>Official bot</Trans>
      </BadgeTag>
    </Show>
  );
}
