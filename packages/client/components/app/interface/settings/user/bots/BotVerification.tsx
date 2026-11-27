import { Trans, useLingui } from "@lingui/solid/macro";
import { Bot, withoutNull } from "@zrzur/sdk/solid";
import { createResource, createSignal, Match, Show, Switch } from "solid-js";

import { useClient } from "@revolt/client";
import { resourceValue } from "@revolt/common/lib/resource";
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

import { ProgramChecklist } from "../badges/ProgramChecklist";
import { failureCode } from "../badges/programsApi";
import { useProgramText } from "../badges/useProgramText";
import { useDate } from "../profile/CommunityParts";
import { PRIVILEGED_INTENTS } from "./PrivilegedIntents";
import { charCount, isHttpsLink } from "./verificationLinks";

/** The server's limits (DataBotVerification) */
const STATEMENT_MIN = 20;
const STATEMENT_MAX = 1000;
const LINK_MAX = 200;

/** Lines of the checklist that stop a request: only the owner's own */
const BLOCKING = ["owner", "bot_active", "email", "adult"];

/**
 * Ask Zrzur to verify a bot, and see where the request stands. Any bot may
 * ask, whatever its size (owner, 2026-11-27); the checklist shows what the
 * team will look at, and only the owner's own lines (a confirmed e-mail,
 * 18 or older) stop the request. Unverified bots stop at 100 servers, and
 * past 100 servers privileged intents stay on only once they are approved:
 * the request asks for the ones switched on in the Bot tab.
 *
 * `intents` is undefined while the saved intents are still loading.
 */
