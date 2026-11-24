import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { DateTimeField, Dialog } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { badgeMeta } from "@revolt/ui/components/features/profiles/badges/catalog";
import { useBadgeText } from "@revolt/ui/components/features/profiles/badges/useBadgeText";
import { Icon } from "@revolt/ui/icons/Icon";

import { useDate } from "../profile/CommunityParts";
import { creatorHandle, creatorName } from "../profile/communityApi";

import {
  BadgeLogEntry,
  BadgeRequest,
  StaffBadgeChange,
  openStaffSession,
  staffBadgesApi,
} from "./badgesApi";
import {
  Actions,
  Empty,
  ErrorText,
  Field,
  List,
  Log,
  Pill,
  Search,
  Section,
} from "./parts";

/** The status of a failed request, if the server answered */
const statusOf = (failure: unknown) =>
  typeof failure === "object" && failure && "status" in failure
    ? (failure as { status?: number }).status
    : undefined;

/** The error type the server named (`NotElevated`, `InvalidSession`, …) */
const typeOf = (failure: unknown) => {
  const body =
    typeof failure === "object" && failure && "body" in failure
      ? (failure as { body?: { type?: string } }).body
      : undefined;
  return body?.type;
};

const rowStyle = {
  display: "flex",
  "flex-direction": "column",
  gap: "8px",
  padding: "12px",
  border: "var(--z-box-border)",
  "border-radius": "var(--z-box-radius)",
  background: "var(--z-box-bg)",
} as const;

const lineStyle = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  "flex-wrap": "wrap",
} as const;

/**
 * Staff tool: the admin console's badge routes inside the app. Opening it
 * asks for an authenticator code (a staff session, kept in memory only and
 * closed with the panel); then find a person, see their badges, history and
 * what you may give them, grant or revoke with a reason, and approve or
 * refuse the changes that wait for a second staff member. The server checks
 * every rule again: Founder never changes, Staff and Platform Moderator
 * follow appointments, retired badges are never given, sensitive changes
 * need a second person, protected ones a fresh code.
 */
