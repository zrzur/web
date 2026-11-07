import { For, JSX, Show, createMemo, createSignal } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { LobbyAppearance, LobbySection, ServerLobby } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import {
  Column,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  TextField,
  Toggle,
} from "@revolt/ui";
import type { IconName } from "@revolt/ui/icons/Icon";
import { Icon } from "@revolt/ui/icons/Icon";

import { ServerSettingsProps } from "../ServerSettings";
import { LobbyAppearanceEditor } from "./LobbyAppearanceEditor";
import { lobbyColour, lobbyContrast, lobbyInk } from "./lobbyAppearance";
import { DEFAULT_SECTIONS } from "./lobbySections";
import { SaveSlot } from "./pageSave";

type Draft = Required<
  Pick<
    ServerLobby,
    "actions" | "channels" | "faq" | "staff_roles" | "onboarding"
  >
> & {
  enabled: boolean;
  tagline: string;
  about: string;
  accent: string;
  appearance: LobbyAppearance;
  /** Every section in page order, each switched on or off */
  sections: { id: LobbySection; on: boolean }[];
  news_channel: string;
  intro_channel: string;
};

function cloneLobbyData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function draftOf(lobby?: ServerLobby): Draft {
  const chosen = lobby?.hide_sections
    ? []
    : lobby?.sections?.length
      ? lobby.sections
      : DEFAULT_SECTIONS;
  return {
    enabled: lobby?.enabled ?? false,
    tagline: lobby?.tagline ?? "",
    about: lobby?.about ?? "",
    accent: lobby?.accent ?? "",
    appearance: cloneLobbyData(lobby?.appearance ?? {}),
    onboarding: cloneLobbyData(lobby?.onboarding ?? []),
    actions: cloneLobbyData(lobby?.actions ?? []),
    channels: [...(lobby?.channels ?? [])],
    faq: cloneLobbyData(lobby?.faq ?? []),
    staff_roles: [...(lobby?.staff_roles ?? [])],
    sections: [
      ...chosen.map((id) => ({ id, on: true })),
      ...DEFAULT_SECTIONS.filter((id) => !chosen.includes(id)).map((id) => ({
        id,
        on: false,
      })),
    ],
    news_channel: lobby?.news_channel ?? "",
    intro_channel: lobby?.intro_channel ?? "",
  };
}

/**
 * Server settings, Lobby: the server's first page. Every part is optional;
 * an empty lobby still shows the banner, what to do first, live voice rooms
 * and busy channels.
 */
