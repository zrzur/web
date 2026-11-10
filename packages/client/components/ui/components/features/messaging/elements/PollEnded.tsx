import { Match, Switch } from "solid-js";

import { i18n } from "@lingui/core";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/solid/macro";
import type { PollEndedSystemMessage } from "@zrzur/sdk/solid";

/**
 * The reply posted when a poll closes: the winning answer and its votes, a
 * tie, or that nobody voted
 */
export function PollEnded(props: { message: PollEndedSystemMessage }) {
  const { t } = useLingui();

  const question = () => props.message.question;
  const winners = () => props.message.winners;
  // the answers named in the reader's language ("A and B", «A و B»)
  const tied = () =>
    new Intl.ListFormat(i18n.locale, { type: "conjunction" }).format(
      winners().map((winner) => `“${winner}”`),
    );
  const total = () =>
    t`${plural(props.message.total, { one: "# vote", other: "# votes" })}`;

  return (
    <span data-testid="poll-ended">
      <Switch>
        <Match when={winners().length === 0}>
          {t`The poll “${question()}” ended with no votes.`}
        </Match>
        <Match when={winners().length === 1}>
          {t`The poll “${question()}” ended: “${winners()[0]}” won with ${props.message.votes} of ${total()}.`}
        </Match>
        <Match when={winners().length > 1}>
          {t`The poll “${question()}” ended in a tie: ${tied()}.`}
        </Match>
      </Switch>
    </span>
  );
}
