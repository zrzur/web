import { For, Show, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Everything the member of a temporary room does with it, in one small
 * panel right at the call:
 *
 * [ name of the room                ] [Save]
 * People at most   [-]  no limit  [+]
 * [lock] Locked   only the people you let in can join        ( o)
 * [eye]  Hidden   only the people you let in can see it      ( o)
 * In the room:    name                         [Hand over]
 * Let in:         [ find a member    ] [Search]   name [Let in] / [Remove]
 */
export default function RoomControlsPanel(props: {
  channel: Channel;
  /** shown inside a dialog that has its own title */
  bare?: boolean;
  onClose?: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const { showError } = useModals();
  const [pending, setPending] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [found, setFound] = createSignal<{ id: string; name: string }[]>([]);
  const [searched, setSearched] = createSignal(false);
  // eslint-disable-next-line solid/reactivity
  const [name, setName] = createSignal(props.channel.name ?? "");

  // someone else renamed it meanwhile: show what it is called now
  createEffect(
    on(
      () => props.channel.name,
      (now) => setName(now ?? ""),
      { defer: true },
    ),
  );

  const ownerId = () => props.channel.temporaryForId;
  const serverId = () => props.channel.serverId!;
  const nameOf = (id: string) =>
    client().serverMembers.getByKey({ server: serverId(), user: id })
      ?.displayName ??
    client().users.get(id)?.displayName ??
    id;

  const limit = () => props.channel.voice?.maxUsers ?? 0;
  const locked = () => !!props.channel.voice?.locked;
  const hidden = () => !!props.channel.voice?.hidden;
  const inside = () =>
    [...props.channel.voiceParticipants.keys()].filter(
      (id) => id !== ownerId() && !client().users.get(id)?.bot,
    );
  const guests = () =>
    Object.keys(props.channel.memberPermissions ?? {}).filter(
      (id) => id !== ownerId(),
    );

  async function run(action: () => Promise<unknown>) {
    if (pending()) return;
    setPending(true);
    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setPending(false);
    }
  }

  const rename = () => {
    const next = name().trim();
    if (!next || next === props.channel.name) return;
    void run(() => props.channel.edit({ name: next }));
  };

  /** 0 takes the limit away; the server caps the rest */
  const setLimit = (next: number) =>
    void run(() =>
      props.channel.edit({
        voice: { max_users: Math.max(0, Math.min(99, next)) },
      }),
    );

  async function search() {
    const text = query().trim();
    if (!text) return;
    await run(async () => {
      const result = await props.channel.server!.queryMembersExperimental(text);
      const taken = new Set([ownerId(), ...guests()]);
      setFound(
        result.members
          .filter((member) => !taken.has(member.id.user))
          .slice(0, 5)
          .map((member) => ({
            id: member.id.user,
            name: member.displayName ?? member.id.user,
          })),
      );
      setSearched(true);
    });
  }

  const switchRow = (
    icon: "lock-simple" | "eye-slash",
    title: string,
    line: string,
    on: () => boolean,
    change: () => Promise<unknown>,
    testId: string,
  ) => (
    <SwitchRow
      type="button"
      role="switch"
      aria-checked={on()}
      aria-disabled={pending()}
      data-testid={testId}
      onClick={() => void run(change)}
    >
      <Icon name={icon} size={20} />
      <SwitchText>
        <strong>{title}</strong>
        <span>{line}</span>
      </SwitchText>
      <Knob data-on={on() ? "" : undefined} aria-hidden="true" />
    </SwitchRow>
  );

  return (
    <Box data-room-controls data-bare={props.bare ? "" : undefined}>
      <Show when={!props.bare}>
        <Head>
          <HeadTitle>
            <Trans>Your room</Trans>
          </HeadTitle>
          <Close
            type="button"
            aria-label={t`Close`}
            onClick={() => props.onClose?.()}
          >
            <Icon name="x" size={16} />
          </Close>
        </Head>
      </Show>

      <NameRow
        onSubmit={(event) => {
          event.preventDefault();
          rename();
        }}
      >
        <NameInput
          aria-label={t`Room name`}
          maxlength={32}
          value={name()}
          data-testid="room-name"
          onInput={(event) => setName(event.currentTarget.value)}
        />
        <Small
          type="submit"
          aria-disabled={
            pending() || !name().trim() || name().trim() === props.channel.name
          }
          data-testid="room-rename"
        >
          <Trans>Save</Trans>
        </Small>
      </NameRow>

      <LimitRow>
        <span id="room-limit-label">
          <Trans>People at most</Trans>
        </span>
        <Stepper role="group" aria-labelledby="room-limit-label">
          <Step
            type="button"
            aria-label={t`Fewer people`}
            aria-disabled={pending() || limit() === 0}
            data-testid="room-limit-less"
            onClick={() => limit() > 0 && setLimit(limit() - 1)}
          >
            <Icon name="minus" size={16} />
          </Step>
          <LimitValue data-testid="room-limit" aria-live="polite">
            {limit() || t`No limit`}
          </LimitValue>
          <Step
            type="button"
            aria-label={t`More people`}
            aria-disabled={pending() || limit() >= 99}
            data-testid="room-limit-more"
            onClick={() => setLimit(limit() === 0 ? 2 : limit() + 1)}
          >
            <Icon name="plus" size={16} />
          </Step>
        </Stepper>
      </LimitRow>

      {switchRow(
        "lock-simple",
        t`Locked`,
        t`Only the people you let in can join. People already inside stay.`,
        locked,
        () => props.channel.editRoom({ locked: !locked() }),
        "room-lock",
      )}
      {switchRow(
        "eye-slash",
        t`Hidden`,
        t`Only the people you let in can see the room.`,
        hidden,
        () => props.channel.editRoom({ hidden: !hidden() }),
        "room-hide",
      )}

      <Show when={inside().length}>
        <Group>
          <GroupTitle>
            <Trans>In the room</Trans>
          </GroupTitle>
          <For each={inside()}>
            {(id) => (
              <Person>
                <PersonName>{nameOf(id)}</PersonName>
                <Small
                  type="button"
                  aria-disabled={pending()}
                  data-testid={`room-give-${id}`}
                  onClick={() =>
                    void run(async () => {
                      await props.channel.editRoom({ owner: id });
                      props.onClose?.();
                    })
                  }
                >
                  <Trans>Hand over the room</Trans>
                </Small>
              </Person>
            )}
          </For>
        </Group>
      </Show>

      <Group>
        <GroupTitle>
          <Trans>People you let in</Trans>
        </GroupTitle>
        <For each={guests()}>
          {(id) => (
            <Person>
              <PersonName>{nameOf(id)}</PersonName>
              <Small
                type="button"
                aria-disabled={pending()}
                onClick={() =>
                  void run(() => props.channel.removeRoomGuest(id))
                }
              >
                <Trans>Remove</Trans>
              </Small>
            </Person>
          )}
        </For>
        <NameRow
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <NameInput
            aria-label={t`Find a member`}
            placeholder={t`Find a member`}
            maxlength={32}
            value={query()}
            data-testid="room-find"
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setSearched(false);
            }}
          />
          <Small type="submit" aria-disabled={pending() || !query().trim()}>
            <Trans>Search</Trans>
          </Small>
        </NameRow>
        <For each={found()}>
          {(person) => (
            <Person>
              <PersonName>{person.name}</PersonName>
              <Small
                type="button"
                aria-disabled={pending()}
                onClick={() =>
                  void run(async () => {
                    await props.channel.addRoomGuest(person.id);
                    setFound((list) =>
                      list.filter((one) => one.id !== person.id),
                    );
                  })
                }
              >
                <Trans>Let in</Trans>
              </Small>
            </Person>
          )}
        </For>
        <Show when={searched() && !found().length}>
          <Empty>
            <Trans>Nobody found by that name.</Trans>
          </Empty>
        </Show>
      </Group>
    </Box>
  );
}

