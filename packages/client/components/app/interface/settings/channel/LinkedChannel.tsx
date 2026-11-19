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
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  Button,
  Checkbox,
  Dialog,
  FloatingSelect,
  MenuItem,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type Confirmation,
  type LinkRefusal,
  allConfirmed,
  knownLink,
  linkChannel,
  linkRefusal,
  loadLink,
  unlinkChannel,
} from "../../channels/linkedChannels";

/**
 * Channel settings: link this channel with a channel on Discord through a
 * bridge bot the server's owner runs. Nothing of Discord is asked for here:
 * no token, no webhook address. The owner picks his own bot and confirms
 * what he answers for; none of the boxes is ticked for him.
 */
export function LinkedChannel(props: { channel: Channel }) {
  const { t } = useLingui();
  const client = useClient();

  onMount(() => loadLink(client(), props.channel.id, true));
  const link = () => knownLink(props.channel.id);

  const [bots] = createResource(async () => {
    const owned = await client().bots.fetchOwned();
    return owned.map((bot) => ({
      id: bot.id,
      name: client().users.get(bot.id)?.username ?? bot.id,
    }));
  });

  const [bot, setBot] = createSignal("");
  const chosen = () => bot() || bots()?.[0]?.id || "";
  const [ticked, setTicked] = createSignal<
    Partial<Record<Confirmation, boolean>>
  >({});
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal<LinkRefusal>();
  const [ending, setEnding] = createSignal(false);
  const [removed, setRemoved] = createSignal<number>();

  const tick = (key: Confirmation, checked: boolean) =>
    setTicked({ ...ticked(), [key]: checked });

  const failureText = (kind: LinkRefusal) => {
    switch (kind) {
      case "not_text":
        return t`Only a text channel of a server can be linked.`;
      case "mature":
        return t`A channel marked as mature can't be linked.`;
      case "private":
        return t`Only a channel every member can read can be linked.`;
      case "not_a_bot":
      case "not_your_bot":
        return t`Choose a bot that you made yourself.`;
      case "bot_not_member":
        return t`Add your bot to this server first.`;
      case "not_confirmed":
        return t`Tick all four boxes to link the channel.`;
      case "already_linked":
        return t`This channel is already linked.`;
      case "too_many":
        return t`This server has reached its number of linked channels.`;
      case "no_permission":
        return t`You need the permission to manage the server.`;
      case "off":
        return t`Linked channels are switched off here.`;
      default:
        return t`That did not work. Try again.`;
    }
  };

  async function makeLink() {
    if (busy() || !chosen() || !allConfirmed(ticked())) return;
    setBusy(true);
    setFailure(undefined);
    setRemoved(undefined);
    try {
      await linkChannel(client(), props.channel.id, chosen());
      setTicked({});
    } catch (error) {
      setFailure(linkRefusal(error));
    } finally {
      setBusy(false);
    }
  }

  async function endLink() {
    try {
      const result = await unlinkChannel(client(), props.channel.id);
      setRemoved(result.removed);
    } catch (error) {
      setFailure(linkRefusal(error));
      throw error;
    }
  }

  const botName = () => {
    const id = link()?.bot;
    return id ? (client().users.get(id)?.username ?? id) : "";
  };

  return (
    <Stack data-linked-channel={link() ? "linked" : "open"}>
      <SettingsSection
        title={<Trans>Linked channel</Trans>}
        description={
          <Trans>
            Link this channel with a channel on Discord through a bridge bot
            that you run. People on both sides then read the same conversation.
          </Trans>
        }
      >
        <SettingsFormPanel>
          <Facts>
            <li>
              <Trans>
                You run the bridge bot and you answer for it. Zrzur does not
                connect to Discord and never asks for a Discord token or webhook
                address.
              </Trans>
            </li>
            <li>
              <Trans>
                Only text is copied, and only messages written after linking.
                Files, reactions, threads and voice stay where they are.
              </Trans>
            </li>
            <li>
              <Trans>
                Members on each side see the names and pictures of the other
                side. Edits and deletions are copied only while your bridge
                runs.
              </Trans>
            </li>
            <li>
              <Trans>
                Discord's rules for developers apply to your bot there, and
                Discord can stop it at any time.
              </Trans>
            </li>
          </Facts>
        </SettingsFormPanel>
      </SettingsSection>

      <Switch>
        <Match when={link()}>
          <SettingsSection>
            <SettingsRow
              icon={<Icon name="link" size={20} />}
              title={<Trans>This channel is linked.</Trans>}
              description={t`Bridge bot: ${botName()}`}
              control={() => (
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() => {
                    setFailure(undefined);
                    setEnding(true);
                  }}
                >
                  <Trans>End link</Trans>
                </Button>
              )}
            />
          </SettingsSection>
        </Match>
        <Match when={!link()}>
          <SettingsSection title={<Trans>Link this channel</Trans>}>
            <SettingsFormPanel>
              <Fields>
                <Show
                  when={bots()?.length}
                  fallback={
                    <Quiet data-linked-no-bot>
                      <Show
                        when={!bots.loading}
                        fallback={<Trans>Loading…</Trans>}
                      >
                        <Trans>
                          You have no bot yet. Make one in your settings under
                          Bots, add it to this server, then come back.
                        </Trans>
                      </Show>
                    </Quiet>
                  }
                >
                  <FloatingSelect
                    aria-label={t`Bridge bot`}
                    value={chosen()}
                    onChange={(event) => setBot(event.currentTarget.value)}
                  >
                    <For each={bots()}>
                      {(entry) => (
                        <MenuItem value={entry.id}>{entry.name}</MenuItem>
                      )}
                    </For>
                  </FloatingSelect>

                  <Checks>
                    <Checkbox
                      name="runs_it"
                      checked={!!ticked().runs_it}
                      onChange={(event) =>
                        tick("runs_it", event.currentTarget.checked)
                      }
                    >
                      <Trans>
                        I run the bridge bot myself and I am responsible for it.
                      </Trans>
                    </Checkbox>
                    <Checkbox
                      name="notice_posted"
                      checked={!!ticked().notice_posted}
                      onChange={(event) =>
                        tick("notice_posted", event.currentTarget.checked)
                      }
                    >
                      <Trans>
                        I posted a notice in the Discord channel that messages
                        are copied to Zrzur, with a way to opt out.
                      </Trans>
                    </Checkbox>
                    <Checkbox
                      name="not_age_restricted"
                      checked={!!ticked().not_age_restricted}
                      onChange={(event) =>
                        tick("not_age_restricted", event.currentTarget.checked)
                      }
                    >
                      <Trans>The Discord channel is not age-restricted.</Trans>
                    </Checkbox>
                    <Checkbox
                      name="new_messages_only"
                      checked={!!ticked().new_messages_only}
                      onChange={(event) =>
                        tick("new_messages_only", event.currentTarget.checked)
                      }
                    >
                      <Trans>
                        Only messages written after linking are copied.
                      </Trans>
                    </Checkbox>
                  </Checks>

                  <div>
                    <Button
                      onPress={makeLink}
                      isDisabled={busy() || !allConfirmed(ticked())}
                    >
                      <Trans>Link channel</Trans>
                    </Button>
                  </div>
                </Show>
              </Fields>
            </SettingsFormPanel>
          </SettingsSection>
        </Match>
      </Switch>

      <Show when={failure()}>
        <p role="alert" data-linked-failure={failure()}>
          {failureText(failure()!)}
        </p>
      </Show>
      <Show when={removed() !== undefined && !link()}>
        <p role="status" data-linked-ended>
          <Trans>
            The link has ended. Messages that came from Discord were removed
            here.
          </Trans>
        </p>
      </Show>

      <Quiet>
        <Trans>Zrzur is not affiliated with Discord.</Trans>
      </Quiet>

      <Show when={ending()}>
        <Dialog
          show
          tone="danger"
          size="sm"
          onClose={() => setEnding(false)}
          title={<Trans>End the link?</Trans>}
          actions={[
            { text: <Trans>Cancel</Trans> },
            { text: <Trans>End link</Trans>, onClick: endLink },
          ]}
        >
          <Trans>
            The messages that came from Discord are deleted here. What members
            wrote in this channel stays. Stop your bridge bot as well.
          </Trans>
          <Show when={failure()}>
            <span role="alert">{failureText(failure()!)}</span>
          </Show>
        </Dialog>
      </Show>
    </Stack>
  );
}

const Stack = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px" },
});

const Fields = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px" },
});

const Checks = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const Facts = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    paddingInlineStart: "20px",
    listStyle: "disc",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    lineHeight: "22px",
  },
});

const Quiet = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    lineHeight: "20px",
  },
});
