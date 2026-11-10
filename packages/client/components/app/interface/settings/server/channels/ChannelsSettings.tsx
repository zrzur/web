import { For, Show, createSignal } from "solid-js";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel, Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useDurationFormat } from "@revolt/i18n/durations";
import { useModals } from "@revolt/modal";
import { MAX_VOICE_USER_LIMIT, userLimitChange } from "@revolt/rtc/moderation";
import {
  Button,
  Column,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSaved } from "../savedNotice";

/** Slow mode steps in seconds (0 = off), the same scale as channel settings */
const SLOWMODE = [0, 5, 10, 30, 60, 300, 600, 1800, 3600, 7200, 21600];
/** Voice room sizes (0 = no limit), up to the room size slider's maximum */
const LIMITS = [0, 2, 3, 4, 5, 8, 10, 15, 20, 25, MAX_VOICE_USER_LIMIT];

/** The steps plus a value set elsewhere, so a select never shows blank */
const withCurrent = (steps: number[], current: number) =>
  steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);

/**
 * Server settings → Channels / Voice rooms.
 * Every channel in its category, with the controls people change most
 * (slow mode, room size) right on the row, and full settings one click away.
 * `voice` shows the voice rooms only.
 */
export function ChannelsSettings(props: { server: Server; voice?: boolean }) {
  const { t } = useLingui();
  const { openModal, showError } = useModals();
  const [saving, setSaving] = createSignal<string>();

  const canManage = () => props.server.havePermission("ManageChannel");

  const groups = () =>
    props.server.orderedChannels
      .map((category) => ({
        ...category,
        channels: category.channels.filter((channel) =>
          props.voice ? channel.isVoice : true,
        ),
      }))
      .filter((category) => category.channels.length || !props.voice);

  const duration = useDurationFormat();
  /** 600 → "10 minutes", 7200 → "2 hours"; the largest whole unit */
  const seconds = (s: number) =>
    s % 3600 === 0
      ? duration({ hours: s / 3600 })
      : s % 60 === 0
        ? duration({ minutes: s / 60 })
        : duration({ seconds: s });

  const limit = (n: number) =>
    n === 0
      ? t`No limit`
      : t`${plural(n, { one: "# person", other: "# people" })}`;

  const saved = useSaved();

  async function edit(
    channel: Channel,
    changes: Parameters<Channel["edit"]>[0],
  ) {
    setSaving(channel.id);
    try {
      await channel.edit(changes);
      saved();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(undefined);
    }
  }

  const openChannel = (channel: Channel) =>
    openModal({ type: "settings", config: "channel", context: channel });

  /** What a row says about its channel under the name */
  const summary = (channel: Channel) => {
    const parts: string[] = [];
    if (channel.isVoice) {
      const inside = channel.voiceParticipants.size;
      parts.push(inside ? t`${inside} in the room now` : t`Nobody in the room`);
    } else if (channel.description) {
      parts.push(channel.description.split("\n")[0]);
    } else {
      parts.push(t`Text channel`);
    }
    if (channel.mature) parts.push(t`Age-restricted`);
    return parts.join(" · ");
  };

  const icon = (channel: Channel) =>
    channel.isVoice
      ? "speaker-high"
      : channel.announcement
        ? "megaphone"
        : "hash";

  return (
    <Column gap="xl">
      <SettingsSection
        title={
          props.voice ? (
            <Trans>Voice channels</Trans>
          ) : (
            <Trans>Text channels</Trans>
          )
        }
        description={
          props.voice ? (
            <Trans>
              How many people fit in each room and who is talking right now.
            </Trans>
          ) : (
            <Trans>
              Every channel by category. Change slow mode and room size here;
              the gear opens all settings of a channel.
            </Trans>
          )
        }
        aside={
          <Show when={canManage()}>
            <Actions>
              <Show when={!props.voice}>
                <Button
                  size="sm"
                  shape="square"
                  variant="tonal"
                  onPress={() =>
                    openModal({ type: "create_category", server: props.server })
                  }
                >
                  <Icon name="folder-plus" size={16} />
                  <Trans>New category</Trans>
                </Button>
              </Show>
              <Button
                size="sm"
                shape="square"
                onPress={() =>
                  openModal({
                    type: "create_channel",
                    server: props.server,
                    initialType: props.voice ? "Voice" : "Text",
                  })
                }
              >
                <Icon name="plus" size={16} />
                {props.voice ? (
                  <Trans>New voice room</Trans>
                ) : (
                  <Trans>New channel</Trans>
                )}
              </Button>
            </Actions>
          </Show>
        }
      >
        <Overview>
          <Stat>
            <strong>
              {props.server.channels.filter((c) => !c.isVoice).length}
            </strong>
            <span>
              <Trans>Text channels</Trans>
            </span>
          </Stat>
          <Stat>
            <strong>
              {props.server.channels.filter((c) => c.isVoice).length}
            </strong>
            <span>
              <Trans>Voice rooms</Trans>
            </span>
          </Stat>
          <Stat>
            <strong>{props.server.categories?.length ?? 0}</strong>
            <span>
              <Trans>Categories</Trans>
            </span>
          </Stat>
          <Stat>
            <strong>
              {props.server.channels.reduce(
                (sum, c) => sum + (c.isVoice ? c.voiceParticipants.size : 0),
                0,
              )}
            </strong>
            <span>
              <Trans>In voice now</Trans>
            </span>
          </Stat>
        </Overview>
      </SettingsSection>

      <For each={groups()}>
        {(category) => {
          const real = () => category.id !== "default";
          const data = () =>
            props.server.categories?.find((c) => c.id === category.id);
          return (
            <SettingsSection
              title={real() ? category.title : <Trans>Without category</Trans>}
              aside={
                <Show when={canManage()}>
                  <Tools>
                    <button
                      type="button"
                      title={t`Add a channel here`}
                      aria-label={t`Add a channel here`}
                      onClick={() =>
                        openModal({
                          type: "create_channel",
                          server: props.server,
                          initialType: props.voice ? "Voice" : "Text",
                          categoryId: real() ? category.id : undefined,
                        })
                      }
                    >
                      <Icon name="plus" size={18} />
                    </button>
                    <Show when={real() && data()}>
                      <button
                        type="button"
                        title={t`Rename category`}
                        aria-label={t`Rename category`}
                        onClick={() =>
                          openModal({
                            type: "edit_category",
                            server: props.server,
                            category,
                          })
                        }
                      >
                        <Icon name="pencil-simple" size={18} />
                      </button>
                      <button
                        type="button"
                        data-danger
                        title={t`Delete category`}
                        aria-label={t`Delete category`}
                        onClick={() =>
                          openModal({
                            type: "delete_category",
                            server: props.server,
                            categoryId: category.id,
                          })
                        }
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    </Show>
                  </Tools>
                </Show>
              }
            >
              <Show
                when={category.channels.length}
                fallback={
                  <SettingsRow
                    icon={<Icon name="folder" size={20} />}
                    title={<Trans>No channels yet</Trans>}
                    description={
                      <Trans>
                        Use + to add the first one to this category.
                      </Trans>
                    }
                  />
                }
              >
                <For each={category.channels}>
                  {(channel) => {
                    const editable = () =>
                      channel.havePermission("ManageChannel");
                    return (
                      <SettingsRow
                        icon={<Icon name={icon(channel)} size={20} />}
                        title={channel.name}
                        description={summary(channel)}
                        secondary={
                          <QuickWidth data-busy={saving() === channel.id}>
                            <Show
                              when={channel.isVoice}
                              fallback={
                                <FloatingSelect
                                  aria-label={t`Slow mode in ${channel.name}`}
                                  disabled={!editable()}
                                  value={String(channel.slowmode)}
                                  onChange={(e) =>
                                    edit(channel, {
                                      slowmode: Number(e.currentTarget.value),
                                    })
                                  }
                                >
                                  <For
                                    each={withCurrent(
                                      SLOWMODE,
                                      channel.slowmode,
                                    )}
                                  >
                                    {(s) => (
                                      <MenuItem value={String(s)}>
                                        {s === 0
                                          ? t`Slow mode off`
                                          : t`Slow mode: ${seconds(s)}`}
                                      </MenuItem>
                                    )}
                                  </For>
                                </FloatingSelect>
                              }
                            >
                              <FloatingSelect
                                aria-label={t`Room size of ${channel.name}`}
                                disabled={!editable()}
                                value={String(channel.voice?.maxUsers ?? 0)}
                                onChange={(e) =>
                                  edit(channel, {
                                    voice: userLimitChange(
                                      Number(e.currentTarget.value),
                                    ),
                                  } as Parameters<Channel["edit"]>[0])
                                }
                              >
                                <For
                                  each={withCurrent(
                                    LIMITS,
                                    channel.voice?.maxUsers ?? 0,
                                  )}
                                >
                                  {(n) => (
                                    <MenuItem value={String(n)}>
                                      {limit(n)}
                                    </MenuItem>
                                  )}
                                </For>
                              </FloatingSelect>
                            </Show>
                          </QuickWidth>
                        }
                        control={() => (
                          <Tools>
                            <button
                              type="button"
                              title={t`Channel settings`}
                              aria-label={t`Settings of ${channel.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openChannel(channel);
                              }}
                            >
                              <Icon name="gear-six" size={18} />
                            </button>
                            <Show when={editable()}>
                              <button
                                type="button"
                                data-danger
                                title={t`Delete channel`}
                                aria-label={t`Delete ${channel.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal({
                                    type: "delete_channel",
                                    channel,
                                  });
                                }}
                              >
                                <Icon name="trash" size={18} />
                              </button>
                            </Show>
                          </Tools>
                        )}
                      />
                    );
                  }}
                </For>
              </Show>
            </SettingsSection>
          );
        }}
      </For>
    </Column>
  );
}

