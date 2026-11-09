import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Bot } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  interactionApi,
  oauthApi,
} from "@revolt/app/interface/channels/text/interactions";
import { ViewBot } from "@revolt/app/interface/settings/user/bots";
import { CommandManager } from "@revolt/app/interface/settings/user/bots/CommandManager";
import type { RegisteredCommand } from "@revolt/app/interface/settings/user/bots/commandForm";
import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useLocation, useNavigate } from "@revolt/routing";
import { Avatar, FloatingSelect, Header, MenuItem } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { usePermissionNames } from "./OAuth";
import { HeaderIcon } from "./common/CommonHeader";

const TABS = ["overview", "commands", "oauth2"] as const;
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

  const tabs = (): { id: Tab; label: string }[] => [
    { id: "overview", label: t`Overview` },
    { id: "commands", label: t`Commands` },
    { id: "oauth2", label: t`OAuth2` },
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
      {/* /developers/docs has its own route outside the app (index.tsx) */}
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
                href="/developers/docs"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/developers/docs");
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
                      </Muted>
                    </div>
                  </AppHeader>
                  <Tabs role="tablist">
                    <For each={tabs()}>
                      {(item) => (
                        <TabButton
                          role="tab"
                          type="button"
                          aria-selected={tab() === item.id}
                          onClick={() =>
                            navigate(`/developers/${bot().id}/${item.id}`)
                          }
                        >
                          {item.label}
                        </TabButton>
                      )}
                    </For>
                  </Tabs>
                  {/* rebuilt for each bot: nothing of the previous bot (its
                      intents, a half-edited command) stays on screen */}
                  <Show when={selectedId()} keyed>
                    <Switch>
                      <Match when={tab() === "overview"}>
                        <ViewBot
                          bot={bot()}
                          onDelete={() => {
                            refetch();
                            navigate("/developers");
                          }}
                        />
                      </Match>
                      <Match when={tab() === "commands"}>
                        <Commands bot={bot()} />
                      </Match>
                      <Match when={tab() === "oauth2"}>
                        <OAuth2 bot={bot()} />
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

function CopyField(props: { label: string; value: string }) {
  const { t } = useLingui();
  const [copied, setCopied] = createSignal(false);
  return (
    <Field>
      <span>{props.label}</span>
      <FieldRow>
        <code>{props.value}</code>
        <SmallButton
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(props.value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied() ? t`Copied` : t`Copy`}
        </SmallButton>
      </FieldRow>
    </Field>
  );
}

/**
 * The Commands tab: the form editor for the bot's global commands. Saving
 * sends the whole list (PUT), deleting uses the command's own route; both
 * are the routes a bot uses itself.
 */
function Commands(props: { bot: Bot }) {
  const client = useClient();
  const permissionNames = usePermissionNames();
  const [commands, { refetch }] = createResource(
    () => props.bot.id,
    (id) => interactionApi.commands(client(), id),
  );

  return (
    <Section>
      <CommandManager
        commands={
          commands.state === "ready"
            ? (commands() as RegisteredCommand[])
            : undefined
        }
        permissionNames={permissionNames}
        save={async (list) => {
          await interactionApi.syncCommands(
            client(),
            props.bot.id,
            list as Parameters<typeof interactionApi.syncCommands>[2],
          );
          await refetch();
        }}
        reload={async () => ((await refetch()) ?? []) as RegisteredCommand[]}
        remove={async (id) => {
          await interactionApi.deleteCommand(client(), props.bot.id, id);
          await refetch();
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

  const text = () => uris() ?? settings()?.redirect_uris.join("\n") ?? "";

  async function save() {
    setError(undefined);
    try {
      const list = text()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      mutate(await oauthApi.editRedirects(client(), props.bot.id, list));
      setUris(undefined);
    } catch (err) {
      setError(describeError(err));
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
    <Section>
      <CopyField label={t`Client ID`} value={props.bot.id} />
      <Field>
        <span>{t`Redirect URIs (one per line, https or http://localhost)`}</span>
        <TextArea
          rows={4}
          dir="ltr"
          spellcheck={false}
          value={text()}
          onInput={(e) => setUris(e.currentTarget.value)}
        />
      </Field>
      <div>
        <SmallButton
          type="button"
          disabled={uris() === undefined}
          onClick={save}
        >
          {t`Save redirect URIs`}
        </SmallButton>
      </div>
      <Card>
        <h3>
          <Trans>Client secret</Trans>
        </h3>
        <p>
          {settings()?.has_secret
            ? t`A secret exists. Resetting it stops the old one at once.`
            : t`No secret yet: the app is a public client and must use PKCE (it always must).`}
        </p>
        <Show when={secret()}>
          <CopyField
            label={t`New secret: copy it now, it is not shown again`}
            value={secret()!}
          />
        </Show>
        <SmallButton type="button" data-danger="" onClick={resetSecret}>
          {settings()?.has_secret ? t`Reset secret` : t`Create secret`}
        </SmallButton>
      </Card>
      <Show when={error()}>
        <ErrorText role="alert">{error()}</ErrorText>
      </Show>
      <UrlGenerator
        bot={props.bot}
        redirects={settings()?.redirect_uris ?? []}
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
 * Builds the link that sends people to the consent screen. PKCE values and
 * `state` change per sign-in, so the app fills them in.
 */
function UrlGenerator(props: { bot: Bot; redirects: string[] }) {
  const { t } = useLingui();
  const permissionNames = usePermissionNames();
  const [scopes, setScopes] = createSignal<string[]>([
    "bot.install",
    "applications.commands",
  ]);
  const [permissions, setPermissions] = createSignal(
    // view channels, read history, send messages, send embeds
    2 ** 20 + 2 ** 21 + 2 ** 22 + 2 ** 26,
  );
  const [redirect, setRedirect] = createSignal<string>();

  const has = (bit: number) => Math.floor(permissions() / bit) % 2 === 1;
  const toggleScope = (scope: string) =>
    setScopes((list) =>
      list.includes(scope)
        ? list.filter((s) => s !== scope)
        : SCOPES.filter((s) => s === scope || list.includes(s)),
    );

  // only installing the bot (no sign-in scopes): a plain invite link that
  // works when opened, no redirect or PKCE needed
  const installOnly = () =>
    scopes().includes("bot.install") &&
    scopes().every((s) => s === "bot.install" || s === "applications.commands");
  const inviteUrl = () =>
    `${window.location.origin}/bot/${props.bot.id}${
      permissions() ? `?permissions=${permissions()}` : ""
    }`;

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
    <Card>
      <h3>
        <Trans>URL generator</Trans>
      </h3>
      <DocsLink href="/developers/docs/oauth2">
        <Trans>How OAuth2 sign-in works</Trans>
      </DocsLink>
      <Group>
        <legend>{t`Scopes`}</legend>
        <Checks>
          <For each={SCOPES}>
            {(scope) => (
              <Check>
                <input
                  type="checkbox"
                  checked={scopes().includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                <code>{scope}</code>
              </Check>
            )}
          </For>
        </Checks>
      </Group>
      <Show when={scopes().includes("bot.install")}>
        <Group>
          <legend>{t`Bot permissions`}</legend>
          <Checks>
            <For each={permissionNames}>
              {([bit, name]) => (
                <Check>
                  <input
                    type="checkbox"
                    checked={has(bit)}
                    onChange={() =>
                      setPermissions((value) =>
                        has(bit) ? value - bit : value + bit,
                      )
                    }
                  />
                  <span>{name}</span>
                </Check>
              )}
            </For>
          </Checks>
        </Group>
      </Show>
      <Show when={installOnly()}>
        <CopyField label={t`Invite link`} value={inviteUrl()} />
        <Muted>
          <Trans>
            Share this link: it opens Zrzur, the person picks a server and the
            bot joins with the permissions above.
          </Trans>
        </Muted>
      </Show>
      <Show
        when={!installOnly() && props.redirects.length}
        fallback={
          <Show when={!installOnly()}>
            <Muted>
              <Trans>Add a redirect URI above to generate the URL.</Trans>
            </Muted>
          </Show>
        }
      >
        <Show when={props.redirects.length > 1}>
          <Field>
            <span>{t`Redirect URI`}</span>
            <div dir="ltr">
              <FloatingSelect
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
          </Field>
        </Show>
        <CopyField label={t`Generated URL`} value={url()} />
        <Muted>
          <Trans>
            For your app's sign-in: the app puts a new state and code challenge
            into it for every sign-in. Opened as it is, the link does not work.
          </Trans>
        </Muted>
      </Show>
    </Card>
  );
}

/** Link to the docs page that explains a tab, instead of repeating it */
function DocsLink(props: { href: string; children: JSX.Element }) {
  const navigate = useNavigate();
  return (
    <DocsAnchor
      href={props.href}
      onClick={(event) => {
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
    _rtl: { "& .end": { transform: "scaleX(-1)" } },
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
    _rtl: { "& svg": { transform: "scaleX(-1)" } },
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

const Tabs = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    overflowX: "auto",
  },
});

const TabButton = styled("button", {
  base: {
    padding: "8px 12px",
    background: "none",
    border: "none",
    borderBlockEnd: "2px solid transparent",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    "&[aria-selected=true]": {
      color: "var(--z-fg-primary)",
      borderBlockEndColor: "var(--z-accent)",
    },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    maxWidth: "860px",
    "& p": { color: "var(--z-fg-secondary)", lineHeight: 1.5 },
    "& ol": { paddingInlineStart: "20px", lineHeight: 1.8 },
  },
});

const Card = styled("div", {
  base: {
    padding: "14px 16px",
    borderRadius: "var(--z-radius, 8px)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    border: "1px solid var(--z-btn-surface-border)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "flex-start",
    "& h3": { fontSize: "15px", fontWeight: 600, margin: 0 },
    "& p": { margin: 0 },
  },
});

const Field = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    // long content (a redirect URI) is cut, it never widens the card
    minWidth: 0,
    maxWidth: "100%",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const FieldRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    "& code": {
      flex: 1,
      minWidth: 0,
      padding: "6px 10px",
      borderRadius: "6px",
      background: "var(--z-bg-input)",
      fontWeight: 400,
      overflowWrap: "anywhere",
      userSelect: "all",
    },
    "& button": { flexShrink: 0 },
  },
});

const SmallButton = styled("button", {
  base: {
    minHeight: "30px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius, 8px)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    border: "1px solid var(--z-btn-surface-border)",
    cursor: "pointer",
    fontWeight: 600,
    "&[data-danger]": { color: "var(--z-danger)" },
    _disabled: { opacity: 0.5, cursor: "not-allowed" },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const TextArea = styled("textarea", {
  base: {
    width: "100%",
    fontFamily: "monospace",
    fontSize: "13px",
    fontWeight: 400,
    padding: "8px 10px",
    borderRadius: "var(--z-radius, 8px)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    border: "1px solid var(--z-field-border)",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Muted = styled("span", { base: { color: "var(--z-fg-muted)" } });

const Group = styled("fieldset", {
  base: {
    border: "none",
    margin: 0,
    padding: 0,
    width: "100%",
    "& legend": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-muted)",
      marginBlockEnd: "6px",
    },
  },
});

const Checks = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "6px 16px",
  },
});

const Check = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    "& input": {
      accentColor: "var(--z-accent)",
      width: "16px",
      height: "16px",
    },
  },
});

const ErrorText = styled("div", { base: { color: "var(--z-danger)" } });
