import { Trans, useLingui } from "@lingui/solid/macro";
import { Bot, withoutNull } from "@zrzur/sdk/solid";
import { createResource, createSignal, Match, Show, Switch } from "solid-js";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import {
  Button,
  Column,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";

type VerificationState = {
  verified: boolean;
  request?: {
    status: "Pending" | "Approved" | "Denied" | "Revoked";
    intents?: number;
    created_at: number;
    decision_note?: string;
  };
  can_apply_at?: number;
};

const Refused = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-danger)",
    fontSize: "13px",
    lineHeight: "20px",
  },
});

const STATEMENT_MIN = 20;
const STATEMENT_MAX = 1000;
const HTTPS_LINK = /^https:\/\/[^\s/]+\S*$/;

/**
 * Ask Zrzur to verify a bot, and see where the request stands. Unverified
 * bots stop at 100 servers, and past 100 servers privileged intents stay on
 * only once they are approved: the request asks for the privileged intents
 * switched on above. A reviewer decides in the admin console.
 */
export function BotVerification(props: { bot: Bot; intents: number }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const [state, { mutate }] = createResource(() =>
    client().api.get(`/bots/${props.bot.id}/verification`).then(withoutNull),
  );
  const [statement, setStatement] = createSignal("");
  const [website, setWebsite] = createSignal("");
  const [support, setSupport] = createSignal("");
  const [privacy, setPrivacy] = createSignal(props.bot.privacyPolicyUrl ?? "");
  const [terms, setTerms] = createSignal(props.bot.termsOfServiceUrl ?? "");
  const [badLinks, setBadLinks] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const date = (ms: number) => new Date(ms).toLocaleDateString();
  const canApply = () => {
    const s = state();
    return (
      !!s && !s.verified && s.request?.status !== "Pending" && !s.can_apply_at
    );
  };

  async function apply() {
    if (busy()) return;
    const length = statement().trim().length;
    if (length < STATEMENT_MIN || length > STATEMENT_MAX) {
      setError(t`Between ${STATEMENT_MIN} and ${STATEMENT_MAX} characters.`);
      return;
    }
    setError(undefined);
    const linksFine =
      HTTPS_LINK.test(privacy().trim()) && HTTPS_LINK.test(terms().trim());
    setBadLinks(!linksFine);
    if (!linksFine) return;
    setBusy(true);
    const request = {
      statement: statement().trim(),
      website: website().trim() || undefined,
      support: support().trim() || undefined,
      privacy_policy_url: privacy().trim(),
      terms_of_service_url: terms().trim(),
      intents: props.intents,
    };
    try {
      mutate(
        await client()
          .api.post(`/bots/${props.bot.id}/verification`, request)
          .then(withoutNull),
      );
      setStatement("");
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title={<Trans>Verification</Trans>}
      description={
        <Trans>
          Verified bots show a mark next to their name and can join more than
          100 servers. Past 100 servers, privileged intents stay on only once
          they are approved.
        </Trans>
      }
    >
      <Show when={state()}>
        {(s) => (
          <Column gap="md">
            <Switch>
              <Match when={s().verified}>
                <SettingsRow
                  icon={<Icon name="seal-check" size={20} />}
                  title={<Trans>Verified</Trans>}
                  description={
                    <Trans>This bot can join any number of servers.</Trans>
                  }
                />
              </Match>
              <Match when={s().request?.status === "Pending"}>
                <SettingsRow
                  icon={<Icon name="hourglass" size={20} />}
                  title={<Trans>Request sent</Trans>}
                  description={
                    <Trans>
                      Your request from {date(s().request!.created_at)} is
                      waiting for review.
                    </Trans>
                  }
                />
              </Match>
              <Match
                when={
                  s().request?.status === "Denied" ||
                  s().request?.status === "Revoked"
                }
              >
                <SettingsRow
                  icon={<Icon name="x-circle" size={20} />}
                  title={
                    s().request?.status === "Denied" ? (
                      <Trans>Request declined</Trans>
                    ) : (
                      <Trans>The verified mark was removed</Trans>
                    )
                  }
                  description={
                    <span dir="auto">
                      {s().request?.decision_note ??
                        (s().can_apply_at ? (
                          <Trans>
                            You can apply again on {date(s().can_apply_at!)}.
                          </Trans>
                        ) : (
                          <Trans>
                            You can send a new request with more detail.
                          </Trans>
                        ))}
                    </span>
                  }
                />
              </Match>
            </Switch>

            <Show when={canApply()}>
              <SettingsFormPanel>
                <TextField
                  label={t`What does your bot do, who uses it, and what data does it keep?`}
                  rows={4}
                  maxlength={STATEMENT_MAX}
                  counter
                  dir="auto"
                  value={statement()}
                  onInput={(e) => setStatement(e.currentTarget.value)}
                />
                <TextField
                  label={t`Website or documentation (https://…)`}
                  value={website()}
                  maxlength={200}
                  dir="ltr"
                  onInput={(e) => setWebsite(e.currentTarget.value)}
                />
                <TextField
                  label={t`Where users get help (https://…)`}
                  value={support()}
                  maxlength={200}
                  dir="ltr"
                  onInput={(e) => setSupport(e.currentTarget.value)}
                />
                <TextField
                  label={t`Privacy policy (https://…)`}
                  value={privacy()}
                  maxlength={200}
                  dir="ltr"
                  required
                  onInput={(e) => setPrivacy(e.currentTarget.value)}
                  error={
                    badLinks() && !HTTPS_LINK.test(privacy().trim())
                      ? t`Link to the bot's privacy policy, starting with https://.`
                      : undefined
                  }
                />
                <TextField
                  label={t`Terms of service (https://…)`}
                  value={terms()}
                  maxlength={200}
                  dir="ltr"
                  required
                  onInput={(e) => setTerms(e.currentTarget.value)}
                  error={
                    badLinks() && !HTTPS_LINK.test(terms().trim())
                      ? t`Link to the bot's terms of service, starting with https://.`
                      : undefined
                  }
                />
                {/* beside the button: the form is taller than a phone */}
                <Show when={error()}>
                  <Refused role="alert">{error()}</Refused>
                </Show>
                <div>
                  <Button isDisabled={busy()} onPress={() => void apply()}>
                    <Trans>Apply for verification</Trans>
                  </Button>
                </div>
              </SettingsFormPanel>
            </Show>
          </Column>
        )}
      </Show>
    </SettingsSection>
  );
}