export function LobbySettings(props: ServerSettingsProps) {
  const { t } = useLingui();
  const describeError = useError();
  const navigate = useNavigate();
  const { pop } = useModals();

  const [draft, setDraft] = createStore<Draft>(draftOf(props.server.lobby));
  const saved = createMemo(() => JSON.stringify(draftOf(props.server.lobby)));
  const dirty = () => JSON.stringify(draft) !== saved();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();
  // One scrollable page (no category tabs) — owner: see everything by scrolling
  const [savedNotice, setSavedNotice] = createSignal(false);
  const validation = createMemo(() => {
    const colours = [
      draft.accent,
      draft.appearance.secondary,
      draft.appearance.background,
      draft.appearance.surface,
      draft.appearance.text,
    ];
    if (colours.some((c) => c && !lobbyColour(c)))
      return t`Use a six-digit colour such as #E0195F.`;
    const bg = draft.appearance.background;
    const surface = draft.appearance.surface;
    const text = draft.appearance.text || (bg ? lobbyInk(bg) : undefined);
    if (text && [bg, surface].some((c) => c && lobbyContrast(text, c) < 4.5))
      return t`Choose text and background colours with at least 4.5:1 contrast.`;
    if (draft.actions.some((a) => !a.label.trim() || !a.channel))
      return t`Complete every button label and channel.`;
    if (draft.faq.some((q) => !q.question.trim() || !q.answer.trim()))
      return t`Complete every question and answer.`;
    return undefined;
  });

  const textChannels = () => props.server.channels.filter((c) => !c.isVoice);
  const roles = () => props.server.orderedRoles;

  const SECTION_INFO: Record<
    LobbySection,
    { icon: IconName; title: () => string; line: () => string }
  > = {
    Start: {
      icon: "list-checks",
      title: () => t`Start here`,
      line: () => t`Steps for new members that tick themselves off.`,
    },
    News: {
      icon: "megaphone",
      title: () => t`Latest news`,
      line: () => t`The newest message of your announcements.`,
    },
    About: {
      icon: "info",
      title: () => t`About`,
      line: () => t`Your welcome text.`,
    },
    Live: {
      icon: "speaker-high",
      title: () => t`Live now`,
      line: () => t`Voice rooms with people in them.`,
    },
    Channels: {
      icon: "hash",
      title: () => t`Main channels`,
      line: () => t`Where to talk, with how busy each one is.`,
    },
    Questions: {
      icon: "question",
      title: () => t`Questions and answers`,
      line: () => t`Answers to what new members ask most.`,
    },
    Newcomers: {
      icon: "user-plus",
      title: () => t`New this week`,
      line: () => t`Who joined in the last seven days.`,
    },
    Team: {
      icon: "shield",
      title: () => t`Who runs it`,
      line: () => t`The owner and the roles you pick.`,
    },
  };

  async function save() {
    if (saving()) return false;
    if (!dirty()) return true;
    if (validation()) {
      setError(validation());
      return false;
    }
    setSaving(true);
    setError(undefined);
    try {
      const on = draft.sections.filter((s) => s.on).map((s) => s.id);
      const lobby: ServerLobby = {
        enabled: draft.enabled,
        tagline: draft.tagline.trim() || undefined,
        about: draft.about.trim() || undefined,
        accent: draft.accent || undefined,
        appearance: cloneLobbyData(unwrap(draft.appearance)),
        // edited under Roles; kept as they are
        onboarding: cloneLobbyData(props.server.lobby?.onboarding ?? []),
        hide_sections: on.length === 0,
        actions: draft.actions
          .filter((a) => a.label.trim() && a.channel)
          .map((a) => ({ ...a, label: a.label.trim() })),
        channels: [...draft.channels],
        faq: draft.faq.filter((q) => q.question.trim() && q.answer.trim()),
        staff_roles: [...draft.staff_roles],
        // the default order with nothing hidden is stored as "default"
        sections:
          JSON.stringify(on) === JSON.stringify(DEFAULT_SECTIONS) ? [] : on,
        news_channel: draft.news_channel || undefined,
        intro_channel: draft.intro_channel || undefined,
      };
      await props.server.edit({ lobby });
      setDraft(reconcile(draftOf(props.server.lobby)));
      setSavedNotice(true);
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Save first so opening the lobby never discards an edited design. */
  const saveAndOpen = async () => {
    if (!(await save())) return;
    pop();
    navigate(`/server/${props.server.id}/lobby`);
  };

  const toggleIn = (key: "channels" | "staff_roles", id: string, max: number) =>
    setDraft(key, (list) =>
      list.includes(id)
        ? list.filter((v) => v !== id)
        : list.length < max
          ? [...list, id]
          : list,
    );

  const move = <T,>(list: T[], from: number, to: number) => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const channelSelect = (
    value: string,
    onChange: (id: string) => void,
    none: string,
  ): JSX.Element => (
    <SelectWidth>
      <FloatingSelect
        value={value || "none"}
        onChange={(e) =>
          onChange(
            e.currentTarget.value === "none" ? "" : e.currentTarget.value,
          )
        }
      >
        <MenuItem value="none">{none}</MenuItem>
        <For each={textChannels()}>
          {(channel) => <MenuItem value={channel.id}>#{channel.name}</MenuItem>}
        </For>
      </FloatingSelect>
    </SelectWidth>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Column gap="xl">
        <SettingsSection
          description={
            <Trans>
              The first page of your server: what it is about, what to do first
              and who runs it.
            </Trans>
          }
        >
          <SettingsRow
            icon={<Icon name="house" size={20} />}
            title={<Trans>Open the server on its lobby</Trans>}
            description={
              <Trans>Off: only managers see the lobby, as a preview.</Trans>
            }
            onClick={() => setDraft("enabled", (v) => !v)}
            control={(ids) => (
              <Toggle
                checked={draft.enabled}
                onChange={() => setDraft("enabled", (v) => !v)}
                aria-labelledby={ids.labelId}
              />
            )}
          />
          <SettingsRow
            icon={<Icon name="eye" size={20} />}
            title={<Trans>Save and open lobby</Trans>}
            navigational
            onClick={saveAndOpen}
          />
        </SettingsSection>

        <Show when={savedNotice() && !dirty()}>
          <Help role="status">{t`Lobby settings saved. Your members now see this design.`}</Help>
        </Show>

        {/* its own sections: design, colours, layout, sizes, shown */}
        <LobbyAppearanceEditor
          lobby={{ accent: draft.accent, appearance: draft.appearance }}
          onAccent={(value) => setDraft("accent", value)}
          onChange={(value) => setDraft("appearance", reconcile(value))}
        />

        <SettingsSection title={<Trans>Welcome</Trans>}>
          <Panel>
            <TextField
              label={t`Tagline`}
              maxlength={120}
              counter
              value={draft.tagline}
              placeholder={t`Where people who love games meet`}
              helper={t`One line under the server name. Empty: the server description.`}
              onInput={(e) => setDraft("tagline", e.currentTarget.value)}
            />
            <TextField
              label={t`About`}
              autosize
              min-rows={4}
              maxlength={3000}
              counter
              value={draft.about}
              placeholder={t`What happens here, and how to take part.`}
              helper={t`Markdown is supported.`}
              onInput={(e) => setDraft("about", e.currentTarget.value)}
            />
          </Panel>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Buttons</Trans>}
          description={
            <Trans>
              Up to three buttons under the name, each opening a channel. Read
              the rules is added by itself when a rules channel is set.
            </Trans>
          }
        >
          <Panel>
            <For each={draft.actions}>
              {(action, index) => (
                <ItemRow>
                  <TextField
                    label={t`Emoji`}
                    maxlength={8}
                    value={action.emoji ?? ""}
                    placeholder="👋"
                    onInput={(e) =>
                      setDraft(
                        "actions",
                        index(),
                        "emoji",
                        e.currentTarget.value || undefined,
                      )
                    }
                  />
                  <TextField
                    label={t`Label`}
                    maxlength={32}
                    value={action.label}
                    placeholder={t`Say hi`}
                    onInput={(e) =>
                      setDraft(
                        "actions",
                        index(),
                        "label",
                        e.currentTarget.value,
                      )
                    }
                  />
                  <Field>
                    <FieldLabel>{t`Opens`}</FieldLabel>
                    <FloatingSelect
                      aria-label={t`Opens`}
                      value={action.channel}
                      onChange={(e) =>
                        setDraft(
                          "actions",
                          index(),
                          "channel",
                          e.currentTarget.value,
                        )
                      }
                    >
                      <For each={textChannels()}>
                        {(channel) => (
                          <MenuItem value={channel.id}>
                            #{channel.name}
                          </MenuItem>
                        )}
                      </For>
                    </FloatingSelect>
                  </Field>
                  <IconButton
                    type="button"
                    aria-label={t`Remove button`}
                    onClick={() =>
                      setDraft("actions", (list) =>
                        list.filter((_, i) => i !== index()),
                      )
                    }
                  >
                    <Icon name="trash" size={18} />
                  </IconButton>
                </ItemRow>
              )}
            </For>
            <Show when={draft.actions.length < 3 && textChannels().length}>
              <AddButton
                type="button"
                onClick={() =>
                  setDraft("actions", (list) => [
                    ...list,
                    { label: "", channel: textChannels()[0].id },
                  ])
                }
              >
                <Icon name="plus" size={18} />
                {t`Add a button`}
              </AddButton>
            </Show>
          </Panel>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Sections</Trans>}
          description={
            <Trans>
              Choose what the lobby shows and in which order. Sections with
              nothing to show stay hidden by themselves.
            </Trans>
          }
        >
          <For each={draft.sections}>
            {(section, index) => (
              <SettingsRow
                icon={<Icon name={SECTION_INFO[section.id].icon} size={20} />}
                title={SECTION_INFO[section.id].title()}
                description={SECTION_INFO[section.id].line()}
                control={(ids) => (
                  <RowTools>
                    <IconButton
                      type="button"
                      aria-label={t`Move up`}
                      disabled={index() === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraft("sections", (list) =>
                          move(list, index(), index() - 1),
                        );
                      }}
                    >
                      <Icon name="caret-up" size={18} />
                    </IconButton>
                    <IconButton
                      type="button"
                      aria-label={t`Move down`}
                      disabled={index() === draft.sections.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraft("sections", (list) =>
                          move(list, index(), index() + 1),
                        );
                      }}
                    >
                      <Icon name="caret-down" size={18} />
                    </IconButton>
                    <Toggle
                      checked={section.on}
                      onChange={() =>
                        setDraft("sections", index(), "on", (v) => !v)
                      }
                      aria-labelledby={ids.labelId}
                    />
                  </RowTools>
                )}
              />
            )}
          </For>
        </SettingsSection>

        <SettingsSection title={<Trans>Channels</Trans>}>
          <SettingsRow
            icon={<Icon name="hand-waving" size={20} />}
            title={<Trans>Hello channel</Trans>}
            description={
              <Trans>
                Where new members say hello. Empty: the first button.
              </Trans>
            }
            control={() =>
              channelSelect(
                draft.intro_channel,
                (id) => setDraft("intro_channel", id),
                t`Automatic`,
              )
            }
          />
          <SettingsRow
            icon={<Icon name="megaphone" size={20} />}
            title={<Trans>News channel</Trans>}
            description={
              <Trans>
                Its newest message is the latest news. Empty: your first
                announcement channel.
              </Trans>
            }
            control={() =>
              channelSelect(
                draft.news_channel,
                (id) => setDraft("news_channel", id),
                t`Automatic`,
              )
            }
          />
          <Panel data-joined>
            <FieldLabel>{t`Main channels`}</FieldLabel>
            <Help>
              {t`Pick up to nine. None picked: the busiest channels are shown.`}
            </Help>
            <Chips>
              <For each={textChannels()}>
                {(channel) => (
                  <Chip
                    type="button"
                    aria-pressed={draft.channels.includes(channel.id)}
                    onClick={() => toggleIn("channels", channel.id, 9)}
                  >
                    <Show when={draft.channels.includes(channel.id)}>
                      <Order>{draft.channels.indexOf(channel.id) + 1}</Order>
                    </Show>
                    #{channel.name}
                  </Chip>
                )}
              </For>
            </Chips>
          </Panel>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Questions and answers</Trans>}
          description={
            <Trans>Answer what new members ask most. Up to twenty.</Trans>
          }
        >
          <Panel>
            <For each={draft.faq}>
              {(entry, index) => (
                <Question>
                  <QuestionHead>
                    <span>{t`Question ${index() + 1}`}</span>
                    <RowTools>
                      <IconButton
                        type="button"
                        aria-label={t`Move up`}
                        disabled={index() === 0}
                        onClick={() =>
                          setDraft("faq", (list) =>
                            move(list, index(), index() - 1),
                          )
                        }
                      >
                        <Icon name="caret-up" size={18} />
                      </IconButton>
                      <IconButton
                        type="button"
                        aria-label={t`Move down`}
                        disabled={index() === draft.faq.length - 1}
                        onClick={() =>
                          setDraft("faq", (list) =>
                            move(list, index(), index() + 1),
                          )
                        }
                      >
                        <Icon name="caret-down" size={18} />
                      </IconButton>
                      <IconButton
                        type="button"
                        aria-label={t`Remove question`}
                        onClick={() =>
                          setDraft("faq", (list) =>
                            list.filter((_, i) => i !== index()),
                          )
                        }
                      >
                        <Icon name="trash" size={18} />
                      </IconButton>
                    </RowTools>
                  </QuestionHead>
                  <TextField
                    label={t`Question`}
                    maxlength={150}
                    value={entry.question}
                    placeholder={t`How do I get a role?`}
                    onInput={(e) =>
                      setDraft(
                        "faq",
                        index(),
                        "question",
                        e.currentTarget.value,
                      )
                    }
                  />
                  <TextField
                    label={t`Answer`}
                    autosize
                    min-rows={2}
                    maxlength={2000}
                    value={entry.answer}
                    onInput={(e) =>
                      setDraft("faq", index(), "answer", e.currentTarget.value)
                    }
                  />
                </Question>
              )}
            </For>
            <Show when={draft.faq.length < 20}>
              <AddButton
                type="button"
                onClick={() =>
                  setDraft("faq", (list) => [
                    ...list,
                    { question: "", answer: "" },
                  ])
                }
              >
                <Icon name="plus" size={18} />
                {t`Add a question`}
              </AddButton>
            </Show>
          </Panel>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Who runs it</Trans>}
          description={
            <Trans>
              The owner is always listed. Pick the roles whose members are shown
              too, up to ten.
            </Trans>
          }
        >
          <Panel>
            <Chips>
              <For each={roles()}>
                {(role) => (
                  <Chip
                    type="button"
                    aria-pressed={draft.staff_roles.includes(role.id)}
                    onClick={() => toggleIn("staff_roles", role.id, 10)}
                  >
                    <RoleDot style={{ background: role.colour ?? undefined }} />
                    {role.name}
                  </Chip>
                )}
              </For>
            </Chips>
          </Panel>
        </SettingsSection>

        <SaveSlot
          show={dirty()}
          saving={saving()}
          error={validation() ?? error()}
          canSave={!validation()}
          onReset={() => {
            setDraft(reconcile(draftOf(props.server.lobby)));
            setError(undefined);
          }}
        />
      </Column>
    </form>
  );
}

