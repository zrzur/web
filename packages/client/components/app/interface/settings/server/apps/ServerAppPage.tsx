import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { localized } from "@revolt/app/interface/channels/text/interactions/types";
import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { askedGroups } from "@revolt/modal/modals/addBotPermissions";
import { usePermissionTitles } from "@revolt/modal/modals/permissionTitles";
import { Avatar, Button, SettingsRow, SettingsSection } from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../../Settings";
import { ConfirmDialog } from "../ConfirmDialog";
import { Anchor, PageStack } from "../layout";

import { RulesEditor } from "./RulesEditor";
import { serverAppsApi } from "./api";

/**
 * Server settings → Apps → one bot: who added it and when, what it may do
 * (its role and scopes), its commands here and who may use them, and
 * Remove (the app is uninstalled, not just kicked).
 */
export function ServerAppPage(props: { server: Server; appId: string }) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const { navigate } = useSettingsNavigation();
  const titles = usePermissionTitles();
  const describeError = useError();
  const [removing, setRemoving] = createSignal(false);

  const [data] = createResource(
    () => [props.server.id, props.appId] as const,
    async ([serverId, appId]) => {
      // every command of the app here, unfiltered: managers see them all
      const [installs, commands] = await Promise.all([
        serverAppsApi.installed(client(), serverId),
        serverAppsApi.commands(client(), serverId, appId),
      ]);
      if (!client().users.get(appId)) {
        await client()
          .users.fetch(appId)
          .catch(() => undefined);
      }
      return {
        install: installs.find((entry) => entry.application._id === appId),
        commands: commands.sort(
          (a, b) =>
            a.name.localeCompare(b.name) ||
            Number(!!a.server_id) - Number(!!b.server_id),
        ),
      };
    },
  );

  // the rules, on their own: a failure here is shown, never read as
  // "no rules", and the editors stay locked until they load
  const [rules, { refetch: reloadRules }] = createResource(
    () => [props.server.id, props.appId] as const,
    ([serverId, appId]) => serverAppsApi.rules(client(), serverId, appId),
  );

  const user = () => client().users.get(props.appId);
  const member = () =>
    client().serverMembers.getByKey({
      server: props.server.id,
      user: props.appId,
    });
  const role = () =>
    props.server.orderedRoles.find((entry) => entry.owner === props.appId);
  const installer = () => {
    const id = data()?.install?.installed_by;
    return id ? client().users.get(id) : undefined;
  };
  const granted = () =>
    askedGroups(data()?.install?.permissions ?? 0).flatMap((group) =>
      group.bits.map((bit) => titles.name(bit)),
    );
  const rulesReady = () => !rules.loading && !rules.error && !!rules();
  const rulesFor = (commandId?: string) =>
    (rulesReady() ? rules()! : []).find(
      (entry) => (entry.command_id ?? undefined) === commandId,
    )?.permissions ?? [];
  const date = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(i18n().locale, { dateStyle: "long" }).format(
          new Date(value),
        )
      : "";
  const [open, setOpen] = createSignal<string>();

  return (
    <PageStack data-testid="server-app-page">
      <Header>
        <Avatar
          size={48}
          src={user()?.animatedAvatarURL}
          fallback={user()?.username ?? "?"}
        />
        <HeaderText>
          <TitleLine>
            <strong dir="auto">
              {user()?.displayName ?? user()?.username}
            </strong>
            <BotLabel
              official={user()?.officialBot}
              verified={user()?.verifiedBot}
            />
          </TitleLine>
          <Switch>
            <Match when={data()?.install}>
              {(install) => (
                <span>
                  <Show
                    when={installer()}
                    fallback={
                      <Trans>Added on {date(install().installed_at)}</Trans>
                    }
                  >
                    <Trans>
                      Added by{" "}
                      <bdi>
                        {installer()!.displayName ?? installer()!.username}
                      </bdi>{" "}
                      on {date(install().installed_at)}
                    </Trans>
                  </Show>
                </span>
              )}
            </Match>
            <Match when={member()}>
              <span>
                <Trans>
                  Added before Zrzur kept a record of who adds apps.
                </Trans>
              </span>
            </Match>
          </Switch>
        </HeaderText>
        <Show when={props.server.havePermission("ManageServer")}>
          <Button size="sm" variant="_error" onPress={() => setRemoving(true)}>
            <Icon name="trash" size={16} />
            <Trans>Remove app</Trans>
          </Button>
        </Show>
      </Header>

      <Show when={data.error}>
        <SettingsSection>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            title={<Trans>Couldn't load this app.</Trans>}
          />
        </SettingsSection>
      </Show>

      <Anchor
        id="access"
        title={<Trans>What it can do</Trans>}
        description={
          <Trans>
            The permissions it was given when it was added, through its own
            role.
          </Trans>
        }
      >
        <SettingsSection>
          <Show
            when={granted().length}
            fallback={
              <SettingsRow
                icon={<Icon name="info" size={20} />}
                title={
                  <Trans>No permissions were given when it was added.</Trans>
                }
              />
            }
          >
            <SettingsRow
              icon={<Icon name="key" size={20} />}
              title={<Trans>Permissions</Trans>}
              description={granted().join(" · ")}
            />
          </Show>
          <Show when={role()}>
            {(role) => (
              <SettingsRow
                icon={<Icon name="shield" size={20} />}
                title={<Trans>Role: {role().name}</Trans>}
                description={
                  <Trans>
                    Managed by the app. Change what it may do in the role.
                  </Trans>
                }
                navigational
                onClick={() => navigate(`roles/${role().id}`)}
              />
            )}
          </Show>
          <Show when={data()?.install?.scopes.length}>
            <SettingsRow
              icon={<Icon name="list-checks" size={20} />}
              title={<Trans>Scopes</Trans>}
              description={
                <Chips>
                  <For each={data()!.install!.scopes}>
                    {(scope) => <code dir="ltr">{scope}</code>}
                  </For>
                </Chips>
              }
            />
          </Show>
        </SettingsSection>
      </Anchor>

      <Anchor
        id="commands"
        title={<Trans>Commands and who can use them</Trans>}
        description={
          <Trans>
            Rules for one command come before the rules for the whole app. A
            rule for a member beats their roles, a Deny on any of their roles
            beats an Allow on another, and Everyone counts last.
          </Trans>
        }
      >
        <Show when={rules.error}>
          <SettingsSection>
            <SettingsRow
              danger
              icon={<Icon name="warning-circle" size={20} />}
              title={
                <Trans>
                  The rules couldn't be loaded, so they can't be changed now.
                </Trans>
              }
              description={describeError(rules.error)}
              control={() => (
                <Button size="sm" variant="tonal" onPress={reloadRules}>
                  <Trans>Try again</Trans>
                </Button>
              )}
            />
          </SettingsSection>
        </Show>
        <Show when={rules.loading}>
          <SettingsSection>
            <SettingsRow title={<Trans>Loading…</Trans>} />
          </SettingsSection>
        </Show>
        <Show when={data() && rulesReady()}>
          <SettingsSection title={<Trans>All commands</Trans>}>
            <RulesEditor
              server={props.server}
              label={t`Rules for all commands`}
              rules={rulesFor(undefined)}
              onSave={(rules) =>
                serverAppsApi.saveRules(
                  client(),
                  props.server.id,
                  props.appId,
                  undefined,
                  rules,
                )
              }
            />
          </SettingsSection>
          <SettingsSection>
            <Show
              when={data()!.commands.length}
              fallback={
                <SettingsRow
                  icon={<Icon name="info" size={20} />}
                  title={<Trans>This app has no commands here.</Trans>}
                />
              }
            >
              <For each={data()!.commands}>
                {(command) => (
                  <>
                    <SettingsRow
                      icon={<Icon name="terminal" size={20} />}
                      title={
                        <bdi dir="ltr">
                          {command.type === "ChatInput" ? "/" : ""}
                          {localized(
                            command.name,
                            command.name_localizations,
                            i18n().locale,
                          )}
                        </bdi>
                      }
                      secondary={
                        command.server_id ? (
                          <ScopeTag>
                            <Trans>This server only</Trans>
                          </ScopeTag>
                        ) : undefined
                      }
                      description={
                        <CommandMeta
                          rules={rulesFor(command._id).length}
                          description={localized(
                            command.description ?? "",
                            command.description_localizations,
                            i18n().locale,
                          )}
                        />
                      }
                      navigational
                      onClick={() =>
                        setOpen((id) =>
                          id === command._id ? undefined : command._id,
                        )
                      }
                    />
                    <Show when={open() === command._id}>
                      <RulesEditor
                        server={props.server}
                        label={t`Rules for ${command.name}`}
                        rules={rulesFor(command._id)}
                        onSave={(rules) =>
                          serverAppsApi.saveRules(
                            client(),
                            props.server.id,
                            props.appId,
                            command._id,
                            rules,
                          )
                        }
                      />
                    </Show>
                  </>
                )}
              </For>
            </Show>
          </SettingsSection>
        </Show>
      </Anchor>

      <Show when={removing()}>
        <ConfirmDialog
          title={<Trans>Remove this app?</Trans>}
          confirm={<Trans>Remove app</Trans>}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await serverAppsApi.remove(client(), props.server.id, props.appId);
            setRemoving(false);
            navigate("apps");
          }}
        >
          <Trans>
            The bot leaves the server. Its role, its commands here and their
            rules go too. You can add it again later.
          </Trans>
        </ConfirmDialog>
      </Show>
    </PageStack>
  );
}