export function BadgeAdmin(props: { show: boolean; onClose: () => void }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const text = useBadgeText();

  const [token, setToken] = createSignal<string>();
  const [code, setCode] = createSignal("");
  const [stepCode, setStepCode] = createSignal("");
  const [needsCode, setNeedsCode] = createSignal(false);
  const [typed, setTyped] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal<string>();
  const [reason, setReason] = createSignal("");
  const [expires, setExpires] = createSignal<Date>();
  const [error, setError] = createSignal<string>();
  const [notice, setNotice] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  const api = createMemo(() => {
    const session = token();
    return session ? staffBadgesApi(client(), session) : undefined;
  });

  onCleanup(() => {
    // the staff session ends with the panel
    void api()
      ?.close()
      .catch(() => undefined);
  });

  createEffect(() => {
    const value = typed().trim();
    const timer = setTimeout(() => setQuery(value), 300);
    onCleanup(() => clearTimeout(timer));
  });

  const [results] = createResource(
    () => {
      const staff = api();
      return staff && props.show && query() ? { staff, q: query() } : undefined;
    },
    ({ staff, q }) => staff.search(q),
  );
  const [record, { refetch }] = createResource(
    () => {
      const staff = api();
      const id = open();
      return staff && id ? { staff, id } : undefined;
    },
    ({ staff, id }) => staff.user(id),
  );
  const [requests, { refetch: refetchRequests }] = createResource(
    () => api(),
    (staff) => staff.requests(),
  );
  const pending = () =>
    (requests() ?? []).filter((request) => request.status === "Pending");

  function explain(failure: unknown) {
    if (statusOf(failure) === 401)
      return t`This app may not open a staff session here, or the session ended. Use the admin console.`;
    return describeError(failure);
  }

  async function signIn() {
    setBusy(true);
    setError(undefined);
    try {
      const opened = await openStaffSession(client(), code().trim());
      setToken(opened.token);
      setCode("");
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setBusy(false);
    }
  }

  async function stepUp() {
    const staff = api();
    if (!staff) return;
    setBusy(true);
    setError(undefined);
    try {
      await staff.stepUp(stepCode().trim());
      setStepCode("");
      setNeedsCode(false);
      setNotice(t`Confirmed. Protected changes are open for five minutes.`);
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<StaffBadgeChange | unknown>) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await action();
      if ((result as StaffBadgeChange | undefined)?.status === "pending") {
        setNotice(
          t`Saved as a request: a second staff member must approve it.`,
        );
      }
      setReason("");
      setExpires(undefined);
      await Promise.all([refetch(), refetchRequests()]);
    } catch (failure) {
      if (typeOf(failure) === "NotElevated") setNeedsCode(true);
      setError(explain(failure));
    } finally {
      setBusy(false);
    }
  }

  const logLabel = (action: BadgeLogEntry["action"]) =>
    ({
      Grant: t`Granted`,
      Revoke: t`Revoked`,
      Expire: t`Expired`,
      Hide: t`Hidden by owner`,
      Show: t`Shown by owner`,
    })[action];

  const held = (badge: string) =>
    record()?.grants.some((grant) => grant.badge === badge && grant.held);

  const changeWord = (request: BadgeRequest) =>
    request.grant ? t`Grant` : t`Revoke`;

  const reasonOk = () => reason().trim().length >= 3;

  return (
    <Dialog
      tone="settings"
      iconName="crown"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Badges</Trans>}
      size="xl"
    >
      <div
        data-testid="staff-badge-panel"
        style={{ display: "flex", "flex-direction": "column", gap: "12px" }}
      >
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>
        <Show when={notice()}>
          <p role="status" style={{ margin: 0, "font-size": "13px" }}>
            {notice()}
          </p>
        </Show>

        <Show
          when={api()}
          fallback={
            <Section>
              <h3>
                <Trans>Open a staff session</Trans>
              </h3>
              <p>
                <Trans>
                  Badges are changed with a staff session, as in the admin
                  console. Enter the code from your authenticator app.
                </Trans>
              </p>
              <Field>
                <span>
                  <Trans>Authenticator code</Trans>
                </span>
                <input
                  data-testid="staff-code"
                  inputMode="numeric"
                  autocomplete="one-time-code"
                  maxLength={10}
                  dir="ltr"
                  value={code()}
                  onInput={(e) => setCode(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code().trim()) void signIn();
                  }}
                />
              </Field>
              <Actions>
                <button
                  type="button"
                  data-primary
                  disabled={busy() || !code().trim()}
                  onClick={() => void signIn()}
                >
                  <Trans>Open staff session</Trans>
                </button>
              </Actions>
            </Section>
          }
        >
          <Show when={needsCode()}>
            <Section>
              <h3>
                <Trans>Confirm with a fresh code</Trans>
              </h3>
              <p>
                <Trans>
                  This change is protected. Enter a new code from your
                  authenticator app, then try again.
                </Trans>
              </p>
              <Field>
                <span>
                  <Trans>Authenticator code</Trans>
                </span>
                <input
                  data-testid="staff-step-up-code"
                  inputMode="numeric"
                  autocomplete="one-time-code"
                  maxLength={10}
                  dir="ltr"
                  value={stepCode()}
                  onInput={(e) => setStepCode(e.currentTarget.value)}
                />
              </Field>
              <Actions>
                <button
                  type="button"
                  data-primary
                  disabled={busy() || !stepCode().trim()}
                  onClick={() => void stepUp()}
                >
                  <Trans>Confirm</Trans>
                </button>
              </Actions>
            </Section>
          </Show>

          <Section data-testid="staff-badge-requests">
            <h3>
              <Trans>Waiting for a second staff member</Trans>
            </h3>
            <Show
              when={pending().length}
              fallback={
                <p>
                  <Trans>No badge changes are waiting.</Trans>
                </p>
              }
            >
              <For each={pending()}>
                {(request) => (
                  <div style={rowStyle} data-request={request.id}>
                    <div style={lineStyle}>
                      <Show when={badgeMeta(request.badge)}>
                        <BadgeMark id={badgeMeta(request.badge)!.id} />
                      </Show>
                      <strong style={{ flex: 1, "min-width": "120px" }}>
                        {changeWord(request)}: {text(request.badge).name}
                      </strong>
                      <Pill>
                        <Trans>Waiting for approval</Trans>
                      </Pill>
                    </div>
                    <small style={{ color: "var(--z-fg-muted)" }}>
                      <Trans>Person</Trans>: <bdi>{request.user_id}</bdi> ·{" "}
                      <Trans>Asked by</Trans>: <bdi>{request.requested_by}</bdi>{" "}
                      · {date(request.created_at)}
                    </small>
                    <q dir="auto">{request.reason}</q>
                    <Actions>
                      <button
                        type="button"
                        data-primary
                        disabled={busy()}
                        onClick={() =>
                          void run(() => api()!.approve(request.id))
                        }
                      >
                        <Trans>Approve</Trans>
                      </button>
                      <button
                        type="button"
                        data-danger
                        disabled={busy()}
                        onClick={() =>
                          void run(() => api()!.refuse(request.id))
                        }
                      >
                        <Trans>Refuse</Trans>
                      </button>
                    </Actions>
                  </div>
                )}
              </For>
            </Show>
          </Section>

          <Search>
            <Icon name="magnifying-glass" size={16} />
            <input
              type="search"
              data-testid="staff-badge-search"
              placeholder={t`Search users by name or id`}
              aria-label={t`Search users by name or id`}
              value={typed()}
              onInput={(e) => setTyped(e.currentTarget.value)}
            />
          </Search>
          <Field>
            <span>
              <Trans>Reason (required, saved in the audit log)</Trans>
            </span>
            <input
              data-testid="staff-badge-reason"
              maxLength={500}
              dir="auto"
              value={reason()}
              onInput={(e) => setReason(e.currentTarget.value)}
            />
          </Field>
          <DateTimeField
            label={t`Expires (optional)`}
            value={expires()}
            min={new Date()}
            testId="staff-badge-expires"
            onChange={setExpires}
          />
          <Show when={expires()}>
            <Actions>
              <button type="button" onClick={() => setExpires(undefined)}>
                <Trans>No expiry</Trans>
              </button>
            </Actions>
          </Show>

          <List>
            <Show when={query() && !results.loading && !results()?.length}>
              <Empty>
                <Trans>No users match your search.</Trans>
              </Empty>
            </Show>
            <For each={(results() ?? []).filter((row) => !row.bot)}>
              {(row) => (
                <div style={rowStyle} data-user={row.id}>
                  <div style={lineStyle}>
                    <span
                      style={{
                        flex: 1,
                        "min-width": 0,
                        display: "flex",
                        "flex-direction": "column",
                      }}
                    >
                      <strong>
                        <bdi>
                          {creatorName({
                            display_name: row.display_name ?? undefined,
                            username: row.username,
                          })}
                        </bdi>
                      </strong>
                      <small style={{ color: "var(--z-fg-muted)" }}>
                        <bdi>{creatorHandle(row)}</bdi>
                      </small>
                    </span>
                    <Actions>
                      <button
                        type="button"
                        aria-expanded={open() === row.id}
                        onClick={() =>
                          setOpen((id) => (id === row.id ? undefined : row.id))
                        }
                      >
                        <Trans>Manage</Trans>
                      </button>
                    </Actions>
                  </div>

                  <Show when={open() === row.id && record()}>
                    <div
                      style={{
                        display: "flex",
                        "flex-direction": "column",
                        gap: "8px",
                      }}
                    >
                      <For each={record()!.eligibility}>
                        {(entry) => (
                          <Show when={badgeMeta(entry.badge)}>
                            <div style={lineStyle} data-badge-row={entry.badge}>
                              <BadgeMark id={badgeMeta(entry.badge)!.id} />
                              <span
                                style={{
                                  flex: 1,
                                  "min-width": "120px",
                                  "font-size": "13px",
                                }}
                              >
                                {text(entry.badge).name}
                                <Show when={!entry.allowed && entry.reason}>
                                  <small
                                    style={{
                                      display: "block",
                                      color: "var(--z-fg-muted)",
                                    }}
                                  >
                                    {entry.reason}
                                  </small>
                                </Show>
                              </span>
                              <Show when={held(entry.badge)}>
                                <Pill data-tone="accent">
                                  <Trans>Held</Trans>
                                </Pill>
                              </Show>
                              <Actions>
                                <Show
                                  when={held(entry.badge)}
                                  fallback={
                                    <button
                                      type="button"
                                      data-primary
                                      disabled={
                                        busy() || !entry.allowed || !reasonOk()
                                      }
                                      onClick={() =>
                                        void run(() =>
                                          api()!.grant(
                                            row.id,
                                            entry.badge,
                                            reason(),
                                            expires()?.getTime(),
                                          ),
                                        )
                                      }
                                    >
                                      <Trans>Grant</Trans>
                                    </button>
                                  }
                                >
                                  <button
                                    type="button"
                                    data-danger
                                    disabled={busy() || !reasonOk()}
                                    onClick={() =>
                                      void run(() =>
                                        api()!.revoke(
                                          row.id,
                                          entry.badge,
                                          reason(),
                                        ),
                                      )
                                    }
                                  >
                                    <Trans>Revoke</Trans>
                                  </button>
                                </Show>
                              </Actions>
                            </div>
                          </Show>
                        )}
                      </For>
                      <Show when={record()!.log.length}>
                        <Log>
                          <For each={record()!.log}>
                            {(entry) => (
                              <li>
                                <strong>{logLabel(entry.action)}</strong>
                                <span>{text(entry.badge).name}</span>
                                <time>{date(entry.created_at)}</time>
                                <Show when={entry.reason}>
                                  <q dir="auto">{entry.reason}</q>
                                </Show>
                              </li>
                            )}
                          </For>
                        </Log>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </List>
        </Show>
      </div>
    </Dialog>
  );
}
