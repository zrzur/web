import {
  For,
  Match,
  Show,
  Switch,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQueryClient } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  Button,
  Checkbox,
  CircularProgress,
  Column,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type LinkedAccount,
  type LinkedAccounts,
  connectionsApi,
} from "./connectionsApi";

/**
 * Accounts on other services shown on the profile. Steam for now: the person
 * signs in on Steam's own page, checks a preview, then chooses to show it.
 * Hiding and disconnecting take one press each.
 */
export function Connections() {
  const client = useClient();
  const [data, setData] = createSignal<LinkedAccounts>();
  const [failure, setFailure] = createSignal<unknown>();

  async function load() {
    setFailure(undefined);
    try {
      setData(await connectionsApi.list(client()));
    } catch (error) {
      setFailure(error);
    }
  }

  onMount(load);

  const setAccount = (account?: LinkedAccount) =>
    setData((current) =>
      current
        ? { steam: { available: current.steam.available, account } }
        : current,
    );

  return (
    <Column gap="lg">
      <Note>
        <Trans>
          Show accounts you have on other services on your profile. You choose
          what shows, and you can hide or disconnect them at any time.
        </Trans>
      </Note>
      <Switch fallback={<CircularProgress />}>
        <Match when={failure()}>
          <Failure role="alert">
            <span>
              <Trans>We could not load your connections.</Trans>{" "}
              <TranslatedError error={failure()} />
            </span>
            <div>
              <Button variant="outlined" onPress={load}>
                <Trans>Try again</Trans>
              </Button>
            </div>
          </Failure>
        </Match>
        <Match when={data()}>
          {(list) => (
            <Show
              when={list().steam.account}
              fallback={<SteamConnect available={list().steam.available} />}
            >
              {(account) => (
                <SteamLinked account={account()} onChange={setAccount} />
              )}
            </Show>
          )}
        </Match>
      </Switch>
      <Small>
        <Trans>
          Steam is a trademark of Valve Corporation. Zrzur is not affiliated
          with Valve.
        </Trans>
      </Small>
    </Column>
  );
}

