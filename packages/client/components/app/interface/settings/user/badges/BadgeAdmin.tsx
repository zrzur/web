import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Avatar, Dialog } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { badgeMeta } from "@revolt/ui/components/features/profiles/badges/catalog";
import { useBadgeText } from "@revolt/ui/components/features/profiles/badges/useBadgeText";
import { Icon } from "@revolt/ui/icons/Icon";

import { useCreatorAvatar, useDate } from "../profile/CommunityParts";
import { creatorHandle, creatorName } from "../profile/communityApi";

import { BadgeLogEntry, badgesApi } from "./badgesApi";
import {
  Actions,
  Empty,
  ErrorText,
  Field,
  List,
  Log,
  Pill,
  Search,
} from "./parts";

/**
 * Staff tool: find a user, see their badges, audit log and what can be
 * given to them, then grant or revoke with a reason. The server checks
 * every rule again (no self-grant, Staff only from privileged accounts,
 * eligibility for Super Creator and Elite Bug Hunter).
 */
export function BadgeAdmin(props: { show: boolean; onClose: () => void }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const avatar = useCreatorAvatar();
  const text = useBadgeText();

  const [typed, setTyped] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal<string>();
  const [reason, setReason] = createSignal("");
  const [expires, setExpires] = createSignal("");
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    const value = typed().trim();
    const timer = setTimeout(() => setQuery(value), 300);
    onCleanup(() => clearTimeout(timer));
  });

  const [results, { refetch: refetchResults }] = createResource(
    () => (props.show && query() ? query() : undefined),
    (q) => badgesApi.search(client(), q),
  );
  const [record, { refetch }] = createResource(open, (id) =>
    badgesApi.user(client(), id),
  );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setReason("");
      await Promise.all([refetch(), refetchResults()]);
    } catch (failure) {
      setError(describeError(failure));
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

  return (
    <Dialog
      tone="settings"
      iconName="crown"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Badges</Trans>}
      size="xl"
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
        <Search>
          <Icon name="magnifying-glass" size={16} />
          <input
            type="search"
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
            maxLength={500}
            value={reason()}
            onInput={(e) => setReason(e.currentTarget.value)}
          />
        </Field>
        <Field>
          <span>
            <Trans>Expires (optional)</Trans>
          </span>
          <input
            type="date"
            value={expires()}
            onInput={(e) => setExpires(e.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>

        <List>
          <Show when={query() && !results.loading && !results()?.length}>
            <Empty>
              <Trans>No users match your search.</Trans>
            </Empty>
          </Show>
          <For each={results()}>
            {(holder) => (
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  gap: "8px",
                  padding: "10px 12px",
                  border: "1px solid var(--z-border-subtle)",
                  "border-radius": "12px",
                  background: "var(--z-bg-raised)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "10px",
                  }}
                >
                  <Avatar
                    size={32}
                    src={avatar(holder.user)}
                    fallback={creatorName(holder.user)}
                  />
                  <span
                    style={{
                      flex: 1,
                      "min-width": 0,
                      display: "flex",
                      "flex-direction": "column",
                    }}
                  >
                    <strong>
                      <bdi>{creatorName(holder.user)}</bdi>
                    </strong>
                    <small style={{ color: "var(--z-fg-muted)" }}>
                      <bdi>{creatorHandle(holder.user)}</bdi>
                    </small>
                  </span>
                  <span
                    style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}
                  >
                    <For each={holder.badges}>
                      {(id) => (
                        <Show when={badgeMeta(id)}>
                          <BadgeMark id={badgeMeta(id)!.id} />
                        </Show>
                      )}
                    </For>
                  </span>
                  <Actions>
                    <button
                      type="button"
                      aria-expanded={open() === holder.user._id}
                      onClick={() =>
                        setOpen((id) =>
                          id === holder.user._id ? undefined : holder.user._id,
                        )
                      }
                    >
                      <Trans>Manage</Trans>
                    </button>
                  </Actions>
                </div>

                <Show when={open() === holder.user._id && record()}>
                  <div
                    style={{
                      display: "flex",
                      "flex-direction": "column",
                      gap: "6px",
                    }}
                  >
                    <For each={record()!.eligibility}>
                      {(entry) => (
                        <Show when={badgeMeta(entry.badge)}>
                          <div
                            style={{
                              display: "flex",
                              "align-items": "center",
                              gap: "8px",
                              "flex-wrap": "wrap",
                            }}
                          >
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
                                      busy() ||
                                      !entry.allowed ||
                                      reason().trim().length < 3
                                    }
                                    onClick={() =>
                                      void run(() =>
                                        badgesApi.grant(
                                          client(),
                                          holder.user._id,
                                          entry.badge,
                                          reason(),
                                          expires()
                                            ? new Date(expires()).getTime()
                                            : undefined,
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
                                  disabled={
                                    busy() || reason().trim().length < 3
                                  }
                                  onClick={() =>
                                    void run(() =>
                                      badgesApi.revoke(
                                        client(),
                                        holder.user._id,
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
      </div>
    </Dialog>
  );
}
