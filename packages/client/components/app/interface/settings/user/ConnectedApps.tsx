import { For, Match, Show, Switch, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { File as StoatFile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  Avatar,
  Button,
  CircularProgress,
  Column,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type AuthorizedApplication,
  oauthApi,
} from "../../channels/text/interactions/api";

import { useScopeText } from "./oauthScopes";

/**
 * Connected apps: the apps the user let use their account through OAuth2,
 * what each may do, and a way to end that access. The only kind of account
 * connection Zrzur has (no linked third-party accounts).
 */
export function ConnectedApps() {
  const client = useClient();
  const [apps, setApps] = createSignal<AuthorizedApplication[]>();
  const [failure, setFailure] = createSignal<unknown>();

  async function load() {
    setFailure(undefined);
    try {
      setApps(await oauthApi.authorized(client()));
    } catch (error) {
      setFailure(error);
    }
  }

  onMount(load);

  const removed = (id: string) =>
    setApps((list) => list?.filter((app) => app.application._id !== id));

  return (
    <Column gap="lg">
      <Switch fallback={<CircularProgress />}>
        <Match when={failure()}>
          <Failure role="alert">
            <span>
              <Trans>We could not load your connected apps.</Trans>{" "}
              <TranslatedError error={failure()} />
            </span>
            <div>
              <Button variant="outlined" onPress={load}>
                <Trans>Try again</Trans>
              </Button>
            </div>
          </Failure>
        </Match>
        <Match when={apps()}>
          {(list) => (
            <>
              <Note>
                <Trans>
                  Apps you allowed to use your account. Revoking one ends its
                  access at once; bots it added stay in servers until their
                  managers remove them.
                </Trans>
              </Note>
              <Show
                when={list().length}
                fallback={
                  <Empty>
                    <Icon name="key" size={24} />
                    <Trans>No apps are connected to your account.</Trans>
                  </Empty>
                }
              >
                <SettingsSection>
                  <For each={list()}>
                    {(app) => <AppRow app={app} onRevoked={removed} />}
                  </For>
                </SettingsSection>
              </Show>
            </>
          )}
        </Match>
      </Switch>
    </Column>
  );
}

/**
 * One app: avatar, name, what it may do, since when; Revoke access asks
 * once in the row before it acts
 */
function AppRow(props: {
  app: AuthorizedApplication;
  onRevoked: (id: string) => void;
}) {
  const { i18n } = useLingui();
  const client = useClient();
  const scopeText = useScopeText();
  const [confirming, setConfirming] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();

  const name = () =>
    props.app.application.display_name ?? props.app.application.username;

  const avatar = () =>
    props.app.application.avatar
      ? new StoatFile(client(), props.app.application.avatar).createFileURL()
      : undefined;

  // each phrase once, even when two unknown scopes both read "Other access"
  const abilities = () => [
    ...new Set(props.app.scopes.map((scope) => scopeText(scope))),
  ];

  const since = () =>
    props.app.authorized_at
      ? new Intl.DateTimeFormat(i18n().locale, { dateStyle: "long" }).format(
          new Date(props.app.authorized_at),
        )
      : undefined;

  async function revoke() {
    setBusy(true);
    setError(undefined);
    try {
      await oauthApi.revoke(client(), props.app.application._id);
      props.onRevoked(props.app.application._id);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <SettingsRow
      icon={<Avatar size={36} src={avatar()} fallback={name()} />}
      title={<bdi>{name()}</bdi>}
      description={
        <Details>
          <Show
            when={confirming()}
            fallback={
              <>
                <span>{abilities().join(" · ")}</span>
                <Show when={since()}>
                  <span>
                    <Trans>Connected on {since()}</Trans>
                  </span>
                </Show>
              </>
            }
          >
            <span>
              <Trans>
                <bdi>{name()}</bdi> loses access to your account at once.
              </Trans>
            </span>
          </Show>
          <Show when={error()}>
            <ErrorLine role="alert">
              <Trans>Access was not revoked.</Trans>{" "}
              <TranslatedError error={error()} />
            </ErrorLine>
          </Show>
        </Details>
      }
      control={() => (
        <Show
          when={confirming()}
          fallback={
            <Button
              size="sm"
              variant="outlined"
              onPress={() => setConfirming(true)}
            >
              <Trans>Revoke access</Trans>
            </Button>
          }
        >
          <Actions>
            <Button
              size="sm"
              variant="text"
              isDisabled={busy()}
              onPress={() => {
                setConfirming(false);
                setError(undefined);
              }}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              size="sm"
              variant="_error"
              isDisabled={busy()}
              onPress={revoke}
            >
              <Trans>Yes, revoke</Trans>
            </Button>
          </Actions>
        </Show>
      )}
    />
  );
}

const Note = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-fg-muted)",
    fontSize: "13px",
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-subtle)",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    "--z-icon-color": "var(--z-icon-muted)",
  },
});

const Details = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

const ErrorLine = styled("span", {
  base: { color: "var(--z-danger)" },
});

const Actions = styled("div", {
  base: { display: "flex", gap: "8px", flexWrap: "wrap" },
});

const Failure = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
  },
});