/** The Steam row before linking, and the consent step before leaving */
function SteamConnect(props: { available: boolean }) {
  const client = useClient();
  const [asking, setAsking] = createSignal(false);
  const [agreed, setAgreed] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();

  async function go() {
    setBusy(true);
    setError(undefined);
    try {
      const { url } = await connectionsApi.start(
        client(),
        window.location.origin,
      );
      window.location.assign(url);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <SettingsSection title={<Trans>Steam</Trans>}>
      <SettingsRow
        icon={<Icon name="game-controller" size={24} />}
        title={<Trans>Connect Steam</Trans>}
        description={
          <Show
            when={props.available}
            fallback={<Trans>Steam can't be linked on this server yet.</Trans>}
          >
            <Trans>
              Show your Steam name, games and achievements on your profile. You
              sign in on Steam's own page. We never see your Steam password.
            </Trans>
          </Show>
        }
        control={() => (
          <Show when={props.available && !asking()}>
            <Button size="sm" onPress={() => setAsking(true)}>
              <Trans>Connect Steam</Trans>
            </Button>
          </Show>
        )}
      />
      <Show when={asking()}>
        <Consent role="group" aria-labelledby="steam-consent-title">
          <ConsentTitle id="steam-consent-title">
            <Trans>Connect Steam</Trans>
          </ConsentTitle>
          <p>
            <Trans>
              You will sign in on Steam's own page. Zrzur never sees that
              password.
            </Trans>
          </p>
          <p>
            <strong>
              <Trans>We will copy:</Trans>
            </strong>{" "}
            <Trans>
              your Steam name and link, your game count, hours played and your
              most played games with their achievements, from what Steam shows
              publicly, and keep them in the EU.
            </Trans>
          </p>
          <p>
            <strong>
              <Trans>Who sees it:</Trans>
            </strong>{" "}
            <Trans>
              anyone who can open your Zrzur profile. If you are under 18, or
              we do not know your age, only your friends. You see a preview
              first and can hide any game.
            </Trans>
          </p>
          <p>
            <strong>
              <Trans>Keep in mind:</Trans>
            </strong>{" "}
            <Trans>
              this ties your Steam account to your Zrzur account. What you play
              can say something about your beliefs, health or sexuality.
            </Trans>
          </p>
          <p>
            <strong>
              <Trans>Updates:</Trans>
            </strong>{" "}
            <Trans>
              we copy it again only when you press Refresh. Private on Steam
              means nothing shows here. You can hide or disconnect at any time
              in Settings; disconnecting deletes this copy.
            </Trans>
          </p>
          <Checkbox
            checked={agreed()}
            onChange={(event) => setAgreed(event.currentTarget.checked)}
          >
            <Trans>
              I want Zrzur to copy this and show it on my profile, including
              anything it may reveal about me.
            </Trans>
          </Checkbox>
          <Show when={error()}>
            <ErrorLine role="alert">
              <Trans>Steam could not be opened.</Trans>{" "}
              <TranslatedError error={error()} />
            </ErrorLine>
          </Show>
          <Actions>
            <Button
              variant="outlined"
              isDisabled={busy()}
              onPress={() => {
                setAsking(false);
                setAgreed(false);
                setError(undefined);
              }}
            >
              <Trans>Not now</Trans>
            </Button>
            <Button isDisabled={!agreed() || busy()} onPress={go}>
              <Trans>Continue to Steam</Trans>
            </Button>
          </Actions>
        </Consent>
      </Show>
    </SettingsSection>
  );
}

/** A linked Steam account: preview, what shows, refresh and disconnect */
function SteamLinked(props: {
  account: LinkedAccount;
  onChange: (account?: LinkedAccount) => void;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const queries = useQueryClient();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  const [now, setNow] = createSignal(Date.now());

  const timer = setInterval(() => setNow(Date.now()), 15_000);
  onCleanup(() => clearInterval(timer));

  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  async function run(action: () => Promise<LinkedAccount | undefined>) {
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

  const hidden = (appid: number) => props.account.hidden_titles.includes(appid);

  const toggleGame = (appid: number, show: boolean) =>
    run(() =>
      connectionsApi.edit(client(), {
        hidden_titles: show
          ? props.account.hidden_titles.filter((id) => id !== appid)
          : [...props.account.hidden_titles, appid],
      }),
    );

  const canRefresh = () => now() >= props.account.refresh_after;

  return (
    <SettingsSection
      title={<Trans>Steam</Trans>}
      aside={
        <Status data-shown={props.account.shown}>
          <Show
            when={props.account.shown}
            fallback={<Trans>Not on your profile</Trans>}
          >
            <Trans>On your profile</Trans>
          </Show>
        </Status>
      }
    >
      <SettingsRow
        icon={<Icon name="game-controller" size={24} />}
        title={
          <Show
            when={props.account.display_name}
            fallback={<Trans>Steam account</Trans>}
          >
            <bdi>{props.account.display_name}</bdi>
          </Show>
        }
        description={
          <Show
            when={!props.account.private}
            fallback={
              <Trans>
                This Steam account or its game details are private. Make them
                public on Steam, then press Refresh.
              </Trans>
            }
          >
            {t`${number(props.account.game_count ?? 0)} games`}
            {" · "}
            {t`${number(props.account.total_hours ?? 0)} hours played`}
          </Show>
        }
        control={(ids) => (
          <Toggle
            checked={props.account.shown}
            disabled={busy()}
            aria-labelledby={ids.labelId}
            aria-label={t`Show on my profile`}
            onChange={(shown) =>
              run(() => connectionsApi.edit(client(), { shown }))
            }
          />
        )}
      />
      <Show when={!props.account.shown}>
        <Note>
          <Trans>
            This is a preview. Nothing shows on your profile until you switch it
            on. Untick any game you want to keep to yourself.
          </Trans>
        </Note>
      </Show>
      <Show when={props.account.games.length}>
        <Games aria-label={t`Most played games`}>
          <For each={props.account.games}>
            {(game) => (
              <li>
                <Checkbox
                  checked={!hidden(game.appid)}
                  disabled={busy()}
                  onChange={(event) =>
                    toggleGame(game.appid, event.currentTarget.checked)
                  }
                >
                  <GameLine>
                    <bdi>{game.name}</bdi>
                    <GameFacts>
                      {t`${number(game.hours)} h`}
                      <Show when={game.achievements_total}>
                        {" · "}
                        {t`${number(game.achievements_unlocked ?? 0)} of ${number(game.achievements_total ?? 0)} achievements`}
                      </Show>
                    </GameFacts>
                  </GameLine>
                </Checkbox>
              </li>
            )}
          </For>
        </Games>
      </Show>
      <Show when={error()}>
        <ErrorLine role="alert">
          <Trans>That did not work.</Trans> <TranslatedError error={error()} />
        </ErrorLine>
      </Show>
      <Actions>
        <Button
          variant="outlined"
          size="sm"
          isDisabled={busy() || !canRefresh()}
          onPress={() => run(() => connectionsApi.refresh(client()))}
        >
          <Trans>Refresh</Trans>
        </Button>
        <Button
          variant="outlined"
          size="sm"
          isDisabled={busy()}
          onPress={() =>
            run(async () => {
              await connectionsApi.disconnect(client());
              return undefined;
            })
          }
        >
          <Trans>Disconnect</Trans>
        </Button>
      </Actions>
      <Small>
        <Trans>
          Disconnecting deletes everything Zrzur copied from Steam at once.
        </Trans>
      </Small>
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

const Failure = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-md)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
  },
});

const Consent = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-md)",
    border: "1px solid var(--z-border-subtle)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    lineHeight: "20px",

    "& p": { margin: 0 },
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

const Games = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: "0 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const GameLine = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
  },
});

const GameFacts = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
  },
});
