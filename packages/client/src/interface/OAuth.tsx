import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import {
  InteractionError,
  oauthApi,
} from "@revolt/app/interface/channels/text/interactions";
import { useScopeText } from "@revolt/app/interface/settings/user/oauthScopes";
import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import {
  Allow,
  Body,
  BotName,
  Divider,
  Dots,
  Facts,
  Hint,
  Lead,
  NameLine,
  Pair,
  Panel,
  PanelTitle,
  Who,
} from "@revolt/modal/modals/consentParts";
import { Navigate, useLocation, useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar, Dialog, FloatingSelect, MenuItem, Time } from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
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
  const navigate = useNavigate();
  const params = () => new URLSearchParams(location.search);

  const [preview] = createResource(
    () => location.search,
    (search) => oauthApi.preview(client(), search),
  );
  const [server, setServer] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const scopeText = useScopeText();

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

  const cancel = () => {
    if (!busy() && preview()) void decide(false);
  };

  // the same dialog, parts and order as adding a bot (AddBot.tsx)
  return (
    <Switch>
      <Match when={preview.loading}>
        <Dialog size="sm" show onClose={() => navigate("/app")}>
          <Lead>
            <Trans>Loading…</Trans>
          </Lead>
        </Dialog>
      </Match>
      <Match when={failure()}>
        <Dialog
          size="sm"
          show
          onClose={() => navigate("/app")}
          actions={[{ text: <Trans>Close</Trans> }]}
        >
          <Body>
            <Who>
              <Icon name="warning" size={28} />
              <BotName>
                <Trans>Can't continue</Trans>
              </BotName>
              <Lead role="alert">{failure()}</Lead>
            </Who>
          </Body>
        </Dialog>
      </Match>
      <Match when={preview()}>
        {(data) => (
          <Dialog
            size="sm"
            show
            onClose={cancel}
            isDisabled={busy()}
            actions={[
              {
                text: <Trans>Cancel</Trans>,
                onClick: () => {
                  cancel();
                  return false;
                },
              },
              {
                text: <Trans>Authorize</Trans>,
                onClick: () => {
                  void decide(true);
                  return false;
                },
                isDisabled: busy() || (installs() && !server()),
                isLoading: busy(),
              },
            ]}
          >
            <Body data-oauth-consent>
              <Pair aria-hidden="true">
                <Avatar
                  size={64}
                  src={
                    client().users.get(data().application._id)
                      ?.animatedAvatarURL ??
                    `${client().options.baseURL}/users/${data().application._id}/default_avatar`
                  }
                  fallback={data().application.username}
                />
                <Dots>
                  <span />
                  <span />
                  <span />
                </Dots>
                <Avatar
                  size={64}
                  src={client().user?.animatedAvatarURL}
                  fallback={
                    client().user?.displayName ?? client().user?.username
                  }
                />
              </Pair>
              <Who>
                <NameLine>
                  <BotName>
                    {data().application.display_name ??
                      data().application.username}
                  </BotName>
                  <BotLabel verified={data().verified} />
                </NameLine>
                <Lead>
                  <Trans>wants to access your Zrzur account</Trans>
                </Lead>
              </Who>

              <Panel>
                <PanelTitle>
                  <Trans>This will allow it to:</Trans>
                </PanelTitle>
                <Allow>
                  <For each={data().scopes}>
                    {(scope) => (
                      <li>
                        <Icon name="check-circle" size={18} />
                        {scopeText(scope)}
                      </li>
                    )}
                  </For>
                </Allow>

                <Show when={data().description}>
                  <Hint>{data().description}</Hint>
                </Show>

                <Show when={installs()}>
                  <Divider />
                  <label for="oauth-server">
                    <PanelTitle>
                      <Trans>Add to server</Trans>
                    </PanelTitle>
                  </label>
                  <Show
                    when={data().servers?.length}
                    fallback={
                      <Hint>
                        <Trans>
                          You don't manage any server it can be added to.
                        </Trans>
                      </Hint>
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
                          <PanelTitle>
                            <Trans>The bot's permissions there:</Trans>
                          </PanelTitle>
                          <Allow>
                            <For each={listed}>
                              {(name) => (
                                <li>
                                  <Icon name="shield" size={18} />
                                  {name}
                                </li>
                              )}
                            </For>
                            <Show when={other}>
                              <li>
                                <Icon name="shield" size={18} />
                                {t`Other permissions`}
                              </li>
                            </Show>
                          </Allow>
                        </>
                      );
                    }}
                  </Show>
                </Show>

                <Divider />
                <Facts>
                  <li>
                    <Icon name="shield-check" size={16} />
                    <Show
                      when={data().verified}
                      fallback={
                        <Trans>This bot is not verified by Zrzur.</Trans>
                      }
                    >
                      <Trans>Zrzur verified who runs this bot.</Trans>
                    </Show>
                  </li>
                  <li>
                    <Icon name="arrow-square-out" size={16} />
                    <Trans>
                      After you decide you will go to{" "}
                      {new URL(data().redirect_uri).host}. You can revoke this
                      at any time under Connected apps.
                    </Trans>
                  </li>
                  <li>
                    <Icon name="clock" size={16} />
                    <Trans>
                      Registered since{" "}
                      <Time
                        format="calendar"
                        value={decodeTime(data().application._id)}
                      />
                    </Trans>
                  </li>
                </Facts>
              </Panel>

              <Show when={error()}>
                <Lead role="alert" style={{ color: "var(--z-danger)" }}>
                  {error()}
                </Lead>
              </Show>
            </Body>
          </Dialog>
        )}
      </Match>
    </Switch>
  );
}

/**
 * Old links to the authorized apps page open Connected apps in settings,
 * over the page the user was last on
 */
function AuthorizedApps() {
  const { openModal } = useModals();
  const state = useState();
  onMount(() =>
    openModal({
      type: "settings",
      config: "user",
      context: { page: "connected-apps" },
    }),
  );
  return <Navigate href={state.layout.getLastActivePath()} />;
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