/** A command's own description, and how many rules it has */
function CommandMeta(props: { description: string; rules: number }) {
  return (
    <>
      <span dir="auto">{props.description}</span>
      <Show when={props.rules}>
        {" · "}
        <Plural value={props.rules} one="# rule" other="# rules" />
      </Show>
    </>
  );
}

const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px 16px",
    padding: "16px",
    borderRadius: "var(--z-radius-lg)",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-card-border)",
    minWidth: 0,
  },
});

const HeaderText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: "1 1 200px",
    minWidth: 0,
    "& > span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const TitleLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
    "& strong": {
      fontSize: "18px",
      lineHeight: "24px",
      color: "var(--z-fg-primary)",
      overflowWrap: "anywhere",
    },
  },
});

/** A command registered for this server only, next to its global twin */
const ScopeTag = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "20px",
    paddingInline: "8px",
    borderRadius: "var(--z-radius-pill)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    whiteSpace: "nowrap",
  },
});

const Chips = styled("span", {
  base: {
    display: "inline-flex",
    flexWrap: "wrap",
    gap: "4px",
    "& code": {
      paddingInline: "8px",
      borderRadius: "var(--z-radius-pill)",
      background: "var(--z-bg-raised)",
      fontSize: "12px",
      lineHeight: "20px",
    },
  },
});
