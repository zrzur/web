import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { translatedError, useError } from "@revolt/i18n";
import { Avatar, Dialog, FloatingSelect, MenuItem } from "@revolt/ui";

import { useCreatorAvatar, useDate } from "../profile/CommunityParts";
import { creatorHandle, creatorName } from "../profile/communityApi";

import { BetaMemberRecord, BetaStatus, badgesApi, betaApi } from "./badgesApi";
import { Actions, Empty, ErrorText, Field, List, Pill, Row } from "./parts";

/**
 * Staff tool for the closed beta: feature flags (on/off, all testers or
 * chosen ones), requests, invitations, removal and completion (Beta
 * Veteran). Access is always checked on the server from membership.
 */
export function BetaAdmin(props: { show: boolean; onClose: () => void }) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const avatar = useCreatorAvatar();

  const [status, setStatus] = createSignal<BetaStatus | "">("");
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [newId, setNewId] = createSignal("");
  const [newName, setNewName] = createSignal("");
  const [invite, setInvite] = createSignal("");

  const [features, { refetch: refetchFeatures }] = createResource(
    () => props.show || undefined,
    () => betaApi.features(client()),
  );
  const [members, { refetch: refetchMembers }] = createResource(
    () => (props.show ? status() || "all" : undefined),
    (value) =>
      betaApi.members(
        client(),
        value === "all" ? undefined : (value as BetaStatus),
      ),
  );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await Promise.all([refetchFeatures(), refetchMembers()]);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = (value: string): string => {
    // the server may send values this app does not know yet
    const labels: Record<string, string> = {
      Requested: t`Requested`,
      Invited: t`Invited`,
      Active: t`Active`,
      Removed: t`Removed`,
      Completed: t`Completed`,
    };
    return labels[value] ?? value;
  };

  const toggleFeature = (member: BetaMemberRecord, feature: string) =>
    run(() =>
      betaApi.member(
        client(),
        member.user._id,
        "features",
        member.features.includes(feature)
          ? member.features.filter((f) => f !== feature)
          : [...member.features, feature],
      ),
    );

  async function inviteUser() {
    const query = invite().trim();
    if (!query) return;
    await run(async () => {
      const [match] = await badgesApi.search(client(), query);
      if (!match) throw translatedError(t`No users match your search.`);
      await betaApi.member(client(), match.user._id, "invite");
      setInvite("");
    });
  }

  return (
    <Dialog
      tone="settings"
      iconName="sparkle"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Beta program</Trans>}
      size="xl"
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "14px" }}>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>

        <h3
          style={{
            margin: 0,
            "font-size": "12px",
            "text-transform": "uppercase",
          }}
        >
          <Trans>Feature flags</Trans>
        </h3>
        <List style={{ "max-height": "220px" }}>
          <Show when={!features()?.length}>
            <Empty>
              <Trans>No beta features yet.</Trans>
            </Empty>
          </Show>
          <For each={features()}>
            {(feature) => (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  "flex-wrap": "wrap",
                }}
              >
                <strong style={{ flex: 1, "min-width": "140px" }}>
                  {feature.name}{" "}
                  <small style={{ color: "var(--z-fg-muted)" }}>
                    {feature._id}
                  </small>
                </strong>
                <Actions>
                  <button
                    type="button"
                    aria-pressed={feature.enabled}
                    disabled={busy()}
                    onClick={() =>
                      void run(() =>
                        betaApi.saveFeature(client(), {
                          id: feature._id,
                          name: feature.name,
                          description: feature.description ?? undefined,
                          enabled: !feature.enabled,
                          all_testers: feature.all_testers,
                        }),
                      )
                    }
                  >
                    <Show when={feature.enabled} fallback={<Trans>Off</Trans>}>
                      <Trans>On</Trans>
                    </Show>
                  </button>
                  <button
                    type="button"
                    aria-pressed={feature.all_testers}
                    disabled={busy()}
                    onClick={() =>
                      void run(() =>
                        betaApi.saveFeature(client(), {
                          id: feature._id,
                          name: feature.name,
                          description: feature.description ?? undefined,
                          enabled: feature.enabled,
                          all_testers: !feature.all_testers,
                        }),
                      )
                    }
                  >
                    <Show
                      when={feature.all_testers}
                      fallback={<Trans>Chosen testers</Trans>}
                    >
                      <Trans>All testers</Trans>
                    </Show>
                  </button>
                </Actions>
              </div>
            )}
          </For>
        </List>
        <Row>
          <Field>
            <span>
              <Trans>Feature id</Trans>
            </span>
            <input
              value={newId()}
              maxLength={48}
              placeholder="new-composer"
              onInput={(e) => setNewId(e.currentTarget.value.toLowerCase())}
            />
          </Field>
          <Field>
            <span>
              <Trans>Name</Trans>
            </span>
            <input
              value={newName()}
              maxLength={64}
              onInput={(e) => setNewName(e.currentTarget.value)}
            />
          </Field>
        </Row>
        <Actions>
          <button
            type="button"
            data-primary
            disabled={
              busy() || newId().length < 2 || newName().trim().length < 2
            }
            onClick={() =>
              void run(async () => {
                await betaApi.saveFeature(client(), {
                  id: newId(),
                  name: newName(),
                  enabled: false,
                  all_testers: false,
                });
                setNewId("");
                setNewName("");
              })
            }
          >
            <Trans>Add feature (off)</Trans>
          </button>
        </Actions>

        <h3
          style={{
            margin: 0,
            "font-size": "12px",
            "text-transform": "uppercase",
          }}
        >
          <Trans>Testers</Trans>
        </h3>
        <Row>
          <Field>
            <span>
              <Trans>Invite by name or id</Trans>
            </span>
            <input
              value={invite()}
              onInput={(e) => setInvite(e.currentTarget.value)}
            />
          </Field>
          <Field>
            <span>
              <Trans>Show</Trans>
            </span>
            <FloatingSelect
              value={status()}
              onChange={(e) =>
                setStatus(e.currentTarget.value as BetaStatus | "")
              }
            >
              <MenuItem value="">{t`Everyone`}</MenuItem>
              <For
                each={
                  [
                    "Requested",
                    "Invited",
                    "Active",
                    "Removed",
                    "Completed",
                  ] as BetaStatus[]
                }
              >
                {(value) => (
                  <MenuItem value={value}>{statusLabel(value)}</MenuItem>
                )}
              </For>
            </FloatingSelect>
          </Field>
        </Row>
        <Actions>
          <button
            type="button"
            data-primary
            disabled={busy() || !invite().trim()}
            onClick={() => void inviteUser()}
          >
            <Trans>Invite</Trans>
          </button>
        </Actions>
        <List>
          <Show when={!members()?.length}>
            <Empty>
              <Trans>Nobody here yet.</Trans>
            </Empty>
          </Show>
          <For each={members()}>
            {(member) => (
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  gap: "6px",
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
                    "flex-wrap": "wrap",
                  }}
                >
                  <Avatar
                    size={30}
                    src={avatar(member.user)}
                    fallback={creatorName(member.user)}
                  />
                  <span
                    style={{
                      flex: 1,
                      "min-width": "120px",
                      display: "flex",
                      "flex-direction": "column",
                    }}
                  >
                    <strong>
                      <bdi>{creatorName(member.user)}</bdi>
                    </strong>
                    <small style={{ color: "var(--z-fg-muted)" }}>
                      <bdi>{creatorHandle(member.user)}</bdi> ·{" "}
                      {date(member.created_at)} ·{" "}
                      <Trans>{member.contributions} contributions</Trans>
                    </small>
                  </span>
                  <Pill
                    data-tone={
                      member.status === "Active" ? "accent" : undefined
                    }
                  >
                    {statusLabel(member.status)}
                  </Pill>
                </div>
                <Actions>
                  <Show
                    when={
                      member.status === "Requested" ||
                      member.status === "Invited"
                    }
                  >
                    <button
                      type="button"
                      data-primary
                      disabled={busy()}
                      onClick={() =>
                        void run(() =>
                          betaApi.member(client(), member.user._id, "approve"),
                        )
                      }
                    >
                      <Trans>Approve</Trans>
                    </button>
                  </Show>
                  <Show
                    when={
                      member.status === "Removed" ||
                      member.status === "Completed"
                    }
                  >
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() =>
                        void run(() =>
                          betaApi.member(client(), member.user._id, "invite"),
                        )
                      }
                    >
                      <Trans>Invite again</Trans>
                    </button>
                  </Show>
                  <Show when={member.status === "Active"}>
                    <button
                      type="button"
                      disabled={busy() || member.contributions < 1}
                      onClick={() =>
                        void run(() =>
                          betaApi.member(client(), member.user._id, "complete"),
                        )
                      }
                    >
                      <Trans>Complete (Beta Veteran)</Trans>
                    </button>
                  </Show>
                  <Show
                    when={["Active", "Invited", "Requested"].includes(
                      member.status,
                    )}
                  >
                    <button
                      type="button"
                      data-danger
                      disabled={busy()}
                      onClick={() =>
                        void run(() =>
                          betaApi.member(client(), member.user._id, "remove"),
                        )
                      }
                    >
                      <Trans>Remove</Trans>
                    </button>
                  </Show>
                </Actions>
                <Show when={member.status === "Active" && features()?.length}>
                  <Actions>
                    <For each={features()}>
                      {(feature) => (
                        <button
                          type="button"
                          aria-pressed={member.features.includes(feature._id)}
                          disabled={busy()}
                          onClick={() =>
                            void toggleFeature(member, feature._id)
                          }
                        >
                          {feature.name}
                        </button>
                      )}
                    </For>
                  </Actions>
                </Show>
              </div>
            )}
          </For>
        </List>
      </div>
    </Dialog>
  );
}
