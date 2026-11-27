import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQueryClient } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  Button,
  Checkbox,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import type { IconName } from "@revolt/ui/icons/Icon";
import { Icon } from "@revolt/ui/icons/Icon";

import { leaveForSignIn } from "./leaveForSignIn";
import {
  type ServiceAccount,
  type ServiceConnection,
  type ServiceId,
  LINKED_CONSENT_VERSION,
  MAX_SHOWN_REPOS,
  daysLeft,
  needsConsent,
  serviceConnectionsApi,
  toggleRepo,
} from "./serviceConnectionsApi";

/** The linked-accounts part of the privacy policy */
const PRIVACY_URL = "https://zrzur.com/legal/privacy#linked-accounts";

const ICONS: Record<ServiceId, IconName> = {
  twitch: "video-camera",
  github: "code",
  battlenet: "identification-badge",
};

/** The service's name: a proper name, the same in every language */
const NAMES: Record<ServiceId, string> = {
  twitch: "Twitch",
  github: "GitHub",
  battlenet: "Battle.net",
};

/**
 * Twitch, GitHub and Battle.net, each in its own card under Steam. Same
 * steps as Steam: a consent step, sign-in on the service's own page, a
 * preview, then the person chooses to show it.
 */
export function ServiceCards(props: {
  connections: Record<ServiceId, ServiceConnection | undefined>;
  onChange: (service: ServiceId, account?: ServiceAccount) => void;
}) {
  return (
    <For each={["twitch", "github", "battlenet"] as ServiceId[]}>
      {(service) => (
        <Show
          when={props.connections[service]?.account}
          fallback={
            <ServiceConnect
              service={service}
              available={props.connections[service]?.available ?? false}
            />
          }
        >
          {(account) => (
            <ServiceLinked
              account={account()}
              onChange={(next) => props.onChange(service, next)}
            />
          )}
        </Show>
      )}
    </For>
  );
}

/**
 * The US transfer, said before the box is ticked (GDPR Art. 49(1)(a)): the
 * company, the country and the risk. GitHub is under the EU–US Data
 * Privacy Framework and leaves it out.
 */
export function UsTransfer(props: { name: string }) {
  // a plain name keeps the `{name}` placeholder in the catalogs
  const name = props.name;
  return (
    <Trans>
      {name} is a US company: what we send it and read from it goes to the
      United States, where your data may be less protected than in the EU (for
      example, US authorities may be able to access it).
    </Trans>
  );
}

/** What the copy may reveal (GDPR Art. 9(2)(a)), for every service */
export function MayReveal() {
  return (
    <Trans>
      What you play or post there can say something about your beliefs, health
      or sexuality.
    </Trans>
  );
}

/** The box the person ticks: the copy, what it may reveal, the transfer */
export function ConsentLabel(props: { name: string }) {
  const name = props.name;
  return (
    <Trans>
      I agree that Zrzur copies this and shows it on my profile, including
      anything it may reveal about me, and exchanges this data with {name} in
      the United States.
    </Trans>
  );
}

/** Where the desktop app can be downloaded */
const DOWNLOAD_URL = "https://zrzur.com/download";

/**
 * The service's sign-in page did not open (desktop 26.1.0-beta1 blocks
 * outside sites): what to do, in the card
 */
export function SignInStuck(props: { name: string }) {
  const name = props.name;
  return (
    <ErrorLine role="alert">
      <Trans>
        {name}'s sign-in page did not open. If you use the Zrzur desktop app,
        install the latest version from{" "}
        <PolicyLink href={DOWNLOAD_URL} target="_blank" rel="noopener">
          zrzur.com/download
        </PolicyLink>
        , then try again.
      </Trans>
    </ErrorLine>
  );
}

/** "Keep in mind" for Twitch, GitHub and Battle.net */
function KeepInMind(props: { service: ServiceId }) {
  const name = () => NAMES[props.service];
  return (
    <p>
      <strong>
        <Trans>Keep in mind:</Trans>
      </strong>{" "}
      <Trans>This ties your {name()} account to your Zrzur account.</Trans>{" "}
      <Show when={props.service !== "github"}>
        <UsTransfer name={name()} />{" "}
      </Show>
      <MayReveal />{" "}
      <PolicyLink href={PRIVACY_URL} target="_blank" rel="noopener">
        <Trans>Privacy Policy: linked accounts</Trans>
      </PolicyLink>
    </p>
  );
}

