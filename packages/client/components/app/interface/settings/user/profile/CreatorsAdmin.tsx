import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Avatar, Dialog } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { CommunityHead, useCreatorAvatar, useDate } from "./CommunityParts";
import {
  CommunityPermissions,
  CreatorLogEntry,
  CreatorRecord,
  can,
  communityApi,
  creatorHandle,
  creatorName,
} from "./communityApi";

/**
 * Creators management: find users, make them creators, pause or revoke
 * them, see who changed what. Admins with `cosmetics.manage_all` can also
 * make reviewers. Creator access can't be bought or come from a server.
 */
export function CreatorsAdmin(props: {
  show: boolean;
  onClose: () => void;
  perms: CommunityPermissions;
}) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const avatar = useCreatorAvatar();

  const [typed, setTyped] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [reason, setReason] = createSignal("");
  const [open, setOpen] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  createEffect(() => {
    const value = typed().trim();
    const timer = setTimeout(() => setQuery(value), 300);
    onCleanup(() => clearTimeout(timer));
  });

  const [records, { mutate }] = createResource(query, (q) =>
    communityApi.creators(client(), q || undefined),
  );
  const [history] = createResource(open, (id) =>
    communityApi.creatorHistory(client(), id),
  );

  const standing = (record: CreatorRecord) =>
    ({
      Active: t`Creator`,
      Suspended: t`Suspended`,
      Revoked: t`Revoked`,
    })[record.creator ?? "Revoked"];

  const permissionLabel = (permission: string): string => {
    // the server may send values this app does not know yet
    const labels: Record<string, string> = {
      "cosmetics.submit": t`Submit designs`,
      "cosmetics.manage_own": t`Manage own designs`,
      "cosmetics.review": t`Reviewer`,
      "cosmetics.manage_creators": t`Manage creators`,
      "cosmetics.manage_all": t`Admin`,
    };
    return labels[permission] ?? permission;
  };

  const logLabel = (action: CreatorLogEntry["action"]) =>
    ({
      Grant: t`Made creator`,
      Revoke: t`Revoked`,
      Suspend: t`Suspended`,
      Reinstate: t`Reinstated`,
      SetPermissions: t`Permissions changed`,
    })[action];

  async function act(record: CreatorRecord, run: () => Promise<CreatorRecord>) {
    setBusy(true);
    setError(undefined);
    try {
      const updated = await run();
      mutate((list) =>
        (list ?? []).map((entry) =>
          entry.user._id === record.user._id ? updated : entry,
        ),
      );
      setReason("");
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const action = (
    record: CreatorRecord,
    kind: "grant" | "revoke" | "suspend" | "reinstate",
  ) =>
    act(record, () =>
      communityApi.creatorAction(client(), record.user._id, kind, reason()),
    );

  const toggleReviewer = (record: CreatorRecord) => {
    const has = record.permissions.includes("cosmetics.review");
    const next = has
      ? record.permissions.filter((p) => p !== "cosmetics.review")
      : [...record.permissions, "cosmetics.review" as const];
    return act(record, () =>
      communityApi.setPermissions(client(), record.user._id, next, reason()),
    );
  };

  return (
    <Dialog
      tone="settings"
      iconName="crown"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Creators</Trans>}
      size="xl"
    >
      <Body>
        <CommunityHead
          title={<Trans>Who can publish community designs</Trans>}
          compact
        >
          <Trans>
            Only people you make creators can submit designs. Revoking stops new
            submissions right away; published designs stay.
          </Trans>
        </CommunityHead>
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
            <Trans>Reason (saved in the history)</Trans>
          </span>
          <input
            maxLength={500}
            value={reason()}
            onInput={(e) => setReason(e.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>

        <Switch>
          <Match when={records.loading}>
            <Empty>
              <Trans>Loading…</Trans>
            </Empty>
          </Match>
          <Match when={records.error}>
            <Empty>{describeError(records.error)}</Empty>
          </Match>
          <Match when={!records()?.length}>
            <Empty>
              <Show
                when={query()}
                fallback={
                  <Trans>No creators yet. Search for someone to add one.</Trans>
                }
              >
                <Trans>No users match your search.</Trans>
              </Show>
            </Empty>
          </Match>
          <Match when={true}>
            <List>
              <For each={records()}>
                {(record) => (
                  <Row>
                    <Head>
                      <Avatar
                        size={36}
                        src={avatar(record.user)}
                        fallback={creatorName(record.user)}
                      />
                      <span>
                        <strong>
                          <bdi>{creatorName(record.user)}</bdi>
                        </strong>
                        <small>
                          <bdi>{creatorHandle(record.user)}</bdi>
                        </small>
                      </span>
                      <Show when={record.creator}>
                        <Standing data-standing={record.creator}>
                          {standing(record)}
                        </Standing>
                      </Show>
                    </Head>
                    <Show when={record.permissions.length}>
                      <Perms>
                        <For each={record.permissions}>
                          {(permission) => (
                            <span>{permissionLabel(permission)}</span>
                          )}
                        </For>
                      </Perms>
                    </Show>
                    <Actions>
                      <Switch>
                        <Match when={!record.creator}>
                          <button
                            type="button"
                            data-primary
                            disabled={busy()}
                            onClick={() => void action(record, "grant")}
                          >
                            <Trans>Make creator</Trans>
                          </button>
                        </Match>
                        <Match when={record.creator === "Active"}>
                          <button
                            type="button"
                            disabled={busy()}
                            onClick={() => void action(record, "suspend")}
                          >
                            <Trans>Suspend</Trans>
                          </button>
                          <button
                            type="button"
                            data-danger
                            disabled={busy()}
                            onClick={() => void action(record, "revoke")}
                          >
                            <Trans>Revoke</Trans>
                          </button>
                        </Match>
                        <Match when={true}>
                          <button
                            type="button"
                            data-primary
                            disabled={busy()}
                            onClick={() => void action(record, "reinstate")}
                          >
                            <Trans>Reinstate</Trans>
                          </button>
                        </Match>
                      </Switch>
                      <Show when={can(props.perms, "cosmetics.manage_all")}>
                        <button
                          type="button"
                          disabled={busy()}
                          aria-pressed={record.permissions.includes(
                            "cosmetics.review",
                          )}
                          onClick={() => void toggleReviewer(record)}
                        >
                          <Show
                            when={record.permissions.includes(
                              "cosmetics.review",
                            )}
                            fallback={<Trans>Make reviewer</Trans>}
                          >
                            <Trans>Remove reviewer</Trans>
                          </Show>
                        </button>
                      </Show>
                      <button
                        type="button"
                        aria-expanded={open() === record.user._id}
                        onClick={() =>
                          setOpen((id) =>
                            id === record.user._id
                              ? undefined
                              : record.user._id,
                          )
                        }
                      >
                        <Icon name="clock-counter-clockwise" size={14} />
                        <Trans>History</Trans>
                      </button>
                    </Actions>
                    <Show when={open() === record.user._id}>
                      <Log>
                        <Show
                          when={history()?.length}
                          fallback={
                            <small>
                              <Trans>No changes yet.</Trans>
                            </small>
                          }
                        >
                          <For each={history()}>
                            {(entry) => (
                              <li>
                                <strong>{logLabel(entry.action)}</strong>
                                <time>{date(entry.created_at)}</time>
                                <Show when={entry.reason}>
                                  <q dir="auto">{entry.reason}</q>
                                </Show>
                              </li>
                            )}
                          </For>
                        </Show>
                      </Log>
                    </Show>
                  </Row>
                )}
              </For>
            </List>
          </Match>
        </Switch>
      </Body>
    </Dialog>
  );
}

/** pink to violet, as on the Plus screens (local: Panda reads it statically) */
const PINK_GRADIENT = "var(--z-accent-gradient)";

const Body = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 },
});

