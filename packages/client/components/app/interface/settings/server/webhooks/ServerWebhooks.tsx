import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel, ChannelWebhook, Server } from "@zrzur/sdk/solid";
import { createFormControl } from "solid-forms";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Avatar,
  Button,
  Dialog,
  FloatingSelect,
  Form2,
  MenuItem,
  Segmented,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { Icon } from "@revolt/ui/icons/Icon";

import { channelLabel } from "../channels/channelLabel";
import { useSaved } from "../savedNotice";
import { type WebhookMaker, filterWebhooks } from "./webhookFilter";
import { WEBHOOK_NAME_MAX, webhookNameProblem } from "./webhookName";

/** Server settings: every webhook of the server */
export function ServerWebhooks(props: { server: Server }) {
  return <WebhooksPanel server={props.server} />;
}

/**
 * Webhooks in one place: all of a server, or one channel's. The server checks
 * Manage Webhooks per channel. A token is shown once, when it is made: it is
 * stored as a hash, so a lost address can only be replaced.
 */
export function WebhooksPanel(props: { server?: Server; channel?: Channel }) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const describeError = useError();
  const saved = useSaved();
  const instance = useInstance();

  // Without features.webhooks in the root response the routes are not there
  const available = () =>
    (instance.config.features as { webhooks?: boolean }).webhooks === true;

  const channels = () =>
    props.channel
      ? [props.channel]
      : (props.server?.channels.filter(
          (channel) =>
            channel.type === "TextChannel" &&
            !channel.isVoiceRoom &&
            channel.havePermission("ManageWebhooks"),
        ) ?? []);

  const [version, setVersion] = createSignal(0);
  const [hooks] = createResource(
    () => (available() ? ([version()] as const) : undefined),
    async () => {
      const webhooks = props.channel
        ? await props.channel.fetchWebhooks()
        : await client().channelWebhooks.fetchForServer(props.server!.id);
      // names for "created by"
      const creators = [...new Set(webhooks.map((hook) => hook.creatorId))];
      await Promise.all(
        creators.map((id) =>
          client()
            .users.fetch(id)
            .catch(() => undefined),
        ),
      );
      return webhooks;
    },
  );
  const refresh = () => setVersion((n) => n + 1);

  // all webhooks, or only those a bot (or a person) made
  const [maker, setMaker] = createSignal<WebhookMaker>("all");
  const madeByBot = (id: string) => !!client().users.get(id)?.bot;

  // Newest first, grouped by channel
  const groups = createMemo(() => {
    const byChannel = new Map<string, ChannelWebhook[]>();
    for (const hook of filterWebhooks(hooks() ?? [], maker(), madeByBot)) {
      if (!byChannel.has(hook.channelId)) byChannel.set(hook.channelId, []);
      byChannel.get(hook.channelId)!.push(hook);
    }
    return [...byChannel.entries()].map(([id, webhooks]) => ({
      id,
      name: client().channels.get(id)?.name ?? id,
      webhooks,
    }));
  });

  const date = (value: Date) =>
    new Intl.DateTimeFormat(i18n().locale, {
      dateStyle: "medium",
    }).format(value);

  function facts(webhook: ChannelWebhook) {
    const creator =
      client().users.get(webhook.creatorId)?.displayName ?? webhook.creatorId;
    const made = date(webhook.createdAt);
    const used = webhook.lastUsed;
    return used
      ? t`Created by ${creator} on ${made}. Last used ${date(used)}.`
      : t`Created by ${creator} on ${made}. Not used yet.`;
  }

  // ----- messages under the list -----
  const [status, setStatus] = createSignal<string>();
  const [actionError, setActionError] = createSignal<string>();

  function report(message?: string, error?: unknown) {
    setStatus(message);
    setActionError(error === undefined ? undefined : describeError(error));
  }

  // ----- create -----
  const [channelId, setChannelId] = createSignal("");
  const [name, setName] = createSignal("");
  const [createError, setCreateError] = createSignal<string>();
  const [creating, setCreating] = createSignal(false);
  const target = () =>
    channels().find((channel) => channel.id === channelId()) ?? channels()[0];
  const problem = () => webhookNameProblem(name());
  const longName = t`Use at most ${WEBHOOK_NAME_MAX} characters.`;
  const nameError = () => {
    if (createError()) return createError();
    if (!name().trim()) return undefined;
    return problem() === "long" ? longName : undefined;
  };

  // ----- the address, shown once -----
  const [fresh, setFresh] = createSignal<{ name: string; url: string }>();
  const [copied, setCopied] = createSignal(false);

  async function copyAddress(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function create(event?: Event) {
    event?.preventDefault();
    const channel = target();
    if (!channel || creating() || problem()) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const webhook = await channel.createWebhook(name().trim());
      setName("");
      if (webhook.url) setFresh({ name: webhook.name, url: webhook.url });
      refresh();
    } catch (err) {
      setCreateError(describeError(err));
    } finally {
      setCreating(false);
    }
  }

  // ----- edit -----
  const [editing, setEditing] = createSignal<ChannelWebhook>();
  const [editName, setEditName] = createSignal("");
  const [editChannel, setEditChannel] = createSignal("");
  const [editError, setEditError] = createSignal<string>();
  const avatar = createFormControl<string | File[] | null>(null);

  function startEdit(webhook: ChannelWebhook) {
    setEditName(webhook.name);
    setEditChannel(webhook.channelId);
    setEditError(undefined);
    avatar.setValue(webhook.avatarURL ?? null);
    avatar.markDirty(false);
    setEditing(webhook);
  }

  async function saveEdit() {
    const webhook = editing();
    if (!webhook || webhookNameProblem(editName())) throw new Error("name");
    try {
      const changes: Parameters<ChannelWebhook["edit"]>[0] = { remove: [] };
      if (editName().trim() !== webhook.name) changes.name = editName().trim();
      if (editChannel() !== webhook.channelId) {
        changes.channel_id = editChannel();
      }
      if (avatar.isDirty) {
        if (!avatar.value) {
          changes.remove!.push("Avatar");
        } else if (Array.isArray(avatar.value)) {
          changes.avatar = await client().uploadFile(
            "avatars",
            avatar.value[0],
            instance.mediaUrl,
          );
        }
      }
      await webhook.edit(changes);
      saved();
      refresh();
    } catch (err) {
      // the reason shows next to the field and the dialog stays open
      setEditError(describeError(err));
      throw err;
    }
  }

  // ----- new address -----
  const [renewing, setRenewing] = createSignal<ChannelWebhook>();
  const [renewError, setRenewError] = createSignal<string>();

  async function confirmRenew() {
    const webhook = renewing();
    if (!webhook) return;
    try {
      const url = await webhook.regenerateToken();
      setFresh({ name: webhook.name, url });
      report();
    } catch (err) {
      setRenewError(describeError(err));
      throw err;
    }
  }

  // ----- test message -----
  const [testing, setTesting] = createSignal<string>();

  async function sendTest(webhook: ChannelWebhook) {
    setTesting(webhook.id);
    try {
      await webhook.sendTest(t`This is a test message.`);
      report(
        t`Test message sent to #${client().channels.get(webhook.channelId)?.name ?? ""}.`,
      );
      refresh();
    } catch (err) {
      report(undefined, err);
    } finally {
      setTesting(undefined);
    }
  }

  // ----- delete -----
  const [removing, setRemoving] = createSignal<ChannelWebhook>();
  const [removeError, setRemoveError] = createSignal<string>();

  async function confirmRemove() {
    const webhook = removing();
    if (!webhook) return;
    try {
      await webhook.delete();
      saved();
      refresh();
    } catch (err) {
      setRemoveError(describeError(err));
      throw err;
    }
  }

  return (
    <Stack>
      <Show
        when={available()}
        fallback={
          <SettingsSection>
            <SettingsRow
              icon={<Icon name="webhooks-logo" size={20} />}
              title={<Trans>Webhooks are switched off here.</Trans>}
              description={
                <Trans>
                  Whoever runs this Zrzur server can turn them on in its
                  configuration.
                </Trans>
              }
            />
          </SettingsSection>
        }
      >
        <SettingsSection
          title={<Trans>New webhook</Trans>}
          description={
            <Trans>
              A webhook posts into one channel through its address. The address
              is shown once, so keep it safe.
            </Trans>
          }
        >
          <SettingsFormPanel>
            <Show
              when={channels().length}
              fallback={
                <Trans>
                  There is no channel where you can manage webhooks.
                </Trans>
              }
            >
              <form onSubmit={create}>
                <Fields>
                  <Show when={!props.channel}>
                    <FloatingSelect
                      aria-label={t`Channel`}
                      value={target()?.id ?? ""}
                      onChange={(e) => setChannelId(e.currentTarget.value)}
                    >
                      <For each={channels()}>
                        {(channel: Channel) => (
                          <MenuItem value={channel.id}>
                            {channelLabel(channel.name)}
                          </MenuItem>
                        )}
                      </For>
                    </FloatingSelect>
                  </Show>
                  <TextField
                    label={t`Webhook name`}
                    maxlength={WEBHOOK_NAME_MAX}
                    counter
                    value={name()}
                    error={nameError()}
                    onInput={(e) => {
                      setName(e.currentTarget.value);
                      setCreateError(undefined);
                    }}
                  />
                  <div>
                    <Button
                      type="submit"
                      isDisabled={creating() || !!problem()}
                    >
                      <Trans>Create webhook</Trans>
                    </Button>
                  </div>
                </Fields>
              </form>
            </Show>
          </SettingsFormPanel>
        </SettingsSection>

        <Show when={status()}>
          <p role="status">{status()}</p>
        </Show>
        <Show when={actionError()}>
          <p role="alert">{actionError()}</p>
        </Show>

        <Switch>
          <Match when={hooks.error}>
            <SettingsSection>
              <SettingsRow
                icon={<Icon name="webhooks-logo" size={20} />}
                title={<Trans>The webhooks could not be loaded.</Trans>}
                description={describeError(hooks.error)}
                control={() => (
                  <Button size="sm" variant="tonal" onPress={refresh}>
                    <Trans>Try again</Trans>
                  </Button>
                )}
              />
            </SettingsSection>
          </Match>
          <Match when={hooks.loading && !hooks.latest}>
            <SettingsSection>
              <SettingsRow title={<Trans>Loading…</Trans>} />
            </SettingsSection>
          </Match>
          <Match when={hooks()?.length === 0}>
            <SettingsSection>
              <SettingsRow
                icon={<Icon name="webhooks-logo" size={20} />}
                title={<Trans>No webhooks yet.</Trans>}
                description={<Trans>Create one above.</Trans>}
              />
            </SettingsSection>
          </Match>
          <Match when={hooks()?.length}>
            <Show
              when={(hooks() ?? []).some((hook) => madeByBot(hook.creatorId))}
            >
              <MakerFilter>
                <Segmented
                  aria-label={t`Show webhooks made by`}
                  value={maker()}
                  options={[
                    { value: "all", label: t`All` },
                    { value: "bots", label: t`Made by bots` },
                    { value: "people", label: t`Made by people` },
                  ]}
                  onChange={setMaker}
                />
              </MakerFilter>
            </Show>
            <Show when={!groups().length}>
              <SettingsSection>
                <SettingsRow
                  icon={<Icon name="webhooks-logo" size={20} />}
                  title={<Trans>No webhooks match this filter.</Trans>}
                />
              </SettingsSection>
            </Show>
            <For each={groups()}>
              {(group) => (
                <SettingsSection
                  title={props.channel ? undefined : channelLabel(group.name)}
                >
                  <For each={group.webhooks}>
                    {(webhook) => (
                      <SettingsRow
                        icon={
                          <Avatar
                            src={webhook.avatarURL}
                            fallback={webhook.name}
                            size={24}
                          />
                        }
                        title={webhook.name}
                        description={
                          <>
                            {facts(webhook)}
                            <Show when={madeByBot(webhook.creatorId)}>
                              {" "}
                              <BotLabel
                                verified={
                                  client().users.get(webhook.creatorId)
                                    ?.verifiedBot
                                }
                              />
                            </Show>
                          </>
                        }
                        control={() => (
                          <Actions>
                            <Show when={webhook.url}>
                              <Button
                                size="sm"
                                variant="tonal"
                                onPress={() => copyAddress(webhook.url!)}
                              >
                                <Trans>Copy address</Trans>
                              </Button>
                            </Show>
                            <Button
                              size="sm"
                              variant="tonal"
                              onPress={() => startEdit(webhook)}
                            >
                              <Trans>Edit</Trans>
                            </Button>
                            <Button
                              size="sm"
                              variant="tonal"
                              isDisabled={testing() === webhook.id}
                              onPress={() => sendTest(webhook)}
                            >
                              <Trans>Send test</Trans>
                            </Button>
                            <Button
                              size="sm"
                              variant="tonal"
                              onPress={() => {
                                setRenewError(undefined);
                                setRenewing(webhook);
                              }}
                            >
                              <Trans>New address</Trans>
                            </Button>
                            <Button
                              size="sm"
                              variant="text"
                              onPress={() => {
                                setRemoveError(undefined);
                                setRemoving(webhook);
                              }}
                            >
                              <Trans>Delete</Trans>
                            </Button>
                          </Actions>
                        )}
                      />
                    )}
                  </For>
                </SettingsSection>
              )}
            </For>
          </Match>
        </Switch>
      </Show>

      <Show when={fresh()}>
        {(shown) => (
          <Dialog
            show
            size="sm"
            onClose={() => setFresh(undefined)}
            title={<Trans>Address of {shown().name}</Trans>}
            actions={[
              { text: <Trans>Done</Trans> },
              {
                text: copied() ? <Trans>Copied</Trans> : <Trans>Copy</Trans>,
                onClick: async () => {
                  await copyAddress(shown().url);
                  // the dialog closes on a resolved click: stay open here
                  throw new Error("stay");
                },
              },
            ]}
          >
            <Fields>
              <Trans>
                Copy it now: it is not shown again. Anyone who has it can post
                here, so keep it private.
              </Trans>
              <TextField
                label={t`Webhook address`}
                readonly
                dir="ltr"
                value={shown().url}
              />
            </Fields>
          </Dialog>
        )}
      </Show>

      <Show when={editing()}>
        {(webhook) => (
          <Dialog
            show
            size="sm"
            onClose={() => setEditing(undefined)}
            title={<Trans>Edit webhook</Trans>}
            actions={[
              { text: <Trans>Cancel</Trans> },
              {
                text: <Trans>Save</Trans>,
                isDisabled: !!webhookNameProblem(editName()),
                onClick: saveEdit,
              },
            ]}
          >
            <Fields>
              <Form2.FileInput
                control={avatar}
                accept="image/*"
                label={t`Webhook icon`}
                imageJustify={false}
                maxSize={instance.limits().file_upload_size_limits["icons"]}
              />
              <TextField
                label={t`Webhook name`}
                maxlength={WEBHOOK_NAME_MAX}
                counter
                value={editName()}
                error={editError()}
                onInput={(e) => {
                  setEditName(e.currentTarget.value);
                  setEditError(undefined);
                }}
              />
              <Show when={props.server && channels().length > 1}>
                <FloatingSelect
                  aria-label={t`Channel`}
                  value={editChannel()}
                  onChange={(e) => setEditChannel(e.currentTarget.value)}
                >
                  <For each={channels()}>
                    {(channel: Channel) => (
                      <MenuItem value={channel.id}>
                        {channelLabel(channel.name)}
                      </MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </Show>
              <span hidden>{webhook().id}</span>
            </Fields>
          </Dialog>
        )}
      </Show>

      <Show when={renewing()}>
        <Dialog
          show
          tone="danger"
          size="sm"
          onClose={() => setRenewing(undefined)}
          title={<Trans>Make a new address?</Trans>}
          actions={[
            { text: <Trans>Cancel</Trans> },
            { text: <Trans>Make new address</Trans>, onClick: confirmRenew },
          ]}
        >
          <Trans>
            The current address stops working at once. Anything that posts with
            it needs the new one.
          </Trans>
          <Show when={renewError()}>
            <span role="alert">{renewError()}</span>
          </Show>
        </Dialog>
      </Show>

      <Show when={removing()}>
        <Dialog
          show
          tone="danger"
          size="sm"
          onClose={() => setRemoving(undefined)}
          title={<Trans>Delete this webhook?</Trans>}
          actions={[
            { text: <Trans>Cancel</Trans> },
            { text: <Trans>Delete</Trans>, onClick: confirmRemove },
          ]}
        >
          <Trans>
            Anything that still posts with its address will stop working.
          </Trans>
          <Show when={removeError()}>
            <span role="alert">{removeError()}</span>
          </Show>
        </Dialog>
      </Show>
    </Stack>
  );
}

/** All, bots' or people's webhooks */
const MakerFilter = styled("div", {
  base: { display: "flex", justifyContent: "flex-start", minWidth: 0 },
});

const Stack = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px" },
});

const Fields = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px" },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "flex-end",
  },
});