const Actions = styled("div", {
  base: { display: "flex", gap: "8px", flexWrap: "wrap" },
});

/** Four numbers about the server's channels, on the section panel */
const Overview = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    _phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
});

const Stat = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "16px",
    minWidth: 0,
    "& + &": { borderInlineStart: "1px solid var(--z-border-subtle)" },
    "& strong": {
      fontSize: "22px",
      fontWeight: 700,
      lineHeight: "28px",
      color: "var(--z-fg-primary)",
      fontVariantNumeric: "tabular-nums",
    },
    "& span": { fontSize: "13px", color: "var(--z-fg-muted)" },
    _phone: {
      "&:nth-child(3)": { borderInlineStart: "none" },
      "&:nth-child(n+3)": {
        borderBlockStart: "1px solid var(--z-border-subtle)",
      },
    },
  },
});

const QuickWidth = styled("div", {
  base: {
    width: "min(200px, 36vw)",
    transition: "opacity 0.12s ease",
    "&[data-busy=true]": { opacity: 0.6, pointerEvents: "none" },
    _phone: { width: "min(160px, 42vw)" },
  },
});

const Tools = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    "& button": {
      width: "36px",
      height: "36px",
      display: "grid",
      placeItems: "center",
      padding: 0,
      border: "none",
      borderRadius: "8px",
      background: "none",
      color: "var(--z-fg-muted)",
      "--z-icon-color": "currentColor",
      cursor: "pointer",
      _hover: {
        background: "var(--z-nav-hover)",
        color: "var(--z-fg-primary)",
      },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      "&[data-danger]:hover": { color: "var(--z-danger)" },
      _phone: { width: "44px", height: "44px" },
    },
  },
});