/** Why an existing link is asked again, and what waits until then */
function ConsentAgainLine(props: { service: ServiceId }) {
  return (
    <Switch>
      <Match when={props.service === "twitch"}>
        <Trans>
          We have updated what you agree to when you link Twitch: it now names
          where your data goes. Until you agree, your channel does not show on
          your profile and we exchange no data with Twitch about it.
        </Trans>
      </Match>
      <Match when={props.service === "github"}>
        <Trans>
          We have updated what you agree to when you link GitHub: it now names
          where your data goes. Until you agree, your GitHub account does not
          show on your profile and Refresh stays off.
        </Trans>
      </Match>
      <Match when={props.service === "battlenet"}>
        <Trans>
          We have updated what you agree to when you link Battle.net: it now
          names where your data goes. You agree to it the next time you confirm
          on Battle.net.
        </Trans>
      </Match>
    </Switch>
  );
}

/** What linking a service copies, in plain words */
function WhatWeCopy(props: { service: ServiceId }) {
  return (
    <Switch>
      <Match when={props.service === "twitch"}>
        <Trans>
          your Twitch name, picture, bio and channel link, whether you are a
          partner or affiliate, the category of your last stream, and whether
          you are live now with the stream title, and keep them in the EU.
        </Trans>
      </Match>
      <Match when={props.service === "github"}>
        <Trans>
          your GitHub username, name, picture, bio and link, your follower and
          repository counts, and up to 12 of your most starred own public
          repositories with their description, language and stars, and keep them
          in the EU.
        </Trans>
      </Match>
      <Match when={props.service === "battlenet"}>
        <Trans>your BattleTag, and nothing else, and keep it in the EU.</Trans>
      </Match>
    </Switch>
  );
}

/** How the copy stays current */
function HowItUpdates(props: { service: ServiceId }) {
  return (
    <Switch>
      <Match when={props.service === "twitch"}>
        <Trans>
          We give Twitch your channel id so it tells us when you go live or
          offline; people who can see your profile then see that you are live.
          We read your name again once a day and keep nothing from Twitch older
          than 24 hours. We keep no Twitch sign-in.
        </Trans>
      </Match>
      <Match when={props.service === "github"}>
        <Trans>
          we read your repositories again only when you press Refresh. We keep
          no GitHub sign-in.
        </Trans>
      </Match>
      <Match when={props.service === "battlenet"}>
        <Trans>
          Battle.net lets us keep it for 30 days. Confirm on Battle.net before
          then to keep it; otherwise we delete it. We keep no Battle.net
          sign-in.
        </Trans>
      </Match>
    </Switch>
  );
}

function ConnectLine(props: { service: ServiceId }): JSX.Element {
  return (
    <Switch>
      <Match when={props.service === "twitch"}>
        <Trans>Your Twitch channel, and when you are live.</Trans>
      </Match>
      <Match when={props.service === "github"}>
        <Trans>Your GitHub account and your best public repositories.</Trans>
      </Match>
      <Match when={props.service === "battlenet"}>
        <Trans>Your BattleTag, so friends can add you.</Trans>
      </Match>
    </Switch>
  );
}

