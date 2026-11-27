import { type API, type WithoutNull, withoutNull } from "@zrzur/sdk/solid";
import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { resourceValue } from "@revolt/common/lib/resource";
import { useError } from "@revolt/i18n";
import {
  Button,
  CategoryButton,
  Column,
  FloatingSelect,
  MenuItem,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../../Settings";
import { Empty, ErrorText, Meta, Pill } from "../badges/parts";
import { useDate } from "../profile/CommunityParts";

type Category = "account" | "billing" | "safety" | "bug" | "feature" | "other";
const CATEGORIES: Category[] = [
  "account",
  "billing",
  "safety",
  "bug",
  "feature",
  "other",
];

type Ticket = WithoutNull<API.TicketView>;

/** The settings path of a ticket's own page */
export const ticketPage = (id: string) => `support/${id}`;

/**
 * Subjects of the tickets seen so far, by id: the path above a ticket's
 * page names it by its subject
 */
const [subjects, setSubjects] = createSignal<Record<string, string>>({});
const remember = (list: { _id: string; subject: string }[]) =>
  setSubjects((known) => {
    const next = { ...known };
    for (const ticket of list) next[ticket._id] = ticket.subject;
    return next;
  });

/** A ticket's subject, for the path above its page */
export function TicketTitle(props: { id: string }) {
  return (
    <bdi>
      <Show when={subjects()[props.id]} fallback={<Trans>Ticket</Trans>}>
        {(subject) => subject()}
      </Show>
    </bdi>
  );
}

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

/** Names of ticket states in the reader's language */
function useStatusName() {
  const { t } = useLingui();
  return (s: string): string => {
    // the server may send statuses this app does not know yet
    const labels: Record<string, string> = {
      Open: t`Waiting for the team`,
      Answered: t`Answered`,
      Closed: t`Closed`,
    };
    return labels[s] ?? s;
  };
}

/**
 * Contact support: open a ticket and follow the team's answers. Writing
 * and reading a ticket each open as a page under this one, as any settings
 * page with more to it does. People who can't sign in write to
 * support@zrzur.com instead.
 */
export function ContactSupport() {
  const client = useClient();
  const { navigate } = useSettingsNavigation();
  const [tickets] = createResource(() =>
    client()
      .api.get("/support/tickets")
      .then(withoutNull)
      .then((list) => {
        remember(list);
        return list;
      }),
  );
  const date = useDate();
  const categoryName = useCategoryName();
  const statusName = useStatusName();

  return (
    <Column gap="xl">
      <CategoryButton.Group>
        <CategoryButton
          action="chevron"
          icon={<Icon name="headset" size={20} />}
          onClick={() => navigate("support/new")}
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

      <SettingsSection title={<Trans>Your tickets</Trans>}>
        <Show
          when={!tickets.error}
          fallback={
            <SettingsRow
              icon={<Icon name="warning" size={20} />}
              title={
                <Trans>Your tickets couldn't be loaded. Try again later.</Trans>
              }
            />
          }
        >
          <Show
            when={resourceValue(tickets)?.length}
            fallback={
              <SettingsRow
                icon={<Icon name="tray" size={20} />}
                title={
                  <Show
                    when={resourceValue(tickets)}
                    fallback={<Trans>Loading…</Trans>}
                  >
                    <Trans>You haven't written to support yet.</Trans>
                  </Show>
                }
              />
            }
          >
            <For each={resourceValue(tickets)}>
              {(ticket) => (
                <SettingsRow
                  navigational
                  icon={<Icon name="chat-circle-dots" size={20} />}
                  title={<bdi>{ticket.subject}</bdi>}
                  description={
                    <>
                      {categoryName(ticket.category)} ·{" "}
                      {date(ticket.updated_at)}
                    </>
                  }
                  control={() => (
                    <Pill
                      data-tone={
                        ticket.status === "Answered" ? "accent" : undefined
                      }
                    >
                      {statusName(ticket.status)}
                    </Pill>
                  )}
                  onClick={() => navigate(ticketPage(ticket._id))}
                />
              )}
            </For>
          </Show>
        </Show>
      </SettingsSection>
    </Column>
  );
}

/** What a new ticket holds and how it is sent */
function createTicketDraft(props: { onDone: (id: string) => void }) {
  const client = useClient();
  const describeError = useError();
  const [category, setCategory] = createSignal<Category>("account");
  const [subject, setSubject] = createSignal("");
  const [body, setBody] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  const ready = () => !!subject().trim() && !!body().trim();

  async function submit(e?: Event) {
    e?.preventDefault();
    if (!ready() || busy()) return;
    setBusy(true);
    setError("");
    try {
      const ticket = withoutNull(
        await client().api.post("/support/tickets", {
          category: category(),
          subject: subject().trim(),
          body: body().trim(),
        }),
      );
      remember([ticket]);
      props.onDone(ticket._id);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return {
    category,
    setCategory,
    subject,
    setSubject,
    body,
    setBody,
    busy,
    error,
    ready,
    submit,
  };
}

/** "Write to support" as its own settings page (support/new) */
export function NewTicketPage() {
  const { t } = useLingui();
  const { navigate } = useSettingsNavigation();
  const categoryName = useCategoryName();
  const draft = createTicketDraft({ onDone: (id) => navigate(ticketPage(id)) });

  return (
    <form onSubmit={(e) => void draft.submit(e)}>
      <Column gap="xl">
        <SettingsSection>
          <SettingsRow
            icon={<Icon name="headset" size={20} />}
            title={<Trans>About</Trans>}
            control={(ids) => (
              <FloatingSelect
                aria-labelledby={ids.labelId}
                value={draft.category()}
                onChange={(e) =>
                  draft.setCategory(e.currentTarget.value as Category)
                }
              >
                <For each={CATEGORIES}>
                  {(c) => <MenuItem value={c}>{categoryName(c)}</MenuItem>}
                </For>
              </FloatingSelect>
            )}
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsFormPanel>
            <TextField
              required
              maxlength={120}
              counter
              label={t`Subject`}
              value={draft.subject()}
              onInput={(e) => draft.setSubject(e.currentTarget.value)}
            />
            <TextField
              required
              maxlength={4000}
              rows={6}
              label={t`Your message`}
              value={draft.body()}
              onInput={(e) => draft.setBody(e.currentTarget.value)}
            />
          </SettingsFormPanel>
        </SettingsSection>

        <Show when={draft.error()}>
          <ErrorText role="alert">{draft.error()}</ErrorText>
        </Show>
        <Actions>
          <Button
            type="button"
            variant="text"
            onPress={() => navigate("support")}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="submit"
            variant="filled"
            isDisabled={!draft.ready() || draft.busy()}
          >
            <Show when={draft.busy()} fallback={<Trans>Send</Trans>}>
              <Trans>Sending…</Trans>
            </Show>
          </Button>
        </Actions>
      </Column>
    </form>
  );
}

/** One ticket as its own settings page (support/<id>): the talk and a reply */
export function TicketPage(props: { id: string }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const categoryName = useCategoryName();
  const statusName = useStatusName();
  const [ticket, { mutate, refetch }] = createResource(
    () => props.id,
    (id) =>
      client()
        .api.get(`/support/tickets/${encodeURIComponent(id)}`)
        .then(withoutNull)
        .then((tk) => {
          remember([tk]);
          return tk;
        }),
  );
  const detail = () => resourceValue(ticket);
  const [body, setBody] = createSignal("");
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");

  const run = async (
    key: string,
    action: (id: string) => Promise<API.TicketView>,
  ) => {
    setBusy(key);
    setError("");
    try {
      mutate(withoutNull(await action(encodeURIComponent(props.id))) as Ticket);
      if (key === "send") setBody("");
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Show
      when={!ticket.error}
      fallback={
        <ErrorText role="alert">
          <Trans>This ticket couldn't be loaded.</Trans>{" "}
          <Button variant="text" onPress={() => void refetch()}>
            <Trans>Try again</Trans>
          </Button>
        </ErrorText>
      }
    >
      <Show
        when={detail()}
        fallback={
          <Empty>
            <Trans>Loading…</Trans>
          </Empty>
        }
      >
        {(tk) => (
          <Column gap="xl">
            <SettingsSection>
              <SettingsRow
                icon={<Icon name="headset" size={20} />}
                title={categoryName(tk().category)}
                description={date(tk().updated_at)}
                control={() => (
                  <Pill
                    data-tone={
                      tk().status === "Answered" ? "accent" : undefined
                    }
                  >
                    {statusName(tk().status)}
                  </Pill>
                )}
              />
            </SettingsSection>

            <Talk>
              <For each={tk().messages}>
                {(m) => (
                  <li data-staff={m.staff || undefined}>
                    <Meta>
                      {m.staff ? (
                        <Trans>Zrzur support</Trans>
                      ) : (
                        <Trans>You</Trans>
                      )}{" "}
                      · {date(m.created_at)}
                    </Meta>
                    <p dir="auto">{m.body}</p>
                  </li>
                )}
              </For>
            </Talk>

            <Show
              when={tk().can_reply}
              fallback={
                <SettingsSection>
                  <SettingsRow
                    icon={<Icon name="lock-simple" size={20} />}
                    title={
                      <Trans>
                        This ticket is closed. Write a new one if you still need
                        help.
                      </Trans>
                    }
                  />
                </SettingsSection>
              }
            >
              <SettingsSection>
                <SettingsFormPanel>
                  <TextField
                    maxlength={4000}
                    rows={3}
                    label={t`Reply`}
                    value={body()}
                    onInput={(e) => setBody(e.currentTarget.value)}
                  />
                </SettingsFormPanel>
              </SettingsSection>
            </Show>

            <Show when={error()}>
              <ErrorText role="alert">{error()}</ErrorText>
            </Show>
            <Actions>
              <Show
                when={tk().status !== "Closed"}
                fallback={
                  <Button
                    variant="tonal"
                    isDisabled={busy() !== null}
                    onPress={() =>
                      void run("reopen", (id) =>
                        client().api.post(`/support/tickets/${id}/reopen`),
                      )
                    }
                  >
                    <Trans>Reopen</Trans>
                  </Button>
                }
              >
                <Button
                  variant="text"
                  isDisabled={busy() !== null}
                  onPress={() =>
                    void run("close", (id) =>
                      client().api.post(`/support/tickets/${id}/close`),
                    )
                  }
                >
                  <Trans>My problem is solved</Trans>
                </Button>
              </Show>
              <Show when={tk().can_reply}>
                <Button
                  variant="filled"
                  isDisabled={!body().trim() || busy() !== null}
                  onPress={() =>
                    void run("send", (id) =>
                      client().api.post(`/support/tickets/${id}/messages`, {
                        body: body().trim(),
                      }),
                    )
                  }
                >
                  <Show
                    when={busy() === "send"}
                    fallback={<Trans>Send reply</Trans>}
                  >
                    <Trans>Sending…</Trans>
                  </Show>
                </Button>
              </Show>
            </Actions>
          </Column>
        )}
      </Show>
    </Show>
  );
}

/** the page's buttons in one row at its end, the main one last */
const Actions = styled("div", {
  base: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "8px",
  },
});

/** the talk: the team's answers marked with the accent at their start */
const Talk = styled("ol", {
  base: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: "8px",
    "& > li": {
      padding: "12px 16px",
      borderRadius: "var(--z-box-radius, 12px)",
      border: "var(--z-box-border)",
      background: "var(--z-box-bg)",
      minWidth: 0,
    },
    "& > li[data-staff]": {
      background:
        "var(--z-accent-subtle, color-mix(in srgb, var(--z-accent) 10%, transparent))",
      borderInlineStart: "3px solid var(--z-accent)",
    },
    "& p": {
      margin: "4px 0 0",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      fontSize: "14px",
      color: "var(--z-fg-primary)",
    },
  },
});
