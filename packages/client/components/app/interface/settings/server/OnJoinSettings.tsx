import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Markdown } from "@revolt/markdown";
import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Text,
  TextField,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  MAX_ROLES,
  MAX_WELCOME,
  MEMBER,
  SERVER,
  type OnJoin,
  type OnJoinDraft,
  bodyOf,
  channelLink,
  deadChannelNames,
  draftOf,
  insertAt,
  isPowerful,
  previewOf,
  problemOf,
  toggleRole,
} from "./onJoin";
import { useSaved } from "./savedNotice";

/**
 * When someone joins: roles everyone gets, and a welcome message. Both are
 * applied by the server on every way of joining (an invite, Discover, an
 * approved request) and never to bots. Roles need Manage Roles, the message
 * needs Manage Server; the server checks both, and that nobody hands out a
 * role at or above their own.
 */
export function OnJoinSettings(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const saved = useSaved();
  const path = () => `/servers/${props.server.id}/on_join`;

  const canRoles = () => props.server.havePermission("ManageRole");
  const canMessage = () => props.server.havePermission("ManageServer");

  const [stored, { mutate }] = createResource(
    () => props.server.id,
    async () => (await client().api.get(path() as never)) as OnJoin,
  );
  const [draft, setDraft] = createSignal<OnJoinDraft>();
  const [confirmed, setConfirmed] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  let box: HTMLTextAreaElement | undefined;

  const now = (): OnJoinDraft => draft() ?? draftOf(stored());
  const change = (part: Partial<OnJoinDraft>) => {
    setError(undefined);
    setDraft({ ...now(), ...part });
  };
  const dirty = () =>
    JSON.stringify(bodyOf(now(), false)) !==
    JSON.stringify(bodyOf(draftOf(stored()), false));

  // only roles a person hands out: a bot's own role belongs to the bot
  const roles = () => props.server.orderedRoles.filter((role) => !role.owner);
  const powerful = () =>
    roles().filter(
      (role) => now().roles.includes(role.id) && isPowerful(role.permissions?.a),
    );
  const textChannels = () =>
    props.server.channels.filter(
      (channel) => channel.type === "TextChannel" && !channel.voice,
    );
  const problem = () => problemOf(now());
  const dead = () =>
    now().welcomeOn
      ? deadChannelNames(
          now().content,
          textChannels().map((channel) => channel.name ?? ""),
        )
      : [];
  const blocked = () =>
    !dirty() || pending() || !!problem() || (powerful().length > 0 && !confirmed());

  function insert(token: string) {
    const start = box?.selectionStart ?? now().content.length;
    const end = box?.selectionEnd ?? start;
    const { value, caret } = insertAt(now().content, token, start, end);
    change({ content: value });
    queueMicrotask(() => {
      box?.focus();
      box?.setSelectionRange(caret, caret);
    });
  }

  async function save() {
    if (blocked()) return;
    setPending(true);
    setError(undefined);
    try {
      const answer = (await client().api.put(
        path() as never,
        bodyOf(now(), confirmed()) as never,
      )) as OnJoin;
      mutate(answer);
      setDraft(undefined);
      setConfirmed(false);
      saved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Show
      when={!stored.error}
      fallback={
        <SettingsSection>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            title={
              <span role="alert">
                <TranslatedError error={stored.error} />
              </span>
            }
          />
        </SettingsSection>
      }
    >
      <SettingsSection
        title={<Trans>Roles for everyone who joins</Trans>}
        description={
          <Trans>
            Given the moment someone becomes a member, whichever way they
            came in. Bots get none. Up to {MAX_ROLES} roles.
          </Trans>
        }
      >
        <Inside data-on-join="roles">
          <Show
            when={roles().length}
            fallback={
              <Text class="label" size="small">
                <Trans>This server has no roles yet. Make one in Roles first.</Trans>
              </Text>
            }
          >
            <Chips role="group" aria-label={t`Roles for everyone who joins`}>
              <For each={roles()}>
                {(role) => (
                  <Chip
                    type="button"
                    disabled={!canRoles() || pending()}
                    aria-pressed={now().roles.includes(role.id)}
                    onClick={() => {
                      setConfirmed(false);
                      change({ roles: toggleRole(now().roles, role.id) });
                    }}
                  >
                    <RoleDot style={{ background: role.colour ?? undefined }} />
                    {role.name}
                    <Show when={isPowerful(role.permissions?.a)}>
                      <Icon name="warning" size={14} aria-label={t`Can manage or moderate`} />
                    </Show>
                  </Chip>
                )}
              </For>
            </Chips>
          </Show>
          <Show when={powerful().length}>
            <Warning role="alert" data-on-join="powerful">
              <Icon name="warning" size={20} aria-hidden="true" />
              <div>
                <strong>
                  <Trans>
                    Everyone who joins would be able to manage or moderate
                  </Trans>
                </strong>
                <p>
                  <Trans>
                    {powerful()
                      .map((role) => role.name)
                      .join(", ")}{" "}
                    can change the server or act on other members. A stranger
                    with an invite link gets it too.
                  </Trans>
                </p>
                <Check>
                  <Toggle
                    checked={confirmed()}
                    disabled={pending()}
                    aria-labelledby="on-join-powerful-yes"
                    onChange={() => setConfirmed(!confirmed())}
                  />
                  <span id="on-join-powerful-yes">
                    <Trans>Give it to everyone anyway</Trans>
                  </span>
                </Check>
              </div>
            </Warning>
          </Show>
          <Show when={!canRoles()}>
            <Text class="label" size="small">
              <Trans>Choosing these roles needs the Manage Roles permission.</Trans>
            </Text>
          </Show>
        </Inside>
      </SettingsSection>

      <SettingsSection
        title={<Trans>Welcome message</Trans>}
        description={
          <Trans>
            Posted by Zrzur in a channel you pick when someone joins. Nobody
            is notified.
          </Trans>
        }
      >
        <SettingsRow
          icon={<Icon name="hand-waving" size={20} />}
          title={<Trans>Post a welcome message</Trans>}
          description={
            <Show
              when={now().welcomeOn}
              fallback={<Trans>Off. Nothing is posted when someone joins.</Trans>}
            >
              <Trans>
                On. When many people join at once, the first ten of each
                minute are welcomed.
              </Trans>
            </Show>
          }
          onClick={
            canMessage() && !pending()
              ? () => change({ welcomeOn: !now().welcomeOn })
              : undefined
          }
          control={(ids) => (
            <Toggle
              checked={now().welcomeOn}
              disabled={!canMessage() || pending()}
              aria-labelledby={ids.labelId}
              onChange={() => change({ welcomeOn: !now().welcomeOn })}
            />
          )}
        />
        <Show when={now().welcomeOn}>
          <SettingsRow
            icon={<Icon name="hash" size={20} />}
            title={<Trans>Channel</Trans>}
            description={<Trans>Where the message appears.</Trans>}
            control={(ids) => (
              <SelectWidth>
                <FloatingSelect
                  aria-labelledby={ids.labelId}
                  value={now().channel || "none"}
                  disabled={!canMessage() || pending()}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    change({ channel: value === "none" ? "" : value });
                  }}
                >
                  <MenuItem value="none">
                    <Trans>Choose a channel</Trans>
                  </MenuItem>
                  <For each={textChannels()}>
                    {(channel) => (
                      <MenuItem value={channel.id}>{channel.name}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </SelectWidth>
            )}
          />
          <Inside data-on-join="message">
            <TextField
              ref={(el) => {
                box = el as unknown as HTMLTextAreaElement;
              }}
              aria-label={t`Welcome message`}
              autosize
              min-rows={2}
              maxlength={MAX_WELCOME}
              counter
              disabled={!canMessage() || pending()}
              value={now().content}
              placeholder={t`Welcome ${MEMBER} to ${SERVER}!`}
              onInput={(e) => change({ content: e.currentTarget.value })}
            />
            <Chips role="group" aria-label={t`Add to the message`}>
              <Chip type="button" disabled={!canMessage()} onClick={() => insert(MEMBER)}>
                <Icon name="at" size={14} aria-hidden="true" />
                <Trans>The member</Trans>
              </Chip>
              <Chip type="button" disabled={!canMessage()} onClick={() => insert(SERVER)}>
                <Icon name="house" size={14} aria-hidden="true" />
                <Trans>The server's name</Trans>
              </Chip>
              <SelectWidth>
                <FloatingSelect
                  aria-label={t`Add a channel link`}
                  value="none"
                  disabled={!canMessage() || pending()}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    if (value !== "none") insert(channelLink(value));
                    e.currentTarget.value = "none";
                  }}
                >
                  <MenuItem value="none">
                    <Trans>Add a channel link</Trans>
                  </MenuItem>
                  <For each={textChannels()}>
                    {(channel) => (
                      <MenuItem value={channel.id}>{channel.name}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </SelectWidth>
            </Chips>
            <Show when={dead().length}>
              <Hint role="status" data-on-join="dead-link">
                <Trans>
                  #{dead()[0]} typed like this is plain text, not a link. Use
                  "Add a channel link" so people can tap it.
                </Trans>
              </Hint>
            </Show>
            <Show when={now().content.trim()}>
              <PreviewLabel>
                <Trans>As a new member sees it</Trans>
              </PreviewLabel>
              <Preview data-on-join="preview">
                <Markdown
                  content={previewOf(
                    now().content.trim(),
                    client().user?.id ?? "",
                    props.server.name,
                  )}
                />
              </Preview>
            </Show>
            <Show when={problem() === "channel"}>
              <Text class="label" size="small">
                <Trans>Choose a channel for the message.</Trans>
              </Text>
            </Show>
          </Inside>
        </Show>
      </SettingsSection>

      <Show when={dirty() || error()}>
        <SettingsSection>
          <Inside>
            <Show when={error()}>
              <ErrorText role="alert">
                <TranslatedError error={error()} />
              </ErrorText>
            </Show>
            <Actions>
              <Button
                variant="tonal"
                isDisabled={pending()}
                onPress={() => {
                  setDraft(undefined);
                  setConfirmed(false);
                  setError(undefined);
                }}
              >
                <Trans>Discard</Trans>
              </Button>
              <Button isDisabled={blocked()} onPress={save} data-on-join="save">
                <Trans>Save</Trans>
              </Button>
            </Actions>
          </Inside>
        </SettingsSection>
      </Show>
    </Show>
  );
}

const Inside = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    _phone: { padding: "12px" },
  },
});