/** A service before linking, and the consent step before leaving */
function ServiceConnect(props: { service: ServiceId; available: boolean }) {
  const { t } = useLingui();
  const client = useClient();
  const [asking, setAsking] = createSignal(false);
  const [agreed, setAgreed] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  const [stuck, setStuck] = createSignal(false);
  const name = () => NAMES[props.service];
  const titleId = () => `${props.service}-consent-title`;

  async function go() {
    setBusy(true);
    setError(undefined);
    setStuck(false);
    try {
      const { url } = await serviceConnectionsApi.start(
        client(),
        props.service,
        window.location.origin,
      );
      leaveForSignIn(url, () => {
        setStuck(true);
        setBusy(false);
      });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <SettingsSection title={name()}>
      <SettingsRow
        icon={<Icon name={ICONS[props.service]} size={20} />}
        title={t`Not linked`}
        description={
          <Show
            when={props.available}
            fallback={
              <Trans>{name()} can't be linked on this server yet.</Trans>
            }
          >
            <ConnectLine service={props.service} />
          </Show>
        }
        control={() => (
          <Show when={props.available && !asking()}>
            <Button size="sm" onPress={() => setAsking(true)}>
              {t`Connect ${name()}`}
            </Button>
          </Show>
        )}
      />
      <Show when={asking()}>
        <Body>
          <Consent role="group" aria-labelledby={titleId()}>
            <ConsentTitle id={titleId()}>{t`Connect ${name()}`}</ConsentTitle>
            <p>
              <Trans>
                You will sign in on {name()}'s own page. Zrzur never sees that
                password.
              </Trans>
            </p>
            <p>
              <strong>
                <Trans>We will copy:</Trans>
              </strong>{" "}
              <WhatWeCopy service={props.service} />
            </p>
            <p>
              <strong>
                <Trans>Who sees it:</Trans>
              </strong>{" "}
              <Trans>
                nobody until you switch it on. Then anyone who can open your
                Zrzur profile. If you are under 18, or we do not know your age,
                only your friends.
              </Trans>
            </p>
            <p>
              <strong>
                <Trans>Updates:</Trans>
              </strong>{" "}
              <HowItUpdates service={props.service} />{" "}
              <Trans>Disconnecting deletes everything we copied.</Trans>
            </p>
            <KeepInMind service={props.service} />
            <Checkbox
              checked={agreed()}
              onChange={(event) => setAgreed(event.currentTarget.checked)}
            >
              <ConsentLabel name={name()} />
            </Checkbox>
            <Show when={error()}>
              <ErrorLine role="alert">
                <Trans>{name()} could not be opened.</Trans>{" "}
                <TranslatedError error={error()} />
              </ErrorLine>
            </Show>
            <Show when={stuck()}>
              <SignInStuck name={name()} />
            </Show>
            <Actions>
              <Button
                variant="outlined"
                isDisabled={busy()}
                onPress={() => {
                  setAsking(false);
                  setAgreed(false);
                  setError(undefined);
                  setStuck(false);
                }}
              >
                <Trans>Not now</Trans>
              </Button>
              <Button isDisabled={!agreed() || busy()} onPress={go}>
                {t`Continue to ${name()}`}
              </Button>
            </Actions>
          </Consent>
        </Body>
      </Show>
    </SettingsSection>
  );
}

/** A linked service: preview, what shows, and its own buttons */
function ServiceLinked(props: {
  account: ServiceAccount;
  onChange: (account?: ServiceAccount) => void;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const queries = useQueryClient();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  const [now, setNow] = createSignal(Date.now());
  const [agreeNew, setAgreeNew] = createSignal(false);
  const [notNow, setNotNow] = createSignal(false);
  const [stuck, setStuck] = createSignal(false);
  const service = () => props.account.service;
  const name = () => NAMES[service()];
  const asking = () => needsConsent(props.account) && !notNow();
  const titleId = () => `${service()}-reconsent-title`;

  /** Refresh or Confirm before agreeing: show the new text instead */
  const askFirst = () => {
    setNotNow(false);
    queueMicrotask(() => document.getElementById(titleId())?.focus());
  };

  const timer = setInterval(() => setNow(Date.now()), 15_000);
  onCleanup(() => clearInterval(timer));

  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  async function run(action: () => Promise<ServiceAccount | undefined>) {
    setBusy(true);
    setError(undefined);
    try {
      props.onChange(await action());
      // the profile card shows the change at once
      queries.invalidateQueries({ queryKey: ["profile", client().user!.id] });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAgain() {
    setBusy(true);
    setError(undefined);
    setStuck(false);
    try {
      const { url } = await serviceConnectionsApi.start(
        client(),
        service(),
        window.location.origin,
      );
      leaveForSignIn(url, () => {
        setStuck(true);
        setBusy(false);
      });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const expired = () =>
    props.account.expires_at !== undefined && now() >= props.account.expires_at;
  const days = () =>
    props.account.expires_at !== undefined
      ? daysLeft(props.account.expires_at, now())
      : 0;
  /** Others see it: Twitch and GitHub also wait for the consent in use */
  const onProfile = () =>
    props.account.shown &&
    !expired() &&
    !(service() !== "battlenet" && needsConsent(props.account));
  const shownRepos = () => props.account.shown_repos ?? [];
  const canRefresh = () => now() >= props.account.refresh_after;

  return (
    <SettingsSection
      title={name()}
      aside={
        <Status data-shown={onProfile()}>
          <Show
            when={onProfile()}
            fallback={<Trans>Not on your profile</Trans>}
          >
            <Trans>On your profile</Trans>
          </Show>
        </Status>
      }
    >
      <SettingsRow
        icon={<Icon name={ICONS[service()]} size={20} />}
        title={<bdi>{props.account.display_name || name()}</bdi>}
        description={
          <Switch>
            <Match when={service() === "twitch" && !props.account.display_name}>
              <Trans>
                Waiting for Twitch: the name shows again once Twitch answers.
              </Trans>
            </Match>
            <Match when={service() === "twitch" && props.account.live}>
              <LiveLine>
                <Live>
                  <Trans>Live now</Trans>
                </Live>
                <Show when={props.account.live_title}>
                  <bdi>{props.account.live_title}</bdi>
                </Show>
              </LiveLine>
            </Match>
            <Match when={service() === "twitch"}>
              <Trans>Not live right now.</Trans>
            </Match>
            <Match when={service() === "github"}>
              {t`${number(props.account.repos?.length ?? 0)} public repositories`}
            </Match>
            <Match when={service() === "battlenet"}>
              <Warn data-calm={days() > 7}>
                {t`Confirm within ${number(days())} days`}
              </Warn>
            </Match>
          </Switch>
        }
        control={(ids) => (
          <Toggle
            checked={props.account.shown}
            disabled={busy()}
            aria-labelledby={ids.labelId}
            aria-label={t`Show on my profile`}
            onChange={(shown) =>
              run(() =>
                serviceConnectionsApi.edit(client(), service(), { shown }),
              )
            }
          />
        )}
      />
      <Body>
        <Show when={asking()}>
          <Consent role="group" aria-labelledby={titleId()}>
            <ConsentTitle id={titleId()} tabIndex={-1}>
              {t`Updated consent for ${name()}`}
            </ConsentTitle>
            <p>
              <ConsentAgainLine service={service()} />
            </p>
            <p>
              <strong>
                <Trans>We will copy:</Trans>
              </strong>{" "}
              <WhatWeCopy service={service()} />
            </p>
            <p>
              <strong>
                <Trans>Updates:</Trans>
              </strong>{" "}
              <HowItUpdates service={service()} />{" "}
              <Trans>Disconnecting deletes everything we copied.</Trans>
            </p>
            <KeepInMind service={service()} />
            <Checkbox
              checked={agreeNew()}
              onChange={(event) => setAgreeNew(event.currentTarget.checked)}
            >
              <ConsentLabel name={name()} />
            </Checkbox>
            <Actions>
              <Button
                variant="outlined"
                size="sm"
                isDisabled={busy()}
                onPress={() => setNotNow(true)}
              >
                <Trans>Not now</Trans>
              </Button>
              <Show
                when={service() === "battlenet"}
                fallback={
                  <Button
                    size="sm"
                    isDisabled={busy() || !agreeNew()}
                    onPress={() =>
                      run(() =>
                        serviceConnectionsApi.edit(client(), service(), {
                          consent: LINKED_CONSENT_VERSION,
                        }),
                      )
                    }
                  >
                    <Trans>Save</Trans>
                  </Button>
                }
              >
                <Button
                  size="sm"
                  isDisabled={busy() || !agreeNew()}
                  onPress={confirmAgain}
                >
                  {t`Continue to ${name()}`}
                </Button>
              </Show>
            </Actions>
          </Consent>
        </Show>
        <Show when={!props.account.shown}>
          <Note>
            <Trans>
              This is a preview. Nothing shows on your profile until you switch
              it on.
            </Trans>
          </Note>
        </Show>
        <Show when={service() === "github" && props.account.repos?.length}>
          <Note id="github-repos-title">
            {t`Repositories to show (up to ${MAX_SHOWN_REPOS})`}
          </Note>
          <Repos aria-labelledby="github-repos-title">
            <For each={props.account.repos}>
              {(repo) => (
                <li>
                  <Checkbox
                    checked={shownRepos().includes(repo.id)}
                    disabled={
                      busy() ||
                      (!shownRepos().includes(repo.id) &&
                        shownRepos().length >= MAX_SHOWN_REPOS)
                    }
                    onChange={(event) =>
                      run(() =>
                        serviceConnectionsApi.edit(client(), "github", {
                          shown_repos: toggleRepo(
                            shownRepos(),
                            repo.id,
                            event.currentTarget.checked,
                          ),
                        }),
                      )
                    }
                  >
                    <RepoLine>
                      <RepoName dir="ltr">{repo.name}</RepoName>
                      <RepoFacts>
                        <Show when={repo.description}>
                          <bdi>{repo.description}</bdi>
                        </Show>
                        <span>
                          <Show when={repo.language}>
                            <bdi>{repo.language}</bdi>
                            {" · "}
                          </Show>
                          {t`${number(repo.stars)} stars`}
                        </span>
                      </RepoFacts>
                    </RepoLine>
                  </Checkbox>
                </li>
              )}
            </For>
          </Repos>
        </Show>
        <Show when={error()}>
          <ErrorLine role="alert">
            <Trans>That did not work.</Trans>{" "}
            <TranslatedError error={error()} />
          </ErrorLine>
        </Show>
        <Show when={stuck()}>
          <SignInStuck name={name()} />
        </Show>
        <Footer>
          <Small>
            <Switch>
              <Match when={service() === "battlenet"}>
                <Trans>
                  BattleTag from Battle.net. Disconnecting deletes it at once.
                </Trans>
              </Match>
              <Match when={service() === "github"}>
                <Trans>
                  Only public repositories. Refresh reads GitHub again; it never
                  runs by itself.
                </Trans>
              </Match>
              <Match when={service() === "twitch"}>
                <Trans>
                  Live status updates by itself. Disconnecting deletes
                  everything Zrzur copied from Twitch at once.
                </Trans>
              </Match>
            </Switch>
          </Small>
          <Actions>
            <Show when={service() === "github"}>
              <Button
                variant="outlined"
                size="sm"
                isDisabled={busy() || !canRefresh()}
                onPress={() =>
                  needsConsent(props.account)
                    ? askFirst()
                    : run(() =>
                        serviceConnectionsApi.refresh(client(), "github"),
                      )
                }
              >
                <Trans>Refresh</Trans>
              </Button>
            </Show>
            <Show when={service() === "battlenet"}>
              <Button
                variant="outlined"
                size="sm"
                isDisabled={busy()}
                onPress={() =>
                  needsConsent(props.account) ? askFirst() : confirmAgain()
                }
              >
                <Trans>Confirm on Battle.net</Trans>
              </Button>
            </Show>
            <Button
              variant="outlined"
              size="sm"
              isDisabled={busy()}
              onPress={() =>
                run(async () => {
                  await serviceConnectionsApi.disconnect(client(), service());
                  return undefined;
                })
              }
            >
              <Trans>Disconnect</Trans>
            </Button>
          </Actions>
        </Footer>
      </Body>
    </SettingsSection>
  );
}

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Small = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
  },
});

const Consent = styled("div", {
  base: {
    background: "var(--z-box-bg)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-box-radius)",
    // phones: the fill and corner of every settings group, no frame
    // (owner, 2026-11-17: one box look everywhere)
    _phone: {
      border: "none",
      borderRadius: "14px",
      boxShadow: "none",
      background: "color-mix(in srgb, var(--z-fg-primary) 4%, transparent)",
    },
    border: "var(--z-box-border)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    lineHeight: "20px",

    "& p": { margin: 0 },
  },
});

const PolicyLink = styled("a", {
  base: {
    color: "var(--z-link)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    "&:focus-visible": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
      borderRadius: "var(--z-radius-xs)",
    },
  },
});

const ConsentTitle = styled("h3", {
  base: {
    margin: 0,
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 600,
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "flex-end",
  },
});

const ErrorLine = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-danger)",
  },
});

