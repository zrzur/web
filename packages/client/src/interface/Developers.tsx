import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Bot, Client } from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import {
  interactionApi,
  oauthApi,
} from "@revolt/app/interface/channels/text/interactions";
import { Discoverable } from "@revolt/app/interface/settings/shared/Discoverable";
import {
  BotAccess,
  BotGeneral,
  BotVerificationTab,
} from "@revolt/app/interface/settings/user/bots";
import { CommandManager } from "@revolt/app/interface/settings/user/bots/CommandManager";
import type { RegisteredCommand } from "@revolt/app/interface/settings/user/bots/commandForm";
import { useClient } from "@revolt/client";
import { CONFIGURATION } from "@revolt/common";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { getBotLink } from "@revolt/modal/modals/inviteLink";
import { useLocation, useNavigate } from "@revolt/routing";
import {
  Avatar,
  Button,
  Checkbox,
  Column,
  FloatingSelect,
  Header,
  LineTabs,
  MenuItem,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { usePermissionNames } from "./OAuth";
import { HeaderIcon } from "./common/CommonHeader";
import { docsLinkFromApp } from "./developers/docs/links";

// "overview" is General: old links keep working
const TABS = [
  "overview",
  "bot",
  "commands",
  "install",
  "oauth2",
  "verification",
  "discover",
] as const;
type Tab = (typeof TABS)[number];

/**
 * Developer Portal: the one place for the user's applications (bots) and,
 * under /developers/docs, the one place that explains how to build them.
 * Bot pages link to the docs instead of repeating them. Tokens are never
 * shown; they can only be copied or reset.
 */
export function Developers() {
  const client = useClient();
  const navigate = useNavigate();
  const docs = () =>
    docsLinkFromApp("/developers/docs", CONFIGURATION.DOCS_URL);
  const location = useLocation();
  const { openModal } = useModals();
  const { t } = useLingui();

  // the header chevron leaves the portal: back where the user came from,
  // or home when the portal was opened directly
  const goBack = () =>
    window.history.length > 1 ? navigate(-1) : navigate("/app");

  const [bots, { refetch }] = createResource(() => client().bots.fetchOwned());

  const segments = () => location.pathname.split("/");
  const selectedId = () => segments()[2];
  // old links to removed tabs open the overview
  const tab = (): Tab => TABS.find((id) => id === segments()[3]) ?? "overview";
  const selected = () => bots()?.find((bot) => bot.id === selectedId());
  // a bot's commands are read as it opens, so its Commands tab shows them
  // at once
  createEffect(() => {
    const bot = selected();
    if (bot) readCommands(client(), bot.id).catch(() => undefined);
  });

  const tabs = (): { id: Tab; label: string }[] => [
    { id: "overview", label: t`General` },
    { id: "bot", label: t`Bot` },
    { id: "commands", label: t`Commands` },
    { id: "install", label: t`Install` },
    { id: "oauth2", label: t`OAuth2` },
    { id: "verification", label: t`Verification` },
    { id: "discover", label: t`Discover` },
  ];

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon onBack={goBack}>
          <Icon name="code" size={22} />
        </HeaderIcon>
        <Title>
          <Trans>Developer Portal</Trans>
        </Title>
      </Header>
      {/* the documentation is its own site (VITE_DOCS_URL), or the route
          /developers/docs outside the app interface (app.tsx) */}
      {/* one column, like Designs: the home sidebar stays the only one */}
      <Main>
        <Page>
          <Switch>
            <Match when={bots.loading}>
              <Muted>
                <Trans>Loading…</Trans>
              </Muted>
            </Match>
            <Match when={!selected()}>
              <Intro>
                <h1>
                  <Trans>Build bots for Zrzur</Trans>
                </h1>
                <p>
                  <Trans>
                    An application is a bot account. Create one, register slash
                    commands, and answer them with buttons, menus, forms and
                    private replies.
                  </Trans>
                </p>
              </Intro>

              <DocsCard
                href={docs().href}
                target={docs().external ? "_blank" : undefined}
                rel={docs().external ? "noopener" : undefined}
                onClick={(event) => {
                  // the documentation site opens beside the app
                  if (docs().external) return;
                  event.preventDefault();
                  navigate(docs().href);
                }}
              >
                <Icon name="books" size={24} />
                <span>
                  <strong>
                    <Trans>Documentation</Trans>
                  </strong>
                  <Muted>
                    <Trans>
                      Guides, tutorials and the full Bot API reference.
                    </Trans>
                  </Muted>
                </span>
                <Icon name="caret-right" size={16} class="end" />
              </DocsCard>

              <SectionHead>
                <h2>
                  <Trans>My applications</Trans>
                </h2>
                <PrimaryButton
                  type="button"
                  onClick={() =>
                    openModal({
                      type: "create_bot",
                      client: client(),
                      onCreate: (bot) => {
                        refetch();
                        navigate(`/developers/${bot.id}`);
                      },
                    })
                  }
                >
                  <Icon name="plus" size={16} />
                  <Trans>New application</Trans>
                </PrimaryButton>
              </SectionHead>
              <Show
                when={bots()?.length}
                fallback={
                  <Muted>
                    <Trans>
                      No applications yet. Create one to get a bot account and
                      its token.
                    </Trans>
                  </Muted>
                }
              >
                <AppGrid>
                  <For each={bots()}>
                    {(bot) => (
                      <AppCard
                        href={`/developers/${bot.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`/developers/${bot.id}`);
                        }}
                      >
                        <Avatar
                          size={40}
                          src={bot.user?.animatedAvatarURL}
                          fallback={bot.user?.username}
                        />
                        <span>
                          <strong>
                            {bot.user?.displayName ?? bot.user?.username}
                          </strong>
                          <Muted>
                            {bot.public
                              ? t`Public application`
                              : t`Private application`}
                          </Muted>
                        </span>
                      </AppCard>
                    )}
                  </For>
                </AppGrid>
              </Show>
            </Match>
            <Match when={selected()}>
              {(bot) => (
                <>
                  <BackButton
                    type="button"
                    onClick={() => navigate("/developers")}
                  >
                    <Icon name="caret-left" size={16} />
                    <Trans>My applications</Trans>
                  </BackButton>
                  <AppHeader>
                    <Avatar
                      size={48}
                      src={bot().user?.animatedAvatarURL}
                      fallback={bot().user?.username}
                    />
                    <div>
                      <h2>{bot().user?.displayName ?? bot().user?.username}</h2>
                      <Muted>
                        {bot().public
                          ? t`Public application`
                          : t`Private application`}
                        {" · "}
                        {/* the one place of the ID: it is also the OAuth2
                            client ID, so every tab shows it here */}
                        <IdCopy id={bot().id} />
                      </Muted>
                    </div>
                  </AppHeader>
                  {/* every part of the bot one click away, each in one
                      place (owner, 2026-11-27) */}
                  <LineTabs
                    aria-label={t`Application`}
                    ruled
                    class={tabRow}
                    value={tab()}
                    onChange={(id) => navigate(`/developers/${bot().id}/${id}`)}
                    options={tabs().map((item) => ({
                      value: item.id,
                      label: item.label,
                    }))}
                  />
                  {/* rebuilt for each bot: nothing of the previous bot (its
                      intents, a half-edited command) stays on screen */}
                  <Show when={selectedId()} keyed>
                    <Switch>
                      <Match when={tab() === "overview"}>
                        <BotGeneral
                          bot={bot()}
                          onDelete={() => {
                            refetch();
                            navigate("/developers");
                          }}
                        />
                      </Match>
                      <Match when={tab() === "bot"}>
                        <BotAccess bot={bot()} />
                      </Match>
                      <Match when={tab() === "commands"}>
                        <Commands bot={bot()} />
                      </Match>
                      <Match when={tab() === "install"}>
                        <Install bot={bot()} />
                      </Match>
                      <Match when={tab() === "oauth2"}>
                        <OAuth2 bot={bot()} />
                      </Match>
                      <Match when={tab() === "verification"}>
                        <BotVerificationTab bot={bot()} />
                      </Match>
                      <Match when={tab() === "discover"}>
                        <Discoverable discoverable={bot()} />
                      </Match>
                    </Switch>
                  </Show>
                </>
              )}
            </Match>
          </Switch>
        </Page>
      </Main>
    </Base>
  );
}

/** The application ID, copied with a click */
function IdCopy(props: { id: string }) {
  const { t } = useLingui();
  const [copied, setCopied] = createSignal(false);
  return (
    <IdButton
      type="button"
      dir="ltr"
      aria-label={t`Copy application ID`}
      title={t`Copy application ID`}
      onClick={() =>
        void navigator.clipboard.writeText(props.id).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      <code>{props.id}</code>
      <Icon name={copied() ? "check" : "copy"} size={14} />
    </IdButton>
  );
}

/** A value to copy, as a settings row: its name, the value, a Copy button */
function CopyRow(props: {
  icon: JSX.Element;
  title: JSX.Element;
  value: string;
  hint?: JSX.Element;
}) {
  const [copied, setCopied] = createSignal(false);
  return (
    <SettingsRow
      icon={props.icon}
      title={props.title}
      description={
        <>
          <Value dir="ltr">{props.value}</Value>
          <Show when={props.hint}>
            <br />
            {props.hint}
          </Show>
        </>
      }
      control={() => (
        <Button
          size="sm"
          variant="tonal"
          onPress={() =>
            void navigator.clipboard.writeText(props.value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          <Show when={copied()} fallback={<Trans>Copy</Trans>}>
            <Trans>Copied</Trans>
          </Show>
        </Button>
      )}
    />
  );
}

/** Ticks for the bot's permissions, in two or three columns */
function PermissionPicker(props: {
  value: number;
  onChange: (value: number) => void;
}) {
  const permissionNames = usePermissionNames();
  const has = (bit: number) => Math.floor(props.value / bit) % 2 === 1;
  return (
    <Checks>
      <For each={permissionNames}>
        {([bit, name]) => (
          <Checkbox
            checked={has(bit)}
            onChange={() =>
              props.onChange(has(bit) ? props.value - bit : props.value + bit)
            }
          >
            {name}
          </Checkbox>
        )}
      </For>
    </Checks>
  );
}

// view channels, read history, send messages, send embeds
const DEFAULT_PERMISSIONS = 2 ** 20 + 2 ** 21 + 2 ** 22 + 2 ** 26;

/**
 * Install: add the bot to a server now, or build the invite link others
 * open, with the permissions it asks for
 */
function Install(props: { bot: Bot }) {
  const { openModal } = useModals();
  const [permissions, setPermissions] = createSignal(DEFAULT_PERMISSIONS);
  const inviteUrl = () =>
    getBotLink(
      props.bot.id,
      { href: (path) => `${window.location.origin}${path}` },
      permissions(),
    );

  return (
    <Column gap="xl">
      <SettingsSection>
        <SettingsRow
          icon={<Icon name="user-plus" size={20} />}
          title={<Trans>Add to a server</Trans>}
          description={<Trans>Choose one of your servers.</Trans>}
          onClick={() =>
            openModal({ type: "add_bot", invite: props.bot.publicBot })
          }
          navigational
        />
      </SettingsSection>
      <SettingsSection
        title={<Trans>Invite link</Trans>}
        description={
          <Trans>
            Whoever opens it picks a server, and the bot joins with these
            permissions.
          </Trans>
        }
      >
        <SettingsFormPanel>
          <PermissionPicker value={permissions()} onChange={setPermissions} />
        </SettingsFormPanel>
        <CopyRow
          icon={<Icon name="link" size={20} />}
          title={<Trans>Link</Trans>}
          value={inviteUrl()}
        />
      </SettingsSection>
    </Column>
  );
}

/**
 * The Commands tab: the form editor for the bot's global commands. Saving
 * sends the whole list (PUT), deleting uses the command's own route; both
 * are the routes a bot uses itself.
 */
/**
 * Each bot's commands as last read. The tab shows them at once and checks
 * with the server behind them: every visit and every save used to empty
 * the list into "Loading…" for a round trip (owner, 2026-11-27).
 */
const commandCache = new Map<string, RegisteredCommand[]>();
const commandRequests = new Map<string, Promise<RegisteredCommand[]>>();

/** Read a bot's commands (one request at a time per bot) and keep them */
function readCommands(client: Client, botId: string) {
  let request = commandRequests.get(botId);
  if (!request) {
    request = interactionApi
      .commands(client, botId)
      .then((list) => {
        const commands = list as RegisteredCommand[];
        commandCache.set(botId, commands);
        return commands;
      })
      .finally(() => commandRequests.delete(botId));
    commandRequests.set(botId, request);
  }
  return request;
}

function Commands(props: { bot: Bot }) {
  const client = useClient();
  const permissionNames = usePermissionNames();
  // eslint-disable-next-line solid/reactivity
  const [commands, setCommands] = createSignal(commandCache.get(props.bot.id));

  const load = async () => {
    const fresh = await readCommands(client(), props.bot.id);
    setCommands(fresh);
    return fresh;
  };
  // a failed refresh keeps what is shown; a first read that fails shows
  // the error of the next action instead of an endless wait
  onMount(() => void load().catch(() => undefined));

  return (
    <Section>
      <CommandManager
        commands={commands()}
        permissionNames={permissionNames}
        save={async (list) => {
          await interactionApi.syncCommands(
            client(),
            props.bot.id,
            list as Parameters<typeof interactionApi.syncCommands>[2],
          );
          await load();
        }}
        reload={load}
        remove={async (id) => {
          await interactionApi.deleteCommand(client(), props.bot.id, id);
          await load();
        }}
        docsLink={
          <DocsLink href="/developers/docs/commands#register">
            <Trans>How commands work</Trans>
          </DocsLink>
        }
      />
    </Section>
  );
}

const SCOPES = [
  "identify",
  "servers.read",
  "applications.commands",
  "bot.install",
] as const;

/**
 * OAuth2: sign in with Zrzur from your own app. Where people come back to,
 * the secret, and the sign-in link with its scopes.
 */
function OAuth2(props: { bot: Bot }) {
  const { t } = useLingui();
  const describeError = useError();
  const client = useClient();
  const { mfaFlow } = useModals();
  const [settings, { mutate }] = createResource(
    () => props.bot.id,
    (id) => oauthApi.settings(client(), id),
  );
  const [uris, setUris] = createSignal<string>();
  const [secret, setSecret] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  const text = () => uris() ?? settings()?.redirect_uris.join("\n") ?? "";

  async function save() {
    setError(undefined);
    setBusy(true);
    try {
      const list = text()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      mutate(await oauthApi.editRedirects(client(), props.bot.id, list));
      setUris(undefined);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetSecret() {
    setError(undefined);
    const ticket = await mfaFlow(await client().account.mfa());
    if (!ticket) return;
    try {
      const result = await oauthApi.resetSecret(
        client(),
        props.bot.id,
        ticket.token,
      );
      setSecret(result.client_secret);
      mutate({ ...settings()!, has_secret: true });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Column gap="xl">
      <Muted>
        <Trans>
          Let people sign in to your app with Zrzur. The client ID is the
          application ID above.
        </Trans>{" "}
        <DocsLink href="/developers/docs/oauth2">
          <Trans>How OAuth2 sign-in works</Trans>
        </DocsLink>
      </Muted>

      <SettingsSection>
        <Show
          when={secret()}
          fallback={
            <SettingsRow
              icon={<Icon name="key" size={20} />}
              title={<Trans>Client secret</Trans>}
              description={
                settings()?.has_secret
                  ? t`A new secret stops the old one at once.`
                  : t`None yet. Without one, your app must use PKCE.`
              }
              control={() => (
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() => void resetSecret()}
                >
                  {settings()?.has_secret ? t`Reset secret` : t`Create secret`}
                </Button>
              )}
            />
          }
        >
          <CopyRow
            icon={<Icon name="key" size={20} />}
            title={<Trans>Client secret</Trans>}
            value={secret()!}
            hint={<Trans>Copy it now. It won't be shown again.</Trans>}
          />
        </Show>
      </SettingsSection>

      <SettingsSection
        title={<Trans>Redirects</Trans>}
        description={
          <Trans>
            Where people return after signing in. One per line: https, or
            http://localhost while you test.
          </Trans>
        }
      >
        <SettingsFormPanel>
          <TextField
            label={t`Redirect URIs`}
            rows={4}
            dir="ltr"
            spellcheck={false}
            value={text()}
            onInput={(e) => setUris(e.currentTarget.value)}
          />
          <Actions>
            <Button
              size="sm"
              variant="filled"
              isDisabled={uris() === undefined || busy()}
              onPress={() => void save()}
            >
              <Trans>Save</Trans>
            </Button>
          </Actions>
        </SettingsFormPanel>
      </SettingsSection>
      <Show when={error()}>
        <ErrorText role="alert">{error()}</ErrorText>
      </Show>

      <SignInLink bot={props.bot} redirects={settings()?.redirect_uris ?? []} />
    </Column>
  );
}

/**
 * The link that sends people to the consent screen. PKCE values and
 * `state` change per sign-in, so the app fills them in.
 */
function SignInLink(props: { bot: Bot; redirects: string[] }) {
  const { t } = useLingui();
  const [scopes, setScopes] = createSignal<string[]>(["identify"]);
  const [permissions, setPermissions] = createSignal(DEFAULT_PERMISSIONS);
  const [redirect, setRedirect] = createSignal<string>();

  const toggleScope = (scope: string) =>
    setScopes((list) =>
      list.includes(scope)
        ? list.filter((s) => s !== scope)
        : SCOPES.filter((s) => s === scope || list.includes(s)),
    );

  const url = () => {
    const query = [
      `client_id=${props.bot.id}`,
      `redirect_uri=${encodeURIComponent(redirect() ?? props.redirects[0] ?? "")}`,
      "response_type=code",
      `scope=${encodeURIComponent(scopes().join(" "))}`,
    ];
    if (scopes().includes("bot.install")) {
      query.push(`permissions=${permissions()}`);
    }
    query.push(
      "state={state}",
      "code_challenge={code_challenge}",
      "code_challenge_method=S256",
    );
    return `${window.location.origin}/oauth2/authorize?${query.join("&")}`;
  };

  return (
    <SettingsSection
      title={<Trans>Sign-in link</Trans>}
      description={
        <Trans>
          Your app adds a new state and code challenge for every sign-in, so the
          link doesn't work opened as it is.
        </Trans>
      }
    >
      <SettingsFormPanel>
        <Checks>
          <For each={SCOPES}>
            {(scope) => (
              <Checkbox
                checked={scopes().includes(scope)}
                onChange={() => toggleScope(scope)}
              >
                <code>{scope}</code>
              </Checkbox>
            )}
          </For>
        </Checks>
        <Show when={scopes().includes("servers.read")}>
          <ScopeWarning role="note">
            <Trans>
              The servers list shows servers the user is in. Check{" "}
              <code>can_manage</code> before letting them change settings.
            </Trans>
          </ScopeWarning>
        </Show>
        <Show when={scopes().includes("bot.install")}>
          <PermissionPicker value={permissions()} onChange={setPermissions} />
        </Show>
        <Show when={props.redirects.length > 1}>
          <div dir="ltr">
            <FloatingSelect
              aria-label={t`Redirect URI`}
              value={redirect() ?? props.redirects[0]}
              onChange={(e) => setRedirect(e.currentTarget.value)}
            >
              <For each={props.redirects}>
                {(uri) => (
                  <MenuItem dir="ltr" value={uri}>
                    {uri}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
          </div>
        </Show>
      </SettingsFormPanel>
      <Show
        when={props.redirects.length && scopes().length}
        fallback={
          <SettingsRow
            icon={<Icon name="link" size={20} />}
            title={<Trans>Add a redirect to get the link.</Trans>}
          />
        }
      >
        <CopyRow
          icon={<Icon name="link" size={20} />}
          title={<Trans>Link</Trans>}
          value={url()}
        />
      </Show>
    </SettingsSection>
  );
}

/** Link to the docs page that explains a tab, instead of repeating it */
function DocsLink(props: { href: string; children: JSX.Element }) {
  const navigate = useNavigate();
  const link = () => docsLinkFromApp(props.href, CONFIGURATION.DOCS_URL);
  return (
    <DocsAnchor
      href={link().href}
      target={link().external ? "_blank" : undefined}
      rel={link().external ? "noopener" : undefined}
      onClick={(event) => {
        if (link().external) return;
        event.preventDefault();
        navigate(props.href);
      }}
    >
      {props.children}
    </DocsAnchor>
  );
}

const DocsAnchor = styled("a", {
  base: {
    alignSelf: "flex-start",
    color: "var(--z-link)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    minHeight: "24px",
    _focusVisible: { outline: "2px solid var(--z-focus)", borderRadius: "2px" },
  },
});

const Base = styled("main", {
  base: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    color: "var(--z-fg-primary)",
  },
});

const Title = styled("span", { base: { fontSize: "16px", fontWeight: 600 } });

const Main = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    // the tab bar scrolls sideways; it must not shrink away on long pages
    "& > *": { flexShrink: 0 },
    mdDown: { padding: "16px" },
  },
});

/** Centered column of the portal, like Designs */
const Page = styled("div", {
  base: {
    width: "100%",
    maxWidth: "960px",
    marginInline: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& > *": { flexShrink: 0 },
  },
});

const Intro = styled("header", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& h1": { margin: 0, fontSize: "24px", fontWeight: 700 },
    "& p": { margin: 0, color: "var(--z-fg-secondary)", maxWidth: "640px" },
  },
});

/** The way into the documentation, above the applications */
const DocsCard = styled("a", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    minHeight: "72px",
    borderRadius: "var(--z-radius-lg, 12px)",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-border-subtle)",
    color: "var(--z-fg-primary)",
    textDecoration: "none",
    minWidth: 0,
    "& > span": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: 0,
    },
    "& strong": { fontWeight: 600, overflowWrap: "anywhere" },
    _hover: { background: "var(--z-btn-surface-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > svg:first-child": { color: "var(--z-accent-text)", flexShrink: 0 },
    "& .end": {
      marginInlineStart: "auto",
      flexShrink: 0,
      color: "var(--z-fg-muted)",
    },
    // direction icons turn by themselves in right-to-left (styles.css)
  },
});

const SectionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBlockStart: "8px",
    "& h2": { margin: 0, fontSize: "18px", fontWeight: 650 },
  },
});

/** The one primary action of the landing page */
const PrimaryButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "36px",
    padding: "0 14px",
    borderRadius: "var(--z-radius-md, 8px)",
    border: "none",
    background: "var(--z-btn-primary-bg)",
    color: "var(--z-on-accent)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    _hover: { background: "var(--z-btn-primary-hover)" },
    _active: { background: "var(--z-btn-pressed)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const AppGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "12px",
  },
});

const AppCard = styled("a", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    minHeight: "72px",
    borderRadius: "var(--z-radius-lg, 12px)",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-border-subtle)",
    color: "var(--z-fg-primary)",
    textDecoration: "none",
    minWidth: 0,
    "& > span": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: 0,
    },
    "& strong": { fontWeight: 600, overflowWrap: "anywhere" },
    _hover: { background: "var(--z-btn-surface-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/** Back from an application to the list */
const BackButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    alignSelf: "flex-start",
    minHeight: "32px",
    padding: "0 8px",
    marginInlineStart: "-8px",
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "none",
    background: "none",
    color: "var(--z-accent-text)",
    fontSize: "15px",
    cursor: "pointer",
    _hover: { background: "var(--z-hover)" },
    _phone: { minHeight: "44px" },
    // the arrow points back in reading direction
    // direction icons turn by themselves in right-to-left (styles.css)
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const AppHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    "& h2": { fontSize: "20px", fontWeight: 700, margin: 0 },
  },
});

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    "& p": { color: "var(--z-fg-secondary)", lineHeight: 1.5 },
    "& ol": { paddingInlineStart: "20px", lineHeight: 1.8 },
  },
});

const Muted = styled("span", { base: { color: "var(--z-fg-muted)" } });

/** A short warning next to a scope: amber edge, the text stays readable */
const ScopeWarning = styled("p", {
  base: {
    margin: 0,
    padding: "8px 12px",
    borderRadius: "var(--z-radius, 8px)",
    borderInlineStart: "4px solid var(--z-status-warning)",
    background: "color-mix(in srgb, var(--z-status-warning) 12%, transparent)",
    color: "var(--z-fg)",
  },
});

const Checks = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "6px 16px",
  },
});

const ErrorText = styled("div", { base: { color: "var(--z-danger)" } });

/** the bot's tabs: on a narrow screen the row scrolls sideways */
const tabRow = css({
  overflowX: "auto",
  "& > button": { flexShrink: 0 },
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
});

/** a value to copy: an ID, a link */
const Value = styled("code", {
  base: {
    fontSize: "12px",
    overflowWrap: "anywhere",
    color: "var(--z-fg-secondary)",
  },
});

/** a form's one action, at its end */
const Actions = styled("div", {
  base: { display: "flex", justifyContent: "flex-end" },
});

const IdButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 6px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    "& code": { fontSize: "12px" },
    _hover: { background: "var(--z-bg-raised)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus, var(--z-accent))" },
  },
});