export function BotVerification(props: { bot: Bot; intents?: number }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const words = useProgramText();
  const date = useDate();

  const [state, { mutate, refetch }] = createResource(() =>
    client().api.get(`/bots/${props.bot.id}/verification`).then(withoutNull),
  );
  const [statement, setStatement] = createSignal("");
  const [website, setWebsite] = createSignal("");
  const [support, setSupport] = createSignal("");
  const [privacy, setPrivacy] = createSignal(props.bot.privacyPolicyUrl ?? "");
  const [terms, setTerms] = createSignal(props.bot.termsOfServiceUrl ?? "");
  const [checked, setChecked] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const names = () =>
    [
      [PRIVILEGED_INTENTS.messageContent, t`Message content`],
      [PRIVILEGED_INTENTS.serverMembers, t`Server members`],
      [PRIVILEGED_INTENTS.presence, t`Presence`],
    ] as const;
  /** names of the privileged intents in a mask */
  const intentNames = (mask: number) =>
    names()
      .filter(([bit]) => (mask & bit) !== 0)
      .map(([, name]) => name)
      .join(", ");

  /** what the team looks at, sent with the state (an older server sends none) */
  const checks = () => resourceValue(state)?.checks ?? [];
  const blocked = () =>
    checks().some((line) => BLOCKING.includes(line.code) && line.met === false);
  const canApply = () => {
    const s = resourceValue(state);
    return (
      !!s && !s.verified && s.request?.status !== "Pending" && !s.can_apply_at
    );
  };

  // each field says what is wrong once the first send was tried
  const statementError = () => {
    if (!checked()) return undefined;
    const n = charCount(statement());
    if (n < STATEMENT_MIN)
      return t`Write at least ${STATEMENT_MIN} characters.`;
    if (n > STATEMENT_MAX) return t`At most ${STATEMENT_MAX} characters.`;
    return undefined;
  };
  const linkError = (value: string, required: boolean) => {
    if (!checked()) return undefined;
    if (!value.trim())
      return required ? t`A link starting with https://` : undefined;
    return isHttpsLink(value) ? undefined : t`A link starting with https://`;
  };

  async function apply() {
    if (busy() || props.intents === undefined) return;
    setChecked(true);
    setError(undefined);
    if (
      statementError() ||
      linkError(privacy(), true) ||
      linkError(terms(), true) ||
      linkError(website(), false) ||
      linkError(support(), false)
    )
      return;
    setBusy(true);
    try {
      mutate(
        await client()
          .api.post(`/bots/${props.bot.id}/verification`, {
            statement: statement().trim(),
            website: website().trim() || undefined,
            support: support().trim() || undefined,
            privacy_policy_url: privacy().trim(),
            terms_of_service_url: terms().trim(),
            intents: props.intents,
          })
          .then(withoutNull),
      );
      setStatement("");
      setChecked(false);
    } catch (failure) {
      const code = failureCode(failure);
      // the checklist changed meanwhile: show it as it is now
      if (code?.startsWith("not_eligible:")) void refetch();
      setError(words.failure(code) ?? describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title={<Trans>Verification</Trans>}
      description={
        <Trans>
          Verified bots get a mark next to their name and can join more than 100
          servers. Past 100 servers, privileged intents need approval.
        </Trans>
      }
    >
      <Show
        when={!state.error}
        fallback={
          <SettingsRow
            icon={<Icon name="warning" size={20} />}
            title={<Trans>Couldn't load the verification.</Trans>}
            control={() => (
              <Button size="sm" variant="tonal" onPress={() => void refetch()}>
                <Trans>Try again</Trans>
              </Button>
            )}
          />
        }
      >
        <Show when={resourceValue(state)}>
          {(s) => (
            <Column gap="lg">
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
                      <>
                        <Trans>
                          Sent on {date(s().request!.created_at)}. The team will
                          answer here.
                        </Trans>
                        <Show when={s().request?.intents}>
                          <br />
                          <Trans>
                            Intents asked for:{" "}
                            {intentNames(s().request!.intents ?? 0)}
                          </Trans>
                        </Show>
                      </>
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
                      <>
                        <Show when={s().request?.decision_note}>
                          <q dir="auto">{s().request?.decision_note}</q>
                          <br />
                        </Show>
                        <Show
                          when={s().can_apply_at}
                          fallback={
                            <Trans>
                              You can send a new request with more detail.
                            </Trans>
                          }
                        >
                          <Trans>
                            You can apply again on {date(s().can_apply_at)}.
                          </Trans>
                        </Show>
                      </>
                    }
                  />
                </Match>
              </Switch>

              <Show when={canApply()}>
                {/* what the team looks at; only your own lines stop you */}
                <Show when={checks().length}>
                  <ChecklistBox>
                    <Heading>
                      <Trans>What the team looks at</Trans>
                    </Heading>
                    <ProgramChecklist
                      program="verified_bot"
                      eligibility={{
                        program: "verified_bot",
                        target_id: props.bot.id,
                        checks: checks().map((line) => ({
                          code: line.code,
                          met: line.met ?? undefined,
                          value: line.value ?? undefined,
                          needed: line.needed ?? undefined,
                        })),
                        can_apply: !blocked(),
                      }}
                    />
                  </ChecklistBox>
                </Show>

                <SettingsRow
                  icon={<Icon name="shield-check" size={20} />}
                  title={<Trans>Privileged intents in this request</Trans>}
                  description={
                    props.intents === undefined
                      ? t`Loading…`
                      : intentNames(props.intents) ||
                        t`None. Turn them on in the Bot tab first if your bot needs them.`
                  }
                />

                <SettingsFormPanel>
                  <TextField
                    label={t`About your bot`}
                    placeholder={t`What it does, who uses it, and what data it keeps`}
                    rows={4}
                    maxlength={STATEMENT_MAX}
                    counter
                    dir="auto"
                    value={statement()}
                    onInput={(e) => setStatement(e.currentTarget.value)}
                    error={statementError()}
                  />
                  <Pair>
                    <TextField
                      label={t`Privacy policy`}
                      placeholder="https://"
                      value={privacy()}
                      maxlength={LINK_MAX}
                      dir="ltr"
                      required
                      onInput={(e) => setPrivacy(e.currentTarget.value)}
                      error={linkError(privacy(), true)}
                    />
                    <TextField
                      label={t`Terms of service`}
                      placeholder="https://"
                      value={terms()}
                      maxlength={LINK_MAX}
                      dir="ltr"
                      required
                      onInput={(e) => setTerms(e.currentTarget.value)}
                      error={linkError(terms(), true)}
                    />
                    <TextField
                      label={t`Website (optional)`}
                      placeholder="https://"
                      value={website()}
                      maxlength={LINK_MAX}
                      dir="ltr"
                      onInput={(e) => setWebsite(e.currentTarget.value)}
                      error={linkError(website(), false)}
                    />
                    <TextField
                      label={t`Support link (optional)`}
                      placeholder="https://"
                      value={support()}
                      maxlength={LINK_MAX}
                      dir="ltr"
                      onInput={(e) => setSupport(e.currentTarget.value)}
                      error={linkError(support(), false)}
                    />
                  </Pair>
                  <Show when={error()}>
                    <Refused role="alert">{error()}</Refused>
                  </Show>
                  <Submit>
                    <Button
                      isDisabled={
                        busy() || blocked() || props.intents === undefined
                      }
                      onPress={() => void apply()}
                    >
                      <Show
                        when={busy()}
                        fallback={<Trans>Apply for verification</Trans>}
                      >
                        <Trans>Sending…</Trans>
                      </Show>
                    </Button>
                  </Submit>
                </SettingsFormPanel>
              </Show>
            </Column>
          )}
        </Show>
      </Show>
    </SettingsSection>
  );
}

const Refused = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-danger)",
    fontSize: "13px",
    lineHeight: "20px",
  },
});

/** two fields side by side, one under the other on a phone */
const Pair = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    _phone: { gridTemplateColumns: "1fr" },
  },
});

/** the request's one button, at the form's end */
const Submit = styled("div", {
  base: { display: "flex", justifyContent: "flex-end" },
});

/** the checklist's name, as a section title */
const Heading = styled("h3", {
  base: {
    margin: 0,
    paddingInline: "2px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

/** the checklist inside the section's card, with the rows' own inset */
const ChecklistBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "14px 16px 4px",
  },
});
