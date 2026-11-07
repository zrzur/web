import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  InteractionError,
  oauthApi,
} from "@revolt/app/interface/channels/text/interactions";
import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useLocation } from "@revolt/routing";
import { Avatar, FloatingSelect, MenuItem } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/** Readable names of the permission bits an app may ask for */
export function usePermissionNames() {
  const { t } = useLingui();
  return [
    [2 ** 0, t`Manage channels`],
    [2 ** 1, t`Manage server`],
    [2 ** 2, t`Manage permissions`],
    [2 ** 3, t`Manage roles`],
    [2 ** 6, t`Kick members`],
    [2 ** 7, t`Ban members`],
    [2 ** 8, t`Time out members`],
    [2 ** 9, t`Assign roles`],
    [2 ** 11, t`Manage nicknames`],
    [2 ** 20, t`View channels`],
    [2 ** 21, t`Read message history`],
    [2 ** 22, t`Send messages`],
    [2 ** 23, t`Manage messages`],
    [2 ** 24, t`Manage webhooks`],
    [2 ** 26, t`Send embeds`],
    [2 ** 27, t`Upload files`],
    [2 ** 29, t`React`],
    [2 ** 30, t`Connect to voice`],
    [2 ** 31, t`Speak`],
    [2 ** 37, t`Mention everyone`],
  ] as const;
}

function permissionList(
  bits: number,
  names: ReturnType<typeof usePermissionNames>,
) {
  const listed = names
    .filter(([bit]) => Math.floor(bits / bit) % 2 === 1)
    .map(([, name]) => name);
  const known = names.reduce(
    (sum, [bit]) => sum + (Math.floor(bits / bit) % 2 === 1 ? bit : 0),
    0,
  );
  return { listed, other: bits !== known };
}

/** `/oauth2/authorize` (consent) and `/oauth2/authorized` (authorized apps) */
export function OAuthPages() {
  const location = useLocation();
  return (
    <Base>
      <Show
        when={location.pathname.startsWith("/oauth2/authorized")}
        fallback={<Consent />}
      >
        <AuthorizedApps />
      </Show>
    </Base>
  );
}

function Consent() {
  const { t } = useLingui();
  const describeError = useError();
  const client = useClient();
  const location = useLocation();
  const permissionNames = usePermissionNames();
  const params = () => new URLSearchParams(location.search);

  const [preview] = createResource(
    () => location.search,
    (search) => oauthApi.preview(client(), search),
  );
  const [server, setServer] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const scopeText = (scope: string) => {
    switch (scope) {
      case "identify":
        return t`Know your username and avatar`;
      case "servers.read":
        return t`See the names and icons of your servers`;
      case "applications.commands":
        return t`Let its commands be used in the server`;
      case "bot.install":
        return t`Add its bot to a server you manage`;
      default:
        return scope;
    }
  };

  const installs = () => preview()?.scopes.includes("bot.install") ?? false;

  const failure = () => {
    const err = preview.error;
    if (!err) return undefined;
    return err instanceof InteractionError && err.type === "FailedValidation"
      ? t`This authorization link is not valid.`
      : err instanceof InteractionError
        ? describeError(err)
        : t`This authorization link is not valid.`;
  };

  async function decide(approve: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const value = (name: string) => params().get(name) ?? "";
      const body: API.DataAuthorize = {
        client_id: value("client_id"),
        redirect_uri: value("redirect_uri"),
        response_type: value("response_type"),
        scope: value("scope"),
        state: value("state"),
        code_challenge: value("code_challenge"),
        code_challenge_method: value("code_challenge_method"),
        approve,
      };
      if (approve && installs()) body.server_id = server();
      const permissions = params().get("permissions");
      if (permissions) body.permissions = Number(permissions);
      const { redirect } = await oauthApi.decide(client(), body);
      // The server only answers with the app's registered redirect URI
      window.location.assign(redirect);
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof InteractionError
          ? err.type === "MissingPermission"
            ? t`You can't give the bot permissions you don't have in that server.`
            : err.type === "AlreadyInServer"
              ? t`The bot is already in that server.`
              : describeError(err)
          : t`Something went wrong.`,
      );
    }
  }

  return (
    <Card>
      <Switch>
        <Match when={preview.loading}>
          <Muted>
            <Trans>Loading…</Trans>
          </Muted>
        </Match>
        <Match when={failure()}>
          <Icon name="warning" size={28} />
          <h1>
            <Trans>Can't continue</Trans>
          </h1>
          <ErrorText role="alert">{failure()}</ErrorText>
        </Match>
        <Match when={preview()}>
          {(data) => (
            <>
              <Header>
                <Avatar
                  size={64}
                  src={
                    client().users.get(data().application._id)
                      ?.animatedAvatarURL
                  }
                  fallback={data().application.username}
                />
                <h1>
                  {data().application.display_name ??
                    data().application.username}
                  <Show when={data().verified}>
                    {" "}
                    <Icon name="seal-check" size={18} />
                  </Show>
                </h1>
                <Muted>
                  <Trans>wants to access your Zrzur account</Trans>
                </Muted>
              </Header>

              <Show when={data().description}>
                <Description>{data().description}</Description>
              </Show>

              <Section>
                <h2>
                  <Trans>This will allow it to:</Trans>
                </h2>
                <ul>
                  <For each={data().scopes}>
                    {(scope) => (
                      <li>
                        <Icon name="check" size={16} />
                        {scopeText(scope)}
                      </li>
                    )}
                  </For>
                </ul>
              </Section>

              <Show when={installs()}>
                <Section>
                  <label for="oauth-server">
                    <h2>
                      <Trans>Add to server</Trans>
                    </h2>
                  </label>
                  <Show
                    when={data().servers?.length}
                    fallback={
                      <Muted>
                        <Trans>
                          You don't manage any server it can be added to.
                        </Trans>
                      </Muted>
                    }
                  >
                    <FloatingSelect
                      id="oauth-server"
                      value={server() ?? ""}
                      onChange={(e) =>
                        setServer(e.currentTarget.value || undefined)
                      }
                    >
                      <MenuItem value="">{t`Choose a server…`}</MenuItem>
                      <For each={data().servers}>
                        {(item) => (
                          <MenuItem dir="auto" value={item._id}>
                            {item.name}
                          </MenuItem>
                        )}
                      </For>
                    </FloatingSelect>
                  </Show>
                  <Show when={data().permissions}>
                    {(bits) => {
                      const { listed, other } = permissionList(
                        bits(),
                        permissionNames,
                      );
                      return (
                        <>
                          <h2>
                            <Trans>The bot's permissions there:</Trans>
                          </h2>
                          <ul>
                            <For each={listed}>
                              {(name) => (
                                <li>
                                  <Icon name="shield" size={16} />
                                  {name}
                                </li>
                              )}
                            </For>
                            <Show when={other}>
                              <li>
                                <Icon name="shield" size={16} />
                                {t`Other permissions`}
                              </li>
                            </Show>
                          </ul>
                        </>
                      );
                    }}
                  </Show>
                </Section>
              </Show>

              <Muted>
                <Trans>
                  After you decide you will go to{" "}
                  {new URL(data().redirect_uri).host}. You can revoke this at
                  any time under Authorized apps.
                </Trans>
              </Muted>

              <Show when={error()}>
                <ErrorText role="alert">{error()}</ErrorText>
              </Show>

              <Actions>
                <Button
                  type="button"
                  disabled={busy()}
                  onClick={() => decide(false)}
                >
                  {t`Cancel`}
                </Button>
                <Button
                  type="button"
                  data-primary=""
                  disabled={busy() || (installs() && !server())}
                  onClick={() => decide(true)}
                >
                  {t`Authorize`}
                </Button>
              </Actions>
            </>
          )}
        </Match>
      </Switch>
    </Card>
  );
}

