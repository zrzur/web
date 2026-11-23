import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { errorDetails } from "@revolt/i18n/errors";
import { Avatar, Button, SettingsRow } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { MemberPicker } from "../../../../../../src/interface/events/MemberPicker";

import { pairs } from "./VisibilitySection";
import { listedPeople, memberAdd, memberRemove } from "./visibility";

/**
 * The people of a channel with access of their own: on a private channel
 * the ones let in one by one (with "Add people"), on an open one the ones it
 * is hidden from. Shown inside "Who can see this channel", under the roles.
 */
export function VisibilityPeople(props: {
  context: Channel;
  isPrivate: boolean;
  canEdit: boolean;
  /** Say a change aloud (the live region lives outside the panel) */
  onSay: (text: string) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const [busy, setBusy] = createSignal<string>();
  const [error, setError] = createSignal<unknown>();
  const [picking, setPicking] = createSignal(false);

  const overrides = createMemo(() => pairs(props.context.memberPermissions));
  const people = createMemo(() => listedPeople(overrides(), props.isPrivate));

  // names and pictures of people not loaded yet: asked for once each
  const asked = new Set<string>();
  /** People the server no longer has as members */
  const [gone, setGone] = createSignal<ReadonlySet<string>>(new Set());
  createEffect(() => {
    const server = props.context.server;
    if (!server) return;
    for (const id of people()) {
      if (asked.has(id) || memberOf(id)) continue;
      asked.add(id);
      void server
        .fetchMember(id)
        .catch(() => setGone((now) => new Set([...now, id])));
    }
  });

  const memberOf = (id: string) =>
    props.context.serverId
      ? client().serverMembers.getByKey({
          server: props.context.serverId,
          user: id,
        })
      : undefined;
  // never a raw id: someone who left is named as such, and keeps Remove
  const nameOf = (id: string) =>
    memberOf(id)?.displayName ??
    (gone().has(id) ? t`A member who left` : undefined) ??
    client().users.get(id)?.displayName ??
    t`Member`;
  const avatarOf = (id: string) =>
    memberOf(id)?.animatedAvatarURL ??
    client().users.get(id)?.animatedAvatarURL;

  /** The plain words for what the API refused */
  const message = (err: unknown) => {
    switch ((err as { type?: string } | undefined)?.type) {
      case "MissingPermission":
        return t`You need “Manage permissions” to change who can see this channel.`;
      case "NotElevated":
        return t`You can't change access for someone ranked the same as you or above you.`;
      case "CannotGiveMissingPermissions":
        return t`You can't give permissions you don't have yourself.`;
      case "NotFound":
        return t`This person is no longer in the server.`;
      default:
        return describeError(err);
    }
  };

  async function save(id: string, next: { a: bigint; d: bigint }) {
    setBusy(id);
    setError(undefined);
    try {
      await props.context.setMemberPermissions(id, {
        allow: Number(next.a),
        deny: Number(next.d),
      });
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setBusy(undefined);
    }
  }

  const focusOn = (testId: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();

  const add = async (id: string) => {
    if (!(await save(id, memberAdd(overrides()[id])))) return;
    closePicker();
    const name = nameOf(id);
    // what certainly happened: roles may still decide what they see
    props.onSay(t`${name} was added to the list`);
    // back to the button that opened the picker
    queueMicrotask(() => focusOn("channel-people-add"));
  };

  /** After Remove, focus goes on once the row has gone: to the next row */
  const [leaving, setLeaving] = createSignal<{ id: string; next?: string }>();
  createEffect(() => {
    const pending = leaving();
    if (!pending || people().includes(pending.id)) return;
    setLeaving(undefined);
    const next =
      pending.next && people().includes(pending.next)
        ? `channel-person-remove-${pending.next}`
        : "channel-people-add";
    queueMicrotask(() => focusOn(next));
  });

  const remove = async (id: string) => {
    // your own row has no Remove, so it is skipped
    const removable = people().filter((other) => other !== self());
    const next = removable[removable.indexOf(id) + 1];
    if (!(await save(id, memberRemove(overrides()[id])))) return;
    const name = nameOf(id);
    props.onSay(t`${name} was removed from the list`);
    setLeaving({ id, next });
  };

  const closePicker = () => {
    setPicking(false);
    setError(undefined);
  };

  /** You: never offered in the picker, and your own row has no Remove */
  const self = () => client().user?.id;
  const exclude = () => [
    ...people(),
    ...(self() ? [self()!] : []),
    ...(props.context.server?.ownerId ? [props.context.server.ownerId] : []),
  ];

  return (
    <>
      <Show when={props.isPrivate || people().length}>
        <SettingsRow
          data-testid="channel-people"
          icon={<Icon name="users" size={20} />}
          title={<Trans>People</Trans>}
          description={
            <>
              <Show
                when={props.isPrivate}
                fallback={
                  <Trans>
                    These people can't see it, whatever their roles allow.
                  </Trans>
                }
              >
                <Trans>
                  People you add here can see it, whatever their roles.
                </Trans>
              </Show>
              <Show when={error()}>
                <ErrorBox role="alert" data-testid="channel-people-error">
                  <span>{message(error())}</span>
                  <Show when={errorDetails(error())}>
                    <details class="z-error-details">
                      <summary>
                        <Trans>Details</Trans>
                      </summary>
                      <code>{errorDetails(error())}</code>
                    </details>
                  </Show>
                </ErrorBox>
              </Show>
            </>
          }
          control={() => (
            <Show when={props.isPrivate && props.canEdit}>
              <Button
                data-testid="channel-people-add"
                size="sm"
                variant="tonal"
                isDisabled={!!busy()}
                aria-expanded={picking()}
                onPress={() => (picking() ? closePicker() : setPicking(true))}
              >
                <Show when={picking()} fallback={<Trans>Add people</Trans>}>
                  <Trans>Close</Trans>
                </Show>
              </Button>
            </Show>
          )}
        />

        <Show when={picking() && props.isPrivate && props.context.server}>
          {(server) => (
            <PickerBox>
              <MemberPicker
                server={server()}
                label={t`Add people`}
                value={[]}
                onChange={(ids) => {
                  const id = ids[ids.length - 1];
                  if (id && !busy()) void add(id);
                }}
                max={1}
                exclude={exclude()}
                keepQueryOnPick
                testId="channel-people-picker"
              />
            </PickerBox>
          )}
        </Show>

        <For each={people()}>
          {(id) => (
            <SettingsRow
              data-testid={`channel-person-${id}`}
              icon={
                <Avatar size={20} src={avatarOf(id)} fallback={nameOf(id)} />
              }
              title={<Name>{nameOf(id)}</Name>}
              description={
                props.isPrivate ? (
                  <Trans>Can see this channel</Trans>
                ) : (
                  <Trans>Can't see this channel</Trans>
                )
              }
              control={() => (
                <Show when={props.canEdit && id !== self()}>
                  <Button
                    data-testid={`channel-person-remove-${id}`}
                    size="sm"
                    variant="text"
                    isDisabled={!!busy()}
                    onPress={() => void remove(id)}
                    aria-label={t`Remove ${nameOf(id)} from this list`}
                  >
                    <Trans>Remove</Trans>
                  </Button>
                </Show>
              )}
            />
          )}
        </For>
      </Show>
    </>
  );
}

const PickerBox = styled("div", {
  base: {
    paddingBlock: "4px 12px",
    paddingInline: "16px",
  },
});

const Name = styled("span", {
  base: {
    display: "block",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const ErrorBox = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginTop: "4px",
    color: "var(--z-danger)",
  },
});
