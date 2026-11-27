import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel, Server, TicketType } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError, useError } from "@revolt/i18n/errors";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import {
  Button,
  Column,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  Text,
  TextField,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { usePageSaveRegistration } from "./pageSave";
import { useSaved } from "./savedNotice";

type Draft = {
  category: string;
  staff_roles: string[];
  message: string;
  label: string;
  types: Required<TicketType>[];
};

const draftOf = (server: Server): Draft => ({
  category: server.tickets?.category ?? "",
  staff_roles: [...(server.tickets?.staff_roles ?? [])],
  message: server.tickets?.message ?? "",
  label: server.tickets?.label ?? "",
  types: (server.tickets?.types ?? []).map((type) => ({
    id: type.id,
    name: type.name,
    staff_roles: [...(type.staff_roles ?? [])],
  })),
});

const MAX_TYPES = 5;
const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * Tickets: members open a private channel with the server's staff. The
 * switch saves at once; where tickets go, who answers, the kinds of ticket
 * and the first message are saved together. Under them, the tickets the
 * viewer can see. The server checks all of it (tickets.rs).
 */
export function TicketsSettings(props: { server: Server }) {
  const { t } = useLingui();
  const saved = useSaved();
  const errorText = useError();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  // eslint-disable-next-line solid/reactivity
  const [draft, setDraft] = createSignal(draftOf(props.server));

  const canManage = () => props.server.havePermission("ManageServer");
  const on = () => props.server.tickets?.enabled === true;
  const stored = () => draftOf(props.server);
  const dirty = () => JSON.stringify(draft()) !== JSON.stringify(stored());
  const typeIds = createMemo(() => draft().types.map((type) => type.id), [], {
    equals: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
  });
  const typesReady = () => draft().types.every((type) => type.name.trim());

  // Changes join the page's one save bar ("Unsaved changes · Save
  // changes"), as every other part of Overview does; the bar stays in
  // sight wherever on the page the change was made. Only outside a page
  // with that bar does this part show its own Save.
  const inPageBar = usePageSaveRegistration({
    dirty: () => on() && canManage() && dirty(),
    saving: pending,
    // plain words on the bar; the details stay under the section
    error: () => (error() ? errorText(error()) : undefined),
    canSave: typesReady,
    reset: () => setDraft(stored()),
    save: () => send(true, draft()),
  });

  async function send(enabled: boolean, values: Draft) {
    if (!canManage() || pending()) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.edit({
        tickets: {
          enabled,
          category: values.category || undefined,
          staff_roles: values.staff_roles,
          message: values.message.trim() || undefined,
          label: values.label.trim() || undefined,
          types: values.types.map((type) => ({
            ...type,
            name: type.name.trim(),
          })),
        },
      });
      setDraft(draftOf(props.server));
      saved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  const toggled = (list: string[], id: string) =>
    list.includes(id)
      ? list.filter((role) => role !== id)
      : list.length < 10
        ? [...list, id]
        : list;

  const setType = (id: string, change: Partial<Required<TicketType>>) =>
    setDraft((now) => ({
      ...now,
      types: now.types.map((type) =>
        type.id === id ? { ...type, ...change } : type,
      ),
    }));

  const roleChips = (chosen: () => string[], toggle: (id: string) => void) => (
    <Chips>
      <For each={props.server.orderedRoles}>
        {(role) => (
          <Chip
            type="button"
            disabled={!canManage()}
            aria-pressed={chosen().includes(role.id)}
            onClick={() => toggle(role.id)}
          >
            <RoleDot style={{ background: role.colour ?? undefined }} />
            {role.name}
          </Chip>
        )}
      </For>
    </Chips>
  );

  return (
    <Column gap="lg">
      <SettingsSection>
        <SettingsRow
          icon={<Icon name="ticket" size={20} />}
          title={t`Tickets`}
          description={t`Members get an "Open a ticket" entry in the server's menu.`}
          disabled={!canManage() || pending()}
          onClick={() => void send(!on(), stored())}
          control={(ids) => (
            <Toggle
              checked={on()}
              disabled={!canManage() || pending()}
              onChange={() => void send(!on(), stored())}
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
              data-testid="tickets-switch"
            />
          )}
        />
        <Show when={on()}>
          <SettingsRow
            icon={<Icon name="folder" size={20} />}
            title={t`Category for new tickets`}
            description={t`Where a new ticket appears in the channel list.`}
            control={(ids) => (
              <SelectWidth>
                <FloatingSelect
                  aria-labelledby={ids.labelId}
                  value={draft().category || "none"}
                  disabled={!canManage()}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setDraft((now) => ({
                      ...now,
                      category: value === "none" ? "" : value,
                    }));
                  }}
                >
                  <MenuItem value="none">
                    <Trans>No category</Trans>
                  </MenuItem>
                  <For each={props.server.categories ?? []}>
                    {(category) => (
                      <MenuItem value={category.id}>{category.title}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </SelectWidth>
            )}
          />
        </Show>
      </SettingsSection>

      <Show when={on()}>
        <SettingsSection
          title={<Trans>Who answers</Trans>}
          description={<Trans>The roles that see and answer tickets.</Trans>}
        >
          <Inside>
            <Field>
              <Show
                when={props.server.orderedRoles.length}
                fallback={
                  <Text class="label" size="small">
                    <Trans>
                      This server has no roles yet. Until it does, only people
                      who can see every channel answer tickets.
                    </Trans>
                  </Text>
                }
              >
                {roleChips(
                  () => draft().staff_roles,
                  (id) =>
                    setDraft((now) => ({
                      ...now,
                      staff_roles: toggled(now.staff_roles, id),
                    })),
                )}
              </Show>
            </Field>
          </Inside>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Kinds of ticket</Trans>}
          description={
            <Trans>
              With kinds, a member chooses one when opening a ticket, and each
              kind can go to roles of its own. Without any, there is one kind of
              ticket.
            </Trans>
          }
        >
          <Inside>
            <Field>
              {/* by id: a row keyed by its object is rebuilt on every letter,
                  and the field being typed in loses the cursor */}
              <For each={typeIds()}>
                {(typeId, index) => {
                  const type = {
                    id: typeId,
                    get name() {
                      return (
                        draft().types.find((one) => one.id === typeId)?.name ??
                        ""
                      );
                    },
                  };
                  return (
                    <TypeCard data-testid={`tickets-type-${index()}`}>
                      <TypeHead>
                        <TextField
                          label={t`Name`}
                          maxlength={32}
                          disabled={!canManage()}
                          value={type.name}
                          placeholder={t`Support`}
                          onInput={(e) =>
                            setType(type.id, { name: e.currentTarget.value })
                          }
                        />
                        <RemoveType
                          type="button"
                          disabled={!canManage()}
                          aria-label={t`Remove this kind`}
                          title={t`Remove this kind`}
                          onClick={() =>
                            setDraft((now) => ({
                              ...now,
                              types: now.types.filter(
                                (one) => one.id !== type.id,
                              ),
                            }))
                          }
                        >
                          <Icon name="trash" size={18} />
                        </RemoveType>
                      </TypeHead>
                      <Show when={props.server.orderedRoles.length}>
                        <FieldLabel>
                          <Trans>Answered by (none: the roles above)</Trans>
                        </FieldLabel>
                        {roleChips(
                          () =>
                            draft().types.find((one) => one.id === type.id)
                              ?.staff_roles ?? [],
                          (id) =>
                            setType(type.id, {
                              staff_roles: toggled(
                                draft().types.find((one) => one.id === type.id)
                                  ?.staff_roles ?? [],
                                id,
                              ),
                            }),
                        )}
                      </Show>
                    </TypeCard>
                  );
                }}
              </For>
              <Show when={draft().types.length < MAX_TYPES}>
                <AddRow>
                  <Button
                    size="sm"
                    variant="tonal"
                    isDisabled={!canManage()}
                    data-testid="tickets-add-type"
                    onPress={() =>
                      setDraft((now) => ({
                        ...now,
                        types: [
                          ...now.types,
                          { id: newId(), name: "", staff_roles: [] },
                        ],
                      }))
                    }
                  >
                    <Trans>Add a kind</Trans>
                  </Button>
                </AddRow>
              </Show>
            </Field>
          </Inside>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Name of the entry</Trans>}
          description={
            <Trans>
              What members see in the server's menu. Empty: "Open a ticket".
            </Trans>
          }
        >
          <Inside>
            <TextField
              aria-label={t`Name of the entry`}
              maxlength={32}
              disabled={!canManage()}
              value={draft().label}
              placeholder={t`Open a ticket`}
              data-testid="tickets-label"
              onInput={(e) => {
                const value = e.currentTarget.value;
                setDraft((now) => ({ ...now, label: value }));
              }}
            />
          </Inside>
        </SettingsSection>

        <SettingsSection title={<Trans>First message in a ticket</Trans>}>
          <Inside>
            <TextField
              aria-label={t`First message in a ticket`}
              autosize
              min-rows={2}
              maxlength={500}
              counter
              disabled={!canManage()}
              value={draft().message}
              placeholder={t`Tell us what you need and we will answer here.`}
              onInput={(e) => {
                const value = e.currentTarget.value;
                setDraft((now) => ({ ...now, message: value }));
              }}
            />

            <Show when={!inPageBar && dirty()}>
              <Actions>
                <Button
                  variant="text"
                  isDisabled={pending()}
                  onPress={() => setDraft(stored())}
                >
                  <Trans>Reset</Trans>
                </Button>
                <Button
                  isDisabled={pending() || !typesReady()}
                  data-testid="tickets-save"
                  onPress={() => void send(true, draft())}
                >
                  <Trans>Save</Trans>
                </Button>
              </Actions>
            </Show>
          </Inside>
        </SettingsSection>
      </Show>

      <Text class="label" size="small">
        <Trans>
          A ticket is a private channel: only the member who opened it, the
          roles you pick and the people who see every channel can read it.
        </Trans>
      </Text>
      <Show when={error()}>
        <div role="alert">
          <TranslatedError error={error()} />
        </div>
      </Show>

      <TicketBoard server={props.server} />
    </Column>
  );
}

