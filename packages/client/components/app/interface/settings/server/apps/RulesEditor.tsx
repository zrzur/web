import { For, Show, createMemo, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Button, FloatingSelect, MenuItem, Segmented } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { fetchAllMembers } from "../members/fetchMemberPage";

import {
  type Rule,
  type RuleType,
  removeRule,
  setRule,
  sortRules,
} from "./rules";

/**
 * The rules of one scope (the whole app, or one command): each one a role,
 * member or channel with Allow or Deny, and a line to add another. Every
 * change is saved at once; a failure is shown here and the list goes back.
 */
export function RulesEditor(props: {
  server: Server;
  rules: Rule[];
  /** Saves the whole list; rejects on failure */
  onSave: (rules: Rule[]) => Promise<unknown>;
  label: string;
  /** Locks every control (the rules could not be loaded) */
  disabled?: boolean;
}) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();

  const [rules, setRules] = createSignal<Rule[]>(props.rules);
  const [saving, setSaving] = createSignal(false);
  // nothing can be changed while a save is on its way
  const locked = () => saving() || !!props.disabled;
  const [error, setError] = createSignal<string>();

  const [kind, setKind] = createSignal<RuleType>("Role");
  const [target, setTarget] = createSignal("");
  const [allow, setAllow] = createSignal<"allow" | "deny">("allow");

  // members are only fetched when someone wants a rule for one
  const [members] = createResource(
    () => (kind() === "Member" ? props.server : undefined),
    (server) => fetchAllMembers(client(), server).catch(() => []),
  );

  async function save(next: Rule[]) {
    if (locked()) return;
    const before = rules();
    setRules(next);
    setSaving(true);
    setError(undefined);
    try {
      await props.onSave(next);
    } catch (err) {
      setRules(before);
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  const roleName = (id: string) =>
    id === props.server.id
      ? t`Everyone`
      : (props.server.roles.get(id)?.name ?? t`Deleted role`);
  const channelName = (id: string) =>
    id === props.server.id
      ? t`Every channel`
      : `#${client().channels.get(id)?.name ?? t`deleted channel`}`;
  const memberName = (id: string) => {
    const member = client().serverMembers.getByKey({
      server: props.server.id,
      user: id,
    });
    const user = client().users.get(id);
    return member?.displayName ?? user?.displayName ?? user?.username ?? id;
  };
  const name = (rule: Rule) =>
    rule.type === "Role"
      ? roleName(rule.id)
      : rule.type === "Channel"
        ? channelName(rule.id)
        : memberName(rule.id);

  const ruleKeys = createMemo(() =>
    sortRules(rules(), props.server.id).map(
      (rule) => `${rule.type}:${rule.id}`,
    ),
  );

  /** What the second menu offers for the chosen kind */
  const targets = createMemo(() => {
    const taken = new Set(
      rules()
        .filter((rule) => rule.type === kind())
        .map((rule) => rule.id),
    );
    let list: { id: string; name: string }[] = [];
    if (kind() === "Role") {
      list = [
        { id: props.server.id, name: t`Everyone` },
        ...props.server.orderedRoles.map((role) => ({
          id: role.id,
          name: role.name,
        })),
      ];
    } else if (kind() === "Channel") {
      list = [
        { id: props.server.id, name: t`Every channel` },
        ...props.server.channels
          .filter((channel) => channel.type === "TextChannel")
          .map((channel) => ({ id: channel.id, name: `#${channel.name}` })),
      ];
    } else {
      list = (members() ?? [])
        .filter((member) => !member.user?.bot)
        .map((member) => ({
          id: member.id.user,
          name: member.displayName ?? member.user?.username ?? member.id.user,
        }));
    }
    return list.filter((entry) => !taken.has(entry.id));
  });

  function add() {
    if (!target()) return;
    void save(
      setRule(rules(), {
        id: target(),
        type: kind(),
        permission: allow() === "allow",
      }),
    );
    setTarget("");
  }

  return (
    <Editor aria-label={props.label} aria-busy={saving()} disabled={locked()}>
      <Show
        when={rules().length}
        fallback={
          <Empty>
            <Trans>
              No rules: everyone who has the permissions the bot asks for can
              use it, in every channel.
            </Trans>
          </Empty>
        }
      >
        <Rows>
          {/* rows keyed by type:id, so a row is not rebuilt when its rule changes */}
          <For each={ruleKeys()}>
            {(key) => {
              const rule = () =>
                rules().find((entry) => `${entry.type}:${entry.id}` === key)!;
              return (
                <Show when={rule()}>
                  <li data-rule={key}>
                    <Icon
                      name={
                        rule().type === "Role"
                          ? "shield"
                          : rule().type === "Channel"
                            ? "hash"
                            : "user"
                      }
                      size={16}
                    />
                    <RuleName dir="auto">{name(rule())}</RuleName>
                    <Segmented
                      aria-label={t`Allow or deny ${name(rule())}`}
                      value={rule().permission ? "allow" : "deny"}
                      options={[
                        { value: "allow", label: t`Allow` },
                        { value: "deny", label: t`Deny` },
                      ]}
                      onChange={(value) =>
                        void save(
                          setRule(rules(), {
                            ...rule(),
                            permission: value === "allow",
                          }),
                        )
                      }
                    />
                    <Button
                      size="sm"
                      variant="text"
                      aria-label={t`Remove the rule for ${name(rule())}`}
                      isDisabled={locked()}
                      onPress={() =>
                        void save(removeRule(rules(), rule().type, rule().id))
                      }
                    >
                      <Icon name="x" size={16} />
                    </Button>
                  </li>
                </Show>
              );
            }}
          </For>
        </Rows>
      </Show>

      <AddRow>
        <FloatingSelect
          label={t`Rule for`}
          value={kind()}
          onChange={(e) => {
            setKind(e.currentTarget.value as RuleType);
            setTarget("");
          }}
        >
          <MenuItem value="Role">{t`A role`}</MenuItem>
          <MenuItem value="Member">{t`A member`}</MenuItem>
          <MenuItem value="Channel">{t`A channel`}</MenuItem>
        </FloatingSelect>
        <FloatingSelect
          label={t`Which one`}
          value={target()}
          disabled={kind() === "Member" && members.loading}
          onChange={(e) => setTarget(e.currentTarget.value)}
        >
          <For each={targets()}>
            {(entry) => <MenuItem value={entry.id}>{entry.name}</MenuItem>}
          </For>
        </FloatingSelect>
        <Segmented
          aria-label={t`Allow or deny`}
          value={allow()}
          options={[
            { value: "allow", label: t`Allow` },
            { value: "deny", label: t`Deny` },
          ]}
          onChange={setAllow}
        />
        <Button size="sm" isDisabled={!target() || locked()} onPress={add}>
          <Trans>Add rule</Trans>
        </Button>
      </AddRow>

      <Show when={error()}>
        <ErrorLine role="alert">{error()}</ErrorLine>
      </Show>
    </Editor>
  );
}

const Editor = styled("fieldset", {
  base: {
    margin: 0,
    border: "none",
    minInlineSize: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px 16px",
    minWidth: 0,
  },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const Rows = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "8px 12px",
      minWidth: 0,
    },
  },
});

const RuleName = styled("span", {
  base: {
    flex: "1 1 120px",
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const AddRow = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr) auto auto",
    alignItems: "end",
    gap: "8px",
    _phone: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const ErrorLine = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-status-error)",
  },
});