const Box = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    maxHeight: "min(70vh, 560px)",
    overflowY: "auto",
    // the same chrome as the call card it opens above, so the two read as
    // one piece
    borderRadius: "var(--z-dock-radius, 12px)",
    border: "1px solid var(--z-dock-border)",
    background: "var(--z-dock-bg)",
    boxShadow: "var(--z-dock-lift)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    "&[data-bare]": {
      padding: 0,
      border: "none",
      background: "none",
      boxShadow: "none",
      maxHeight: "none",
    },
  },
});

const Head = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "8px" },
});

const HeadTitle = styled("strong", {
  base: { flex: 1, fontSize: "14px", fontWeight: 700 },
});

const Close = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    border: "none",
    borderRadius: "6px",
    background: "none",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const NameRow = styled("form", {
  base: { display: "flex", alignItems: "center", gap: "8px" },
});

const NameInput = styled("input", {
  base: {
    flex: 1,
    minWidth: 0,
    height: "36px",
    paddingInline: "12px",
    borderRadius: "8px",
    border: "1px solid transparent",
    background: "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    fontSize: "14px",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { height: "44px" },
  },
});

const Small = styled("button", {
  base: {
    flexShrink: 0,
    height: "32px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    _hover: {
      background: "color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[aria-disabled='true']": { opacity: 0.4, cursor: "not-allowed" },
    _phone: { height: "44px" },
  },
});

const LimitRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    color: "var(--z-fg-secondary)",
  },
});

const Stepper = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "4px" },
});

const Step = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",
    color: "var(--z-fg-primary)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: {
      background: "color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[aria-disabled='true']": { opacity: 0.4, cursor: "not-allowed" },
    _phone: { width: "44px", height: "44px" },
  },
});

const LimitValue = styled("span", {
  base: {
    minWidth: "72px",
    textAlign: "center",
    color: "var(--z-fg-primary)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
});

const SwitchRow = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px",
    border: "none",
    borderRadius: "8px",
    background: "none",
    color: "inherit",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-fg-secondary)",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[aria-disabled='true']": { opacity: 0.6, cursor: "progress" },
  },
});

const SwitchText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& strong": { fontSize: "14px", fontWeight: 600 },
    "& span": { fontSize: "12px", color: "var(--z-fg-secondary)" },
  },
});

const Knob = styled("span", {
  base: {
    flexShrink: 0,
    position: "relative",
    width: "36px",
    height: "20px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--z-fg-primary) 18%, transparent)",
    transition: "background-color .15s ease",
    _after: {
      content: '""',
      position: "absolute",
      top: "2px",
      insetInlineStart: "2px",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: "var(--z-fg-secondary)",
      transition: "inset-inline-start .15s ease, background-color .15s ease",
    },
    "&[data-on]": { background: "var(--z-accent-fill, var(--z-accent))" },
    "&[data-on]::after": {
      insetInlineStart: "18px",
      background: "var(--z-on-accent, #fff)",
    },
  },
});

const Group = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const GroupTitle = styled("span", {
  base: { fontSize: "12px", fontWeight: 700, color: "var(--z-fg-secondary)" },
});

const Person = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "40px",
    paddingInlineStart: "12px",
    paddingInlineEnd: "4px",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--z-fg-primary) 5%, transparent)",
  },
});

const PersonName = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Empty = styled("span", {
  base: { fontSize: "12px", color: "var(--z-fg-secondary)" },
});
