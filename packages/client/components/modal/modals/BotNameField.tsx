import { IFormControl } from "solid-forms";
import { Show } from "solid-js";

import { styled } from "styled-system/jsx";

import { Trans, useLingui } from "@lingui/solid/macro";
import { TranslatedError, errorDetails } from "@revolt/i18n/errors";
import { Form2 } from "@revolt/ui";

import {
  BOT_NAME_MAX,
  BOT_NAME_MIN,
  BotNameProblem,
  botNameProblem,
  isBotNameFormatError,
} from "./botName";

/** The rule and the problem with a typed name, in the reader's language */
export function useBotNameText() {
  const { t } = useLingui();
  const min = BOT_NAME_MIN;
  const max = BOT_NAME_MAX;
  const rule = () => t`Letters, numbers, spaces between words, and _ . -`;
  const problem = (kind: BotNameProblem | undefined) => {
    switch (kind) {
      case "length":
        return t`Between ${min} and ${max} characters.`;
      case "space":
        return t`One space between words, and none at the start or end.`;
      case "character":
        return t`Use letters, numbers, spaces and _ . - only.`;
      default:
        return undefined;
    }
  };
  return { rule, problem };
}

/**
 * The bot's name, with its rule under it and what is wrong shown as the
 * person types; refused by the server, the error shows here too, in plain
 * words with the technical part under Details
 */
export function BotNameField(props: {
  control: IFormControl<string>;
  error?: unknown;
}) {
  const { t } = useLingui();
  const text = useBotNameText();
  const problem = () => botNameProblem(props.control.value);

  return (
    <div data-bot-name>
      <Form2.TextField
        minlength={BOT_NAME_MIN}
        maxlength={BOT_NAME_MAX}
        counter
        name="name"
        control={props.control}
        label={t`Bot name`}
        aria-describedby="bot-name-hint"
      />
      <Show
        when={problem()}
        fallback={
          <Hint id="bot-name-hint" data-bot-name-hint>
            {text.rule()}
          </Hint>
        }
      >
        <Problem id="bot-name-hint" role="alert" data-bot-name-problem>
          {text.problem(problem())}
        </Problem>
      </Show>
      <Show when={props.error}>
        <Problem role="alert" data-bot-name-error>
          <Show
            when={isBotNameFormatError(props.error)}
            fallback={<TranslatedError error={props.error} />}
          >
            {text.problem("character")} {text.rule()}
            <Show when={errorDetails(props.error)}>
              <details class="z-error-details">
                <summary>
                  <Trans>Details</Trans>
                </summary>
                <code>{errorDetails(props.error)}</code>
              </details>
            </Show>
          </Show>
        </Problem>
      </Show>
    </div>
  );
}

/** A name problem stops the form (Create stays off) */
export const botNameBlocks = (name: string) => !!botNameProblem(name);

const Hint = styled("p", {
  base: {
    margin: 0,
    marginTop: "6px",
    fontSize: "13px",
    lineHeight: 1.4,
    color: "var(--z-fg-muted)",
  },
});

const Problem = styled("div", {
  base: {
    marginTop: "6px",
    fontSize: "13px",
    lineHeight: 1.4,
    color: "var(--z-danger)",
    "& .z-error-details": { color: "var(--z-fg-muted)", marginTop: "4px" },
  },
});
