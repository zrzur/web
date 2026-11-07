import { For, Show, createResource, createSignal } from "solid-js";
import { type API, type WithoutNull, withoutNull } from "@zrzur/sdk/solid";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { resourceValue } from "@revolt/common/lib/resource";
import { useError } from "@revolt/i18n";
import {
  Button,
  CategoryButton,
  Column,
  Dialog,
  FloatingSelect,
  MenuItem,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Card, Cards, Empty, ErrorText, Field, Meta, Pill, TitleLine } from "../badges/parts";
import { useDate } from "../profile/CommunityParts";

type Category = "account" | "billing" | "safety" | "bug" | "feature" | "other";
const CATEGORIES: Category[] = ["account", "billing", "safety", "bug", "feature", "other"];

type Ticket = WithoutNull<API.TicketView>;

/** Names of ticket topics in the reader's language */
function useCategoryName() {
  const { t } = useLingui();
  return (c: string): string => {
    // the server may send values this app does not know yet
    const labels: Record<string, string> = {
      account: t`My account`,
      billing: t`Payments and Feather`,
      safety: t`Safety and reports`,
      bug: t`Something isn't working`,
      feature: t`An idea for Zrzur`,
      other: t`Something else`,
    };
    return labels[c] ?? c;
  };
}

/**
 * Contact support: open a ticket and follow the team's answers. People
 * who can't sign in write to support@zrzur.com instead.
 */