const SelectWidth = styled("div", {
  base: { width: "min(260px, 100%)" },
});

const Chips = styled("div", {
  base: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" },
});

const Chip = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "34px",
    paddingInline: "12px",
    borderRadius: "999px",
    border: "1px solid var(--z-border-subtle)",
    background: "none",
    color: "var(--z-fg-secondary)",
    fontFamily: "inherit",
    fontSize: "14px",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _disabled: { cursor: "default", opacity: 0.6 },
    _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
    "&[aria-pressed=true]": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 16%, transparent)",
      color: "var(--z-fg-primary)",
    },
    "& svg": { color: "var(--z-warning)" },
    _phone: { minHeight: "44px" },
  },
});

const RoleDot = styled("span", {
  base: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "var(--z-fg-muted)",
  },
});

const Warning = styled("div", {
  base: {
    display: "flex",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-warning)",
    color: "var(--z-fg-primary)",
    "& > svg": { flex: "none", color: "var(--z-warning)" },
    "& strong": { display: "block", fontWeight: 600 },
    "& p": { margin: "4px 0 0", fontSize: "13px", color: "var(--z-fg-secondary)" },
  },
});

const Check = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "44px",
    marginBlockStart: "8px",
    fontSize: "14px",
  },
});

const Hint = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-warning)" },
});

const PreviewLabel = styled("span", {
  base: { fontSize: "12px", fontWeight: 700, color: "var(--z-fg-secondary)" },
});

const Preview = styled("div", {
  base: {
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const Actions = styled("div", {
  base: { display: "flex", justifyContent: "flex-end", gap: "8px" },
});

const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger)" },
});