function AuthorizedApps() {
  const { t } = useLingui();
  const client = useClient();
  const [apps, { refetch }] = createResource(() =>
    oauthApi.authorized(client()),
  );
  const [confirming, setConfirming] = createSignal<string>();

  async function revoke(id: string) {
    if (confirming() !== id) {
      setConfirming(id);
      return;
    }
    setConfirming(undefined);
    await oauthApi.revoke(client(), id);
    refetch();
  }

  return (
    <Card data-wide="">
      <h1>
        <Trans>Authorized apps</Trans>
      </h1>
      <Muted>
        <Trans>
          Apps you allowed to use your account. Revoking one ends its access at
          once; bots it added stay in servers until their managers remove them.
        </Trans>
      </Muted>
      <Show
        when={apps()?.length}
        fallback={
          <Muted>
            <Trans>No apps yet.</Trans>
          </Muted>
        }
      >
        <List>
          <For each={apps()}>
            {(app) => (
              <li>
                <Avatar
                  size={36}
                  src={
                    client().users.get(app.application._id)?.animatedAvatarURL
                  }
                  fallback={app.application.username}
                />
                <div>
                  <strong>
                    {app.application.display_name ?? app.application.username}
                  </strong>
                  <Muted>{app.scopes.join(" · ")}</Muted>
                </div>
                <Button
                  type="button"
                  data-danger=""
                  onClick={() => revoke(app.application._id)}
                >
                  {confirming() === app.application._id
                    ? t`Confirm revoke`
                    : t`Revoke access`}
                </Button>
              </li>
            )}
          </For>
        </List>
      </Show>
    </Card>
  );
}

const Base = styled("main", {
  base: {
    width: "100%",
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    justifyContent: "center",
    padding: "32px 16px",
    color: "var(--z-fg-primary)",
  },
});

const Card = styled("section", {
  base: {
    width: "min(100%, 460px)",
    height: "fit-content",
    padding: "24px",
    borderRadius: "var(--z-radius, 12px)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    border: "1px solid var(--z-btn-surface-border)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "&[data-wide]": { width: "min(100%, 640px)" },
    "& h1": { fontSize: "20px", fontWeight: 700, margin: 0 },
    "& h2": {
      fontSize: "13px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
      margin: 0,
    },
    "& ul": {
      listStyle: "none",
      padding: 0,
      margin: 0,
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    "& li": { display: "flex", alignItems: "center", gap: "8px" },
  },
});

const Header = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
  },
});

const Description = styled("p", {
  base: { color: "var(--z-fg-secondary)", margin: 0, overflowWrap: "anywhere" },
});

const Section = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "10px" },
});

const Actions = styled("div", {
  base: { display: "flex", justifyContent: "flex-end", gap: "8px" },
});

const Button = styled("button", {
  base: {
    minHeight: "36px",
    paddingInline: "16px",
    borderRadius: "var(--z-radius, 8px)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    border: "1px solid var(--z-btn-surface-border)",
    fontWeight: 600,
    cursor: "pointer",
    "&[data-primary]": {
      background: "var(--z-accent-fill, var(--z-accent))",
      color: "var(--z-on-accent)",
      borderColor: "transparent",
    },
    "&[data-danger]": { color: "var(--z-danger)" },
    _disabled: { opacity: 0.5, cursor: "not-allowed" },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const List = styled("ul", {
  base: {
    "& li": {
      padding: "8px 0",
      borderBlockStart: "1px solid var(--z-border-subtle)",
    },
    "& li > div": {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    },
  },
});

const Muted = styled("span", {
  base: { color: "var(--z-fg-muted)", fontSize: "13px" },
});

const ErrorText = styled("div", { base: { color: "var(--z-danger)" } });