export function ContactSupport() {
  const client = useClient();
  const { t } = useLingui();
  const [tickets, { refetch }] = createResource(() =>
    client().api.get("/support/tickets").then(withoutNull),
  );
  const [writing, setWriting] = createSignal(false);
  const [open, setOpen] = createSignal<string | null>(null);
  const date = useDate();

  const categoryName = useCategoryName();
  const statusName = (s: string): string => {
    // the server may send statuses this app does not know yet
    const labels: Record<string, string> = { Open: t`Waiting for the team`, Answered: t`Answered`, Closed: t`Closed` };
    return labels[s] ?? s;
  };

  return (
    <Column gap="lg">
      <CategoryButton.Group>
        <CategoryButton
          action="chevron"
          icon={<Icon name="headset" size={22} />}
          onClick={() => setWriting(true)}
          description={
            <Trans>
              Ask the Zrzur team about your account, payments, safety or
              anything else. We answer here.
            </Trans>
          }
        >
          <Trans>Write to support</Trans>
        </CategoryButton>
      </CategoryButton.Group>
      <Show when={tickets.error}>
        <ErrorText role="alert">
          <Trans>Your tickets couldn't be loaded. Try again later.</Trans>
        </ErrorText>
      </Show>
      <Show when={resourceValue(tickets)}>
        {(list) => (
          <Show when={list().length > 0} fallback={<Empty><Trans>You haven't written to support yet.</Trans></Empty>}>
            <Cards>
              <For each={list()}>
                {(ticket) => (
                  <Card>
                    <button
                      type="button"
                      onClick={() => setOpen(ticket._id)}
                      style={{ all: "unset", cursor: "pointer", display: "grid", gap: "4px", width: "100%" }}
                    >
                      <TitleLine>
                        <span dir="auto">{ticket.subject}</span>
                        <Pill>{statusName(ticket.status)}</Pill>
                      </TitleLine>
                      <Meta>
                        {categoryName(ticket.category)} · {date(ticket.updated_at)}
                      </Meta>
                    </button>
                  </Card>
                )}
              </For>
            </Cards>
          </Show>
        )}
      </Show>
      <Show when={writing()}>
        <NewTicket
          onClose={() => setWriting(false)}
          onDone={(id) => {
            setWriting(false);
            void refetch();
            setOpen(id);
          }}
        />
      </Show>
      <Show when={open()}>
        {(id) => (
          <TicketView
            id={id()}
            statusName={statusName}
            onClose={() => setOpen(null)}
            onChanged={() => void refetch()}
          />
        )}
      </Show>
    </Column>
  );
}

/** A new ticket; `related` links it to an official message it answers */
export function NewTicket(props: {
  related?: string;
  subject?: string;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const client = useClient();
  const describeError = useError();
  const categoryName = useCategoryName();
  const [category, setCategory] = createSignal<Category>(props.related ? "other" : "account");
  // eslint-disable-next-line solid/reactivity
  const [subject, setSubject] = createSignal(props.subject ?? "");
  const [body, setBody] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ticket = withoutNull(await client().api.post("/support/tickets", { category: category(), subject: subject().trim(), body: body().trim(), related: props.related }));
      props.onDone(ticket._id);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      show
      tone="info"
      iconName="headset"
      onClose={props.onClose}
      persistent={!!body().trim()}
      title={<Trans>Write to support</Trans>}
      size="md"
      error={error() || undefined}
      actions={[
        { text: <Trans>Cancel</Trans>, onClick: props.onClose },
        {
          text: <Trans>Send</Trans>,
          isLoading: busy(),
          isDisabled: !subject().trim() || !body().trim(),
          onClick: () => {
            void submit(new Event("submit"));
            return false;
          },
        },
      ]}
    >
      <form onSubmit={submit} style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
        <Field>
          <span>
            <Trans>About</Trans>
          </span>
          <FloatingSelect
            value={category()}
            onChange={(e) => setCategory(e.currentTarget.value as Category)}
          >
            <For each={CATEGORIES}>
              {(c) => <MenuItem value={c}>{categoryName(c)}</MenuItem>}
            </For>
          </FloatingSelect>
        </Field>
        <Field>
          <span>
            <Trans>Subject</Trans>
          </span>
          <input required maxLength={120} value={subject()} onInput={(e) => setSubject(e.currentTarget.value)} />
        </Field>
        <Field>
          <span>
            <Trans>Your message</Trans>
          </span>
          <textarea required maxLength={4000} rows={6} value={body()} onInput={(e) => setBody(e.currentTarget.value)} />
        </Field>
      </form>
    </Dialog>
  );
}

function TicketView(props: {
  id: string;
  statusName: (s: string) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const [ticket, { mutate, refetch }] = createResource(
    () => props.id,
    (id) => client().api.get(`/support/tickets/${encodeURIComponent(id)}`).then(withoutNull),
  );
  // a failed load is shown by the dialog's own error, never thrown by a read
  const detail = () => resourceValue(ticket);
  const [body, setBody] = createSignal("");
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");

  const run = async (key: string, action: (id: string) => Promise<API.TicketView>) => {
    setBusy(key);
    setError("");
    try {
      mutate(withoutNull(await action(encodeURIComponent(props.id))));
      if (key === "send") setBody("");
      props.onChanged();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      show
      tone="info"
      iconName="headset"
      onClose={props.onClose}
      title={detail()?.subject ?? ""}
      description={detail() ? props.statusName(detail()!.status) : undefined}
      size="lg"
      error={error() || undefined}
      actions={[{ text: <Trans>Close</Trans>, variant: "secondary", onClick: props.onClose }]}
    >
      <Show when={!ticket.error} fallback={<ErrorText role="alert"><Trans>This ticket couldn't be loaded.</Trans> <Button variant="text" onPress={() => void refetch()}><Trans>Try again</Trans></Button></ErrorText>}>
        <Show when={detail()}>
          {(tk) => (
            <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
              <ol style={{ margin: 0, padding: 0, "list-style": "none", display: "grid", gap: "8px", "max-height": "45vh", "overflow-y": "auto" }}>
                <For each={tk().messages}>
                  {(m) => (
                    <li
                      style={{
                        padding: "12px 16px",
                        "border-radius": "12px",
                        background: m.staff ? "var(--z-accent-subtle, var(--md-sys-color-secondary-container))" : "var(--z-surface-raised, var(--md-sys-color-surface-container-high))",
                        "border-inline-start": m.staff ? "3px solid var(--z-accent, var(--md-sys-color-primary))" : "none",
                      }}
                    >
                      <Meta>
                        {m.staff ? <Trans>Zrzur support</Trans> : <Trans>You</Trans>} · {date(m.created_at)}
                      </Meta>
                      <p dir="auto" style={{ margin: "4px 0 0", "white-space": "pre-wrap", "overflow-wrap": "anywhere" }}>
                        {m.body}
                      </p>
                    </li>
                  )}
                </For>
              </ol>
              <Show
                when={tk().can_reply}
                fallback={
                  <Empty>
                    <Trans>This ticket is closed. Write a new one if you still need help.</Trans>
                  </Empty>
                }
              >
                <Field>
                  <span>
                    <Trans>Reply</Trans>
                  </span>
                  <textarea maxLength={4000} rows={3} value={body()} onInput={(e) => setBody(e.currentTarget.value)} />
                </Field>
                <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
                  <Button isDisabled={!body().trim() || busy() !== null} onPress={() => void run("send", (id) => client().api.post(`/support/tickets/${id}/messages`, { body: body().trim() }))}>
                    <Trans>Send reply</Trans>
                  </Button>
                  <Show
                    when={tk().status !== "Closed"}
                    fallback={
                      <Button variant="tonal" isDisabled={busy() !== null} onPress={() => void run("reopen", (id) => client().api.post(`/support/tickets/${id}/reopen`))}>
                        <Trans>Reopen</Trans>
                      </Button>
                    }
                  >
                    <Button variant="tonal" isDisabled={busy() !== null} onPress={() => void run("close", (id) => client().api.post(`/support/tickets/${id}/close`))}>
                      <Trans>My problem is solved</Trans>
                    </Button>
                  </Show>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </Show>
    </Dialog>
  );
}