/** Free-form content inside a settings card, on the same 16px grid as rows */
const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    "&[data-joined]": {
      gap: "8px",
      borderBlockStart: "1px solid var(--z-border-subtle)",
    },
    _phone: { padding: "12px" },
  },
});

const Field = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
});

const FieldLabel = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-secondary)",
  },
});

const Help = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-fg-muted)" },
});

const ItemRow = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr) minmax(0, 200px) 40px",
    alignItems: "end",
    gap: "12px",
    paddingBlockEnd: "16px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    _phone: {
      gridTemplateColumns: "64px minmax(0, 1fr) 40px",
      "& > :nth-child(3)": { gridColumn: "1 / -1", gridRow: 2 },
    },
  },
});

const RowTools = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "4px" },
});

const IconButton = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    border: "none",
    background: "none",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _disabled: { opacity: 0.35, cursor: "default", background: "none" },
    _phone: { width: "44px", height: "44px" },
  },
});

const AddButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "44px",
    paddingInline: "16px",
    borderRadius: "10px",
    border: "1px dashed var(--z-border-subtle)",
    background: "none",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: {
      background: "var(--z-nav-hover)",
      color: "var(--z-fg-primary)",
    },
  },
});

const Question = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px 14px 16px",
    borderRadius: "12px",
    background: "var(--z-bg-input)",
  },
});

const QuestionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    "& > span": {
      fontSize: "13px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
  },
});

const Chips = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
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
    fontSize: "14px",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    "&[aria-pressed=true]": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 16%, transparent)",
      color: "var(--z-fg-primary)",
    },
    _phone: { minHeight: "44px" },
  },
});

/** Position of a chosen channel on the lobby */
const Order = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "var(--z-accent-fill, #E0195F)",
    color: "var(--z-on-accent, #fff)",
    fontSize: "11px",
    fontWeight: 800,
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

const SelectWidth = styled("div", {
  base: { width: "min(220px, 40vw)" },
});