/**
 * The tickets of a server that the viewer can see: how many are open, how
 * many are taken, and each ticket with its state.
 */
function TicketBoard(props: { server: Server }) {
  const { t } = useLingui();
  const client = useClient();
  const navigate = useNavigate();
  const { pop } = useModals();

  const tickets = createMemo(() =>
    props.server.channels
      .filter((channel) => channel.ticket)
      .sort((a, b) => b.ticket!.number - a.ticket!.number),
  );
  const open = () => tickets().filter((channel) => !channel.ticket!.closed);
  const taken = () => open().filter((channel) => channel.ticket!.claimedById);
  const nameOf = (id: string | undefined) =>
    id
      ? (client().serverMembers.getByKey({ server: props.server.id, user: id })
          ?.displayName ??
        client().users.get(id)?.displayName ??
        "")
      : "";

  const go = (channel: Channel) => {
    pop();
    navigate(`/server/${props.server.id}/channel/${channel.id}`);
  };

  return (
    <Show when={tickets().length}>
      <SettingsSection
        title={<Trans>Tickets you can see</Trans>}
        description={
          <Trans>Open, taken and closed tickets, newest first.</Trans>
        }
      >
        <Inside data-testid="ticket-board">
          <Counts>
            <Count>
              <strong data-testid="board-open">{open().length}</strong>
              <Trans>Open</Trans>
            </Count>
            <Count>
              <strong data-testid="board-taken">{taken().length}</strong>
              <Trans>Taken</Trans>
            </Count>
            <Count>
              <strong>{tickets().length - open().length}</strong>
              <Trans>Closed</Trans>
            </Count>
          </Counts>
        </Inside>
        <For each={tickets().slice(0, 50)}>
          {(channel) => (
            <SettingsRow
              navigational
              icon={<Icon name="ticket" size={20} />}
              title={channel.name}
              onClick={() => go(channel)}
              description={
                <>
                  {[
                    channel.ticket!.kind,
                    nameOf(channel.ticket!.openerId),
                    channel.ticket!.closed
                      ? t`Closed`
                      : channel.ticket!.claimedById
                        ? t`Taken by ${nameOf(channel.ticket!.claimedById)}`
                        : t`Waiting`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </>
              }
            />
          )}
        </For>
      </SettingsSection>
    </Show>
  );
}

/** The padded inside of a settings card, for what is not a row */
const Inside = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
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

const SelectWidth = styled("div", {
  base: { width: "min(260px, 100%)" },
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
    fontFamily: "inherit",
    fontSize: "14px",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _disabled: { cursor: "default", opacity: 0.6 },
    "&[aria-pressed=true]": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 16%, transparent)",
      color: "var(--z-fg-primary)",
    },
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

const TypeCard = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid var(--z-border-subtle)",
  },
});

const TypeHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    "& > :first-child": { flex: 1, minWidth: 0 },
  },
});

const RemoveType = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    // the settings' one quiet icon button: colour only, red to remove
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "6px",
    background: "none",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { color: "var(--z-danger)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { width: "44px", height: "44px" },
  },
});

const AddRow = styled("div", { base: { display: "flex" } });

const Actions = styled("div", {
  base: { display: "flex", justifyContent: "flex-end", gap: "8px" },
});

const Counts = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
    _phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
});

const Count = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px",
    borderRadius: "8px",
    background: "var(--z-bg-raised)",
    fontSize: "12px",
    color: "var(--z-fg-secondary)",
    "& strong": {
      fontSize: "20px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
      fontVariantNumeric: "tabular-nums",
    },
  },
});
