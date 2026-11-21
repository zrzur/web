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
  createEffect(() => {
    const server = props.context.server;
    if (!server) return;
    for (const id of people()) {
      if (asked.has(id) || memberOf(id)) continue;
      asked.add(id);
      void server.fetchMember(id).catch(() => undefined);
    }
  });

  const memberOf = (id: string) =>
    props.context.serverId
      ? client().serverMembers.getByKey({
          server: props.context.serverId,
          user: id,
        })
      : undefined;
  const nameOf = (id: string) =>
    memberOf(id)?.displayName ?? client().users.get(id)?.displayName ?? id;
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

  const add = async (id: string) => {
    if (await save(id, memberAdd(overrides()[id]))) setPicking(false);
  };
  const remove = (id: string) => save(id, memberRemove(overrides()[id]));

  const exclude = () => [
    ...people(),
    ...(props.context.server?.ownerId ? [props.context.server.ownerId] : []),
  ];

  return (
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
              onPress={() => setPicking(!picking())}
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
              testId="channel-people-picker"
            />
          </PickerBox>
        )}
      </Show>

      <For each={people()}>
        {(id) => (
          <SettingsRow
            data-testid={`channel-person-${id}`}
            icon={<Avatar size={20} src={avatarOf(id)} fallback={nameOf(id)} />}
            title={<Name>{nameOf(id)}</Name>}
            description={
              props.isPrivate ? (
                <Trans>Can see this channel</Trans>
              ) : (
                <Trans>Can't see this channel</Trans>
              )
            }
            control={() => (
              <Show when={props.canEdit}>
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