const Status = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",

    "&[data-shown=true]": {
      color: "var(--z-fg-primary)",
    },
  },
});

/** Under the account row, in the card's own frame, like Steam's */
const Body = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    "&::before": {
      content: "''",
      position: "absolute",
      top: 0,
      insetInline: "16px",
      height: "1px",
      background: "var(--z-border-subtle)",
    },
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    paddingTop: "16px",
    borderTop: "1px solid var(--z-border-subtle)",
    "& > p": { flex: "1 1 220px", minWidth: 0 },
  },
});

const LiveLine = styled("span", {
  base: {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
});

/** "Happening now": the live colour, outlined, never a filled action */
const Live = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    paddingInline: "8px",
    borderRadius: "var(--z-radius-pill)",
    border: "1px solid currentColor",
    color: "var(--z-live)",
    fontSize: "12px",
    lineHeight: "18px",
    fontWeight: 500,

    "&::before": {
      content: "''",
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "currentColor",
    },
  },
});

const Warn = styled("span", {
  base: {
    color: "var(--z-warning)",
    "&[data-calm=true]": { color: "var(--z-fg-secondary)" },
  },
});

const Repos = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
});

const RepoLine = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
  },
});

const RepoName = styled("span", {
  base: {
    fontFamily: "var(--fonts-monospace)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    unicodeBidi: "isolate",
  },
});

const RepoFacts = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
  },
});
