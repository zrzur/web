import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { TranslatedError } from "@revolt/i18n/errors";
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

import { useSaved } from "./savedNotice";

type Draft = { category: string; staff_roles: string[]; message: string };

const draftOf = (server: Server): Draft => ({
  category: server.tickets?.category ?? "",
  staff_roles: [...(server.tickets?.staff_roles ?? [])],
  message: server.tickets?.message ?? "",
});

/**
 * Tickets: members open a private channel with the server's staff. The
 * switch saves at once; where tickets go, who answers and the first message
 * are saved together. The server checks all of it (tickets.rs).
 */
export function TicketsSettings(props: { server: Server }) {
  const { t } = useLingui();
  const saved = useSaved();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  // eslint-disable-next-line solid/reactivity
  const [draft, setDraft] = createSignal(draftOf(props.server));

  const canManage = () => props.server.havePermission("ManageServer");
  const on = () => props.server.tickets?.enabled === true;
  const stored = () => draftOf(props.server);
  const dirty = () => JSON.stringify(draft()) !== JSON.stringify(stored());

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

  const toggleRole = (id: string) =>
    setDraft((now) => ({
      ...now,
      staff_roles: now.staff_roles.includes(id)
        ? now.staff_roles.filter((role) => role !== id)
        : now.staff_roles.length < 10
          ? [...now.staff_roles, id]
          : now.staff_roles,
    }));

  return (
    <Column gap="lg">
      <SettingsSection>
        <SettingsRow
          title={t`Tickets`}
          description={t`Members get an "Open a ticket" row at the top of the channel list.`}
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
      </SettingsSection>

      <Show when={on()}>
        <Panel>
          <Field>
            <FieldLabel id="tickets-category">
              <Trans>Category for new tickets</Trans>
            </FieldLabel>
            <SelectWidth>
              <FloatingSelect
                aria-labelledby="tickets-category"
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
          </Field>

          <Field>
            <FieldLabel>
              <Trans>Roles that answer tickets</Trans>
            </FieldLabel>
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
              <Chips>
                <For each={props.server.orderedRoles}>
                  {(role) => (
                    <Chip
                      type="button"
                      disabled={!canManage()}
                      aria-pressed={draft().staff_roles.includes(role.id)}
                      onClick={() => toggleRole(role.id)}
                    >
                      <RoleDot
                        style={{ background: role.colour ?? undefined }}
                      />
                      {role.name}
                    </Chip>
                  )}
                </For>
              </Chips>
            </Show>
          </Field>

          <TextField
            label={t`First message in a ticket`}
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

          <Show when={dirty()}>
            <Actions>
              <Button
                variant="text"
                isDisabled={pending()}
                onPress={() => setDraft(stored())}
              >
                <Trans>Reset</Trans>
              </Button>
              <Button
                isDisabled={pending()}
                data-testid="tickets-save"
                onPress={() => void send(true, draft())}
              >
                <Trans>Save</Trans>
              </Button>
            </Actions>
          </Show>
        </Panel>
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
    </Column>
  );
}

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-raised)",
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

const Actions = styled("div", {
  base: { display: "flex", justifyContent: "flex-end", gap: "8px" },
});
