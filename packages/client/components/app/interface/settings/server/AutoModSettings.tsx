import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import type { AutoModRule, AutoModTrigger, Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useError } from "@revolt/i18n";
import {
  Button,
  Dialog,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  TextField,
  Toggle,
} from "@revolt/ui";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import {
  type TriggerType,
  MAX_RULES,
  TRIGGER_TYPES,
  defaultTrigger,
  draftProblem,
  formatList,
  newRule,
  INSULTS_RULE_ID,
  insultsRule,
  parseList,
  upsertRule,
} from "./automod";
import { ConfirmDialog } from "./ConfirmDialog";
import { useSaved } from "./savedNotice";

const ICONS: Record<TriggerType, IconName> = {
  Keywords: "text-aa",
  MentionSpam: "at",
  LinkSpam: "link",
  RepeatedMessages: "copy",
};

/**
 * AutoMod: rules the server checks before a message is posted. Only people
 * who manage the server see them.
 */
export function AutoModSettings(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();
  const client = useQueryClient();

  const key = () => ["automod", props.server.id];
  const rules = useQuery(() => ({
    queryKey: key(),
    queryFn: () => props.server.fetchAutoMod(),
  }));

  const [draft, setDraft] = createSignal<AutoModRule>();
  const [isNew, setIsNew] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const typeName = (type: TriggerType) =>
    ({
      Keywords: t`Blocked words`,
      MentionSpam: t`Mention spam`,
      LinkSpam: t`Link spam`,
      RepeatedMessages: t`Repeated messages`,
    })[type];

  const summary = (rule: AutoModRule) => {
    const parts = [typeName(rule.trigger.type)];
    if (rule.actions.block) parts.push(t`blocks`);
    if (rule.actions.alert_channel) parts.push(t`alerts`);
    if (rule.actions.timeout_minutes) parts.push(t`times out`);
    return parts.join(" · ");
  };

  const problemText = (rule: AutoModRule) => {
    switch (draftProblem(rule)) {
      case "name":
        return t`Give the rule a name.`;
      case "words":
        return t`Add at least one word or phrase.`;
      case "number":
        return t`Check the numbers.`;
      case "links":
        return t`Choose new members, allowed domains, or both.`;
      case "action":
        return t`Choose at least one action.`;
      default:
        return undefined;
    }
  };

  const notify = useSaved();
  const [removing, setRemoving] = createSignal<AutoModRule>();

  async function save(next: AutoModRule[]) {
    setSaving(true);
    setError(undefined);
    try {
      const result = await props.server.setAutoMod(next);
      client.setQueryData(key(), result);
      notify();
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function open(rule: AutoModRule, created: boolean) {
    setError(undefined);
    setIsNew(created);
    setDraft(structuredClone(rule));
  }

  const update = (change: (rule: AutoModRule) => void) =>
    setDraft((rule) => {
      const next = structuredClone(rule!);
      change(next);
      return next;
    });

  const setTrigger = (trigger: AutoModTrigger) =>
    update((rule) => (rule.trigger = trigger));

  const textChannels = () =>
    props.server.channels.filter((channel) => channel.type === "TextChannel");

  return (
    <>
      <SettingsSection
        title={<Trans>Rules</Trans>}
        description={<Trans>Bots and the owner are not checked.</Trans>}
        aside={
          <Button
            size="sm"
            shape="square"
            isDisabled={!rules.data || rules.data.length >= MAX_RULES}
            onPress={() => open(newRule("Keywords", rules.data ?? []), true)}
          >
            <Icon name="plus" size={16} />
            <Trans>Add rule</Trans>
          </Button>
        }
      >
        <Switch>
          <Match when={rules.isLoading}>
            <SettingsRow
              icon={<Icon name="shield-check" size={20} />}
              title={<Trans>Loading rules…</Trans>}
            />
          </Match>
          <Match when={rules.isError}>
            <SettingsRow
              icon={<Icon name="warning-circle" size={20} />}
              danger
              title={<Trans>Rules couldn't be loaded</Trans>}
            />
          </Match>
          <Match when={!rules.data?.length}>
            <SettingsRow
              icon={<Icon name="shield-check" size={20} />}
              title={<Trans>No rules yet</Trans>}
              description={
                <Trans>
                  Block words, mention spam, links from new members or the same
                  message in many channels.
                </Trans>
              }
            />
          </Match>
          <Match when={rules.data}>
            <For each={rules.data}>
              {(rule) => (
                <SettingsRow
                  icon={<Icon name={ICONS[rule.trigger.type]} size={20} />}
                  title={rule.name}
                  description={summary(rule)}
                  onClick={() => open(rule, false)}
                  control={(ids) => (
                    <Toggle
                      checked={rule.enabled !== false}
                      disabled={saving()}
                      aria-labelledby={ids.labelId}
                      onChange={() =>
                        void save(
                          upsertRule(rules.data!, {
                            ...rule,
                            enabled: !rule.enabled,
                          }),
                        )
                      }
                    />
                  )}
                />
              )}
            </For>
          </Match>
        </Switch>
        <Show
          when={
            rules.data &&
            !rules.data.some((rule) => rule.id === INSULTS_RULE_ID)
          }
        >
          <SettingsRow
            icon={<Icon name="shield-check" size={20} />}
            title={<Trans>Arabic insults</Trans>}
            description={
              <Trans>
                An optional list that blocks common Arabic insults. Switch it
                on and it becomes a rule you can edit.
              </Trans>
            }
            control={(ids) => (
              <Toggle
                checked={false}
                disabled={saving() || rules.data!.length >= MAX_RULES}
                aria-labelledby={ids.labelId}
                onChange={() =>
                  void save([...rules.data!, insultsRule(t`Arabic insults`)])
                }
              />
            )}
          />
        </Show>
        <Show when={error() && !draft()}>
          <SettingsRow
            icon={<Icon name="warning-circle" size={20} />}
            title={<span role="alert">{error()}</span>}
          />
        </Show>
      </SettingsSection>

      <Show when={draft()}>
        {(rule) => (
          <Dialog
            show
            onClose={() => setDraft(undefined)}
            title={isNew() ? <Trans>New rule</Trans> : <Trans>Edit rule</Trans>}
            width={520}
            actions={[
              ...(isNew()
                ? []
                : [
                    {
                      text: <Trans>Delete</Trans>,
                      variant: "destructive" as const,
                      isDisabled: saving(),
                      onClick: () => {
                        setRemoving(rule());
                        return false;
                      },
                    },
                  ]),
              { text: <Trans>Cancel</Trans>, variant: "secondary" as const },
              {
                text: <Trans>Save</Trans>,
                variant: "primary" as const,
                isDisabled: !!draftProblem(rule()) || saving(),
                isLoading: saving(),
                onClick: () => save(upsertRule(rules.data ?? [], rule())),
              },
            ]}
          >
            <Fields>
              <TextField
                label={t`Name`}
                value={rule().name}
                maxlength={64}
                onInput={(e) => {
                  const value = e.currentTarget.value;
                  update((r) => (r.name = value));
                }}
              />

              <FloatingSelect
                label={t`Looks for`}
                value={rule().trigger.type}
                onChange={(e) =>
                  setTrigger(
                    defaultTrigger(e.currentTarget.value as TriggerType),
                  )
                }
              >
                <For each={TRIGGER_TYPES}>
                  {(type) => <MenuItem value={type}>{typeName(type)}</MenuItem>}
                </For>
              </FloatingSelect>

              <Switch>
                <Match
                  when={rule().trigger.type === "Keywords" && rule().trigger}
                >
                  {(trigger) => {
                    const keywords = () =>
                      trigger() as Extract<
                        AutoModTrigger,
                        { type: "Keywords" }
                      >;
                    return (
                      <>
                        <TextField
                          label={t`Words and phrases`}
                          placeholder={t`One per line. Put * at the start or end to match part of a word.`}
                          rows={4}
                          value={formatList(keywords().words)}
                          onChange={(e) =>
                            setTrigger({
                              ...keywords(),
                              words: parseList(e.currentTarget.value),
                            })
                          }
                        />
                        <TextField
                          label={t`Always allowed`}
                          placeholder={t`Words that are fine, one per line`}
                          rows={2}
                          value={formatList(keywords().allow)}
                          onChange={(e) =>
                            setTrigger({
                              ...keywords(),
                              allow: parseList(e.currentTarget.value),
                            })
                          }
                        />
                        <Hint>
                          <Trans>
                            Arabic matches with or without hamza, tashkeel and
                            tatweel, and ة / ه, ى / ي alike.
                          </Trans>
                        </Hint>
                      </>
                    );
                  }}
                </Match>
                <Match
                  when={rule().trigger.type === "MentionSpam" && rule().trigger}
                >
                  {(trigger) => (
                    <TextField
                      label={t`Most mentions in one message`}
                      type="number"
                      value={
                        (
                          trigger() as Extract<
                            AutoModTrigger,
                            { type: "MentionSpam" }
                          >
                        ).max
                      }
                      onInput={(e) =>
                        setTrigger({
                          type: "MentionSpam",
                          max: Number(e.currentTarget.value),
                        })
                      }
                    />
                  )}
                </Match>
                <Match
                  when={rule().trigger.type === "LinkSpam" && rule().trigger}
                >
                  {(trigger) => {
                    const links = () =>
                      trigger() as Extract<
                        AutoModTrigger,
                        { type: "LinkSpam" }
                      >;
                    return (
                      <>
                        <FloatingSelect
                          label={t`Links from members who joined less than`}
                          value={String(links().new_member_minutes ?? 0)}
                          onChange={(e) =>
                            setTrigger({
                              ...links(),
                              new_member_minutes:
                                Number(e.currentTarget.value) || null,
                            })
                          }
                        >
                          <MenuItem value="0">{t`Off`}</MenuItem>
                          <MenuItem value="10">{t`10 minutes`}</MenuItem>
                          <MenuItem value="60">{t`1 hour`}</MenuItem>
                          <MenuItem value="1440">{t`1 day`}</MenuItem>
                          <MenuItem value="10080">{t`7 days`}</MenuItem>
                        </FloatingSelect>
                        <TextField
                          label={t`Allowed domains (optional)`}
                          placeholder={t`One per line, for example zrzur.com`}
                          rows={2}
                          value={formatList(links().allowed_domains)}
                          onChange={(e) =>
                            setTrigger({
                              ...links(),
                              allowed_domains: parseList(e.currentTarget.value),
                            })
                          }
                        />
                      </>
                    );
                  }}
                </Match>
                <Match
                  when={
                    rule().trigger.type === "RepeatedMessages" && rule().trigger
                  }
                >
                  {(trigger) => {
                    const repeated = () =>
                      trigger() as Extract<
                        AutoModTrigger,
                        { type: "RepeatedMessages" }
                      >;
                    return (
                      <Row>
                        <TextField
                          label={t`Same text in channels`}
                          type="number"
                          value={repeated().channels}
                          onInput={(e) =>
                            setTrigger({
                              ...repeated(),
                              channels: Number(e.currentTarget.value),
                            })
                          }
                        />
                        <TextField
                          label={t`Within seconds`}
                          type="number"
                          value={repeated().seconds}
                          onInput={(e) =>
                            setTrigger({
                              ...repeated(),
                              seconds: Number(e.currentTarget.value),
                            })
                          }
                        />
                      </Row>
                    );
                  }}
                </Match>
              </Switch>

              <SubTitle>
                <Trans>When it matches</Trans>
              </SubTitle>
              <SettingsRow
                title={<Trans>Block the message</Trans>}
                description={
                  <Trans>The member sees the rule's name as the reason.</Trans>
                }
                control={(ids) => (
                  <Toggle
                    checked={!!rule().actions.block}
                    aria-labelledby={ids.labelId}
                    onChange={() =>
                      update((r) => (r.actions.block = !r.actions.block))
                    }
                  />
                )}
              />
              <Row>
                <FloatingSelect
                  label={t`Send an alert to`}
                  value={rule().actions.alert_channel ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    update((r) => (r.actions.alert_channel = value || null));
                  }}
                >
                  <MenuItem value="">{t`Off`}</MenuItem>
                  <For each={textChannels()}>
                    {(channel) => (
                      <MenuItem value={channel.id}>#{channel.name}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
                <FloatingSelect
                  label={t`Time out for`}
                  value={String(rule().actions.timeout_minutes ?? 0)}
                  onChange={(e) => {
                    const value = Number(e.currentTarget.value);
                    update((r) => (r.actions.timeout_minutes = value || null));
                  }}
                >
                  <MenuItem value="0">{t`Off`}</MenuItem>
                  <MenuItem value="1">{t`1 minute`}</MenuItem>
                  <MenuItem value="10">{t`10 minutes`}</MenuItem>
                  <MenuItem value="60">{t`1 hour`}</MenuItem>
                  <MenuItem value="1440">{t`1 day`}</MenuItem>
                  <MenuItem value="10080">{t`7 days`}</MenuItem>
                </FloatingSelect>
              </Row>

              <SubTitle>
                <Trans>Not checked</Trans>
              </SubTitle>
              <Chips>
                <For each={props.server.orderedRoles}>
                  {(role) => (
                    <Chip>
                      <input
                        type="checkbox"
                        checked={rule().exempt_roles?.includes(role.id)}
                        onChange={(e) => {
                          const on = e.currentTarget.checked;
                          update((r) => {
                            const set = new Set(r.exempt_roles ?? []);
                            if (on) set.add(role.id);
                            else set.delete(role.id);
                            r.exempt_roles = [...set];
                          });
                        }}
                      />
                      {role.name}
                    </Chip>
                  )}
                </For>
                <For each={textChannels()}>
                  {(channel) => (
                    <Chip>
                      <input
                        type="checkbox"
                        checked={rule().exempt_channels?.includes(channel.id)}
                        onChange={(e) => {
                          const on = e.currentTarget.checked;
                          update((r) => {
                            const set = new Set(r.exempt_channels ?? []);
                            if (on) set.add(channel.id);
                            else set.delete(channel.id);
                            r.exempt_channels = [...set];
                          });
                        }}
                      />
                      #{channel.name}
                    </Chip>
                  )}
                </For>
              </Chips>

              <Show when={problemText(rule()) ?? error()}>
                <Hint role="alert">{problemText(rule()) ?? error()}</Hint>
              </Show>
            </Fields>
          </Dialog>
        )}
      </Show>
      <Show when={removing()}>
        {(rule) => (
          <ConfirmDialog
            title={<Trans>Delete this rule?</Trans>}
            confirm={<Trans>Delete rule</Trans>}
            onConfirm={async () => {
              const done = await save(
                rules.data!.filter((entry) => entry.id !== rule().id),
              );
              if (!done) throw new Error("not saved");
              setDraft(undefined);
            }}
            onClose={() => setRemoving(undefined)}
          >
            <Trans>
              "{rule().name}" stops filtering messages right away.
            </Trans>
          </ConfirmDialog>
        )}
      </Show>
    </>
  );
}

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});

const Row = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    "@media (max-width: 600px)": { gridTemplateColumns: "1fr" },
  },
});

const SubTitle = styled("h4", {
  base: {
    margin: "8px 0 0",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-secondary)",
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const Chips = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const Chip = styled("label", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "32px",
    paddingInline: "10px",
    borderRadius: "999px",
    border: "1px solid var(--z-border-subtle)",
    fontSize: "13px",
    color: "var(--z-fg-primary)",
    cursor: "pointer",
    "&:focus-within": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& input": { accentColor: "var(--z-accent)" },
  },
});