const Search = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "38px",
    paddingInline: "12px",
    borderRadius: "999px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    _focusWithin: {
      borderColor: "var(--z-focus)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
    },
  },
});

const Field = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    "& span": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
    "& input": {
      height: "34px",
      paddingInline: "10px",
      borderRadius: "var(--z-radius, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      textAlign: "start",
      unicodeBidi: "plaintext",
      outline: "none",
      _focus: { borderColor: "var(--z-focus)" },
    },
  },
});

const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger, #F27488)" },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "28px 8px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
  },
});

const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    maxHeight: "min(420px, 55dvh)",
    overflowY: "auto",
    padding: "2px",
  },
});

const Row = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "calc(var(--z-radius, 10px) + 2px)",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    "& > span": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    },
    "& strong": { fontSize: "14px" },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const Standing = styled("span", {
  base: {
    paddingInline: "8px",
    height: "20px",
    lineHeight: "20px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#fff",
    background: PINK_GRADIENT,
    "&[data-standing='Suspended']": {
      background: "rgb(245 196 81 / 20%)",
      color: "var(--z-accent)",
    },
    "&[data-standing='Revoked']": {
      background: "color-mix(in srgb, var(--z-accent-deep) 18%, transparent)",
      color: "var(--z-danger)",
    },
  },
});

const Perms = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    "& span": {
      paddingInline: "7px",
      borderRadius: "999px",
      fontSize: "12px",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    "& button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      height: "30px",
      paddingInline: "12px",
      border: "1px solid var(--z-border-subtle)",
      borderRadius: "var(--z-radius, 10px)",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
      fontWeight: 650,
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      _disabled: { opacity: 0.5, cursor: "default" },
    },
    "& button[data-primary]": {
      border: "none",
      color: "#fff",
      background: PINK_GRADIENT,
    },
    "& button[data-danger]": {
      borderColor: "var(--z-danger, #F27488)",
      color: "var(--z-danger, #F27488)",
    },
    "& button[aria-pressed='true']": { borderColor: "var(--z-accent)" },
  },
});

const Log = styled("ol", {
  base: {
    margin: 0,
    paddingInlineStart: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "13px",
    "& li": { display: "flex", flexWrap: "wrap", gap: "6px" },
    "& time": { color: "var(--z-fg-muted)" },
    "& small": { color: "var(--z-fg-muted)" },
  },
});
