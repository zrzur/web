import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Dialog } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  CommunityHead,
  CommunityImage,
  CreatorChip,
  DecorationArt,
  EffectArt,
  NameplateArt,
  StatusBadge,
  useDate,
} from "./CommunityParts";
import {
  CommunityItem,
  CommunityPermissions,
  CommunityReviewEntry,
  can,
  communityApi,
  communityErrorType,
} from "./communityApi";

type Lane = "pending" | "revisions" | "reported";

/**
 * Review queue: new designs, new versions of published ones and reported
 * ones. Reviewers approve, reject, ask for changes or suspend, always
 * with a reason the creator sees (except approvals, where it's optional).
 */
export function ReviewQueue(props: {
  show: boolean;
  onClose: () => void;
  perms: CommunityPermissions;
  avatar?: string;
  name: string;
}) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();

  const [lane, setLane] = createSignal<Lane>("reported");
  const [selected, setSelected] = createSignal<string>();
  const [reason, setReason] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const [queue, { refetch }] = createResource(() =>
    communityApi.queue(client()),
  );
  const list = () => queue()?.[lane()] ?? [];
  const creator = (id: string) =>
    queue()?.creators.find((entry) => entry._id === id);
  const item = createMemo(
    () => list().find((entry) => entry._id === selected()) ?? list()[0],
  );
  const [details, { refetch: refetchDetails }] = createResource(
    () => item()?._id,
    (id) => communityApi.details(client(), id),
  );

  const actionLabel = (entry: CommunityReviewEntry) =>
    ({
      Submit: t`Submitted`,
      Publish: t`Published by the creator`,
      Approve: t`Approved`,
      Reject: t`Rejected`,
      RequestChanges: t`Changes requested`,
      Suspend: t`Suspended`,
      Archive: t`Archived`,
      Report: t`Reported`,
      Override: t`Reopened by an admin`,
    })[entry.action];

  async function decide(
    target: CommunityItem,
    action: "approve" | "reject" | "request-changes" | "suspend",
  ) {
    if (action !== "approve" && !reason().trim()) {
      setError(t`Write a reason first. The creator will see it.`);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await communityApi.decide(
        client(),
        target._id,
        action,
        reason(),
        details()?.version,
      );
      setReason("");
      setSelected(undefined);
      await refetch();
    } catch (failure) {
      if (communityErrorType(failure) === "CommunityItemConflict") {
        setError(t`Another reviewer acted on this first. The list is updated.`);
        await refetch();
        await refetchDetails();
      } else {
        setError(describeError(failure));
      }
    } finally {
      setBusy(false);
    }
  }

  // creators publish directly now, so reports are the main lane; the other
  // two only show while something from before is still waiting
  const lanes = () =>
    [
      {
        id: "reported" as const,
        label: t`Reported`,
        count: queue()?.reported.length ?? 0,
      },
      {
        id: "pending" as const,
        label: t`New`,
        count: queue()?.pending.length ?? 0,
      },
      {
        id: "revisions" as const,
        label: t`New versions`,
        count: queue()?.revisions.length ?? 0,
      },
    ].filter((entry) => entry.id === "reported" || entry.count > 0);

  const Art = (art: {
    item: CommunityItem;
    pending?: boolean;
    size: number;
  }) => (
    <CommunityImage
      item={art.item}
      file={art.pending ? art.item.pending?.file : undefined}
    >
      {(url) =>
        art.item.kind === "Decoration" ? (
          <DecorationArt
            url={url}
            avatar={props.avatar}
            name={props.name}
            size={art.size}
          />
        ) : art.item.kind === "Effect" ? (
          <EffectArt
            url={url}
            label={art.item.name}
            height={art.size < 80 ? art.size : 240}
          />
        ) : (
          <NameplateArt
            url={url}
            avatar={props.avatar}
            name={props.name}
            small={art.size < 80}
          />
        )
      }
    </CommunityImage>
  );

  return (
    <Dialog
      tone="settings"
      iconName="flag"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Review queue</Trans>}
      size="xl"
      width={960}
    >
      <Body>
        <CommunityHead
          title={<Trans>Community designs to review</Trans>}
          compact
        >
          <Trans>
            Decorations and nameplates go live at once; effects wait here for
            your approval. Take down anything that breaks the rules, with a
            clear reason for the creator.
          </Trans>
        </CommunityHead>
        <Lanes role="tablist">
          <For each={lanes()}>
            {(entry) => (
              <button
                type="button"
                role="tab"
                aria-selected={lane() === entry.id}
                onClick={() => {
                  setLane(entry.id);
                  setSelected(undefined);
                  setError(undefined);
                }}
              >
                {entry.label}
                <span>{entry.count}</span>
              </button>
            )}
          </For>
        </Lanes>

        <Switch>
          <Match when={queue.loading}>
            <Empty>
              <Trans>Loading…</Trans>
            </Empty>
          </Match>
          <Match when={queue.error}>
            <Empty>
              <Trans>The review queue couldn't be loaded.</Trans>
              <button type="button" onClick={() => void refetch()}>
                <Trans>Try again</Trans>
              </button>
            </Empty>
          </Match>
          <Match when={!list().length}>
            <Empty>
              <Icon name="check-circle" size={22} />
              <Trans>All caught up. Nothing waiting here.</Trans>
            </Empty>
          </Match>
          <Match when={item()}>
            {(current) => (
              <Layout>
                <Queue>
                  <For each={list()}>
                    {(entry) => (
                      <QueueRow
                        type="button"
                        aria-pressed={entry._id === current()._id}
                        onClick={() => {
                          setSelected(entry._id);
                          setError(undefined);
                        }}
                      >
                        <RowArt>
                          <Art
                            item={entry}
                            pending={lane() === "revisions"}
                            size={36}
                          />
                        </RowArt>
                        <span data-text>
                          <strong>
                            <bdi>{entry.pending?.name ?? entry.name}</bdi>
                          </strong>
                          <small>
                            <bdi>
                              {creator(entry.creator_id)?.display_name ??
                                entry.creator_id}
                            </bdi>
                          </small>
                        </span>
                        <Show when={entry.reports}>
                          <Count title={t`Reports`}>
                            <Icon name="flag" size={12} />
                            {entry.reports}
                          </Count>
                        </Show>
                      </QueueRow>
                    )}
                  </For>
                </Queue>

                <Panel>
                  <Compare data-two={lane() === "revisions"}>
                    <figure>
                      <Art item={current()} size={112} />
                      <Show when={lane() === "revisions"}>
                        <figcaption>
                          <Trans>Published now</Trans>
                        </figcaption>
                      </Show>
                    </figure>
                    <Show when={lane() === "revisions"}>
                      <figure>
                        <Art item={current()} pending size={112} />
                        <figcaption>
                          <Trans>New version</Trans>
                        </figcaption>
                      </figure>
                    </Show>
                  </Compare>

                  <h3>
                    <bdi>{current().pending?.name ?? current().name}</bdi>
                  </h3>
                  <Meta>
                    <StatusBadge status={current().status} />
                    <CreatorChip
                      creator={creator(current().creator_id)}
                      size={18}
                      verbose
                    />
                    <span>
                      {current().kind === "Decoration" ? (
                        <Trans>Avatar decoration</Trans>
                      ) : current().kind === "Effect" ? (
                        <Trans>Profile effect</Trans>
                      ) : (
                        <Trans>Nameplate</Trans>
                      )}
                    </span>
                  </Meta>
                  <Show when={current().rights}>
                    {(rights) => (
                      <Promised data-testid="effect-rights">
                        <span>
                          <Trans>
                            Rights confirmed on {date(rights().confirmed_at)}
                          </Trans>
                        </span>
                        <Show when={rights().third_party}>
                          <span dir="auto">
                            <Trans>Parts made by others</Trans>:{" "}
                            {rights().third_party}
                          </span>
                        </Show>
                        <Show when={rights().ai_parts}>
                          <span dir="auto">
                            <Trans>Parts made with AI tools</Trans>:{" "}
                            {rights().ai_parts}
                          </span>
                        </Show>
                      </Promised>
                    )}
                  </Show>
                  <Show
                    when={
                      current().pending?.description ?? current().description
                    }
                  >
                    {(text) => <p dir="auto">{text()}</p>}
                  </Show>
                  <Show
                    when={(current().pending?.tags ?? current().tags)?.length}
                  >
                    <Tags>
                      <For each={current().pending?.tags ?? current().tags}>
                        {(tag) => (
                          <span>
                            <bdi>#{tag}</bdi>
                          </span>
                        )}
                      </For>
                    </Tags>
                  </Show>

                  <History>
                    <strong>
                      <Trans>History</Trans>
                    </strong>
                    <Show
                      when={details()?.history?.length}
                      fallback={
                        <small>
                          <Trans>No history yet.</Trans>
                        </small>
                      }
                    >
                      <ol>
                        <For each={details()!.history}>
                          {(entry) => (
                            <li>
                              <span>{actionLabel(entry)}</span>
                              <time>{date(entry.created_at)}</time>
                              <Show when={entry.reason}>
                                <q dir="auto">{entry.reason}</q>
                              </Show>
                            </li>
                          )}
                        </For>
                      </ol>
                    </Show>
                  </History>

                  <Field>
                    <span>
                      <Trans>Reason for the creator</Trans>
                    </span>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={reason()}
                      placeholder={t`Required to reject, request changes or suspend`}
                      onInput={(e) => setReason(e.currentTarget.value)}
                    />
                  </Field>
                  <Show when={error()}>
                    <ErrorText role="alert">{error()}</ErrorText>
                  </Show>
                  <Show
                    when={
                      current().creator_id !== client().user?.id ||
                      can(props.perms, "cosmetics.manage_all")
                    }
                    fallback={
                      <small>
                        <Trans>You can't review your own design.</Trans>
                      </small>
                    }
                  >
                    <Decisions>
                      <Show
                        when={lane() !== "reported"}
                        fallback={
                          <>
                            <button
                              type="button"
                              data-danger
                              disabled={busy()}
                              onClick={() => void decide(current(), "suspend")}
                            >
                              <Trans>Suspend</Trans>
                            </button>
                            <button
                              type="button"
                              data-primary
                              disabled={busy()}
                              onClick={() => void decide(current(), "approve")}
                            >
                              <Show
                                when={current().status === "Suspended"}
                                fallback={<Trans>Keep it</Trans>}
                              >
                                <Trans>Reinstate</Trans>
                              </Show>
                            </button>
                          </>
                        }
                      >
                        <button
                          type="button"
                          data-danger
                          disabled={busy()}
                          onClick={() => void decide(current(), "reject")}
                        >
                          <Trans>Reject</Trans>
                        </button>
                        <button
                          type="button"
                          disabled={busy()}
                          onClick={() =>
                            void decide(current(), "request-changes")
                          }
                        >
                          <Trans>Request changes</Trans>
                        </button>
                        <button
                          type="button"
                          data-primary
                          disabled={busy()}
                          onClick={() => void decide(current(), "approve")}
                        >
                          <Icon name="check" size={14} />
                          <Trans>Approve</Trans>
                        </button>
                      </Show>
                    </Decisions>
                  </Show>
                </Panel>
              </Layout>
            )}
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

const Promised = styled("p", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Lanes = styled("div", {
  base: {
    display: "inline-flex",
    alignSelf: "flex-start",
    flexWrap: "wrap",
    gap: "2px",
    padding: "3px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    "& button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      height: "32px",
      paddingInline: "14px",
      border: "none",
      borderRadius: "calc(var(--z-radius, 10px) - 3px)",
      background: "transparent",
      color: "var(--z-fg-secondary)",
      font: "inherit",
      fontSize: "14px",
      fontWeight: 650,
      cursor: "pointer",
    },
    "& button[aria-selected='true']": {
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-primary)",
    },
    "& button span": {
      minWidth: "18px",
      paddingInline: "5px",
      borderRadius: "999px",
      fontSize: "11px",
      color: "#fff",
      background: PINK_GRADIENT,
    },
  },
});

const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
    "@media (max-width: 720px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Queue = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "min(520px, 60dvh)",
    overflowY: "auto",
    padding: "2px",
    "@media (max-width: 720px)": { maxHeight: "200px" },
  },
});

const QueueRow = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px",
    border: "1px solid var(--z-btn-surface-border)",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "& > [data-text]": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    },
    "& strong, & small": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
    "& strong": { fontSize: "14px" },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
    _hover: { background: "var(--z-bg-raised)" },
    "&[aria-pressed='true']": {
      background: "var(--z-bg-raised)",
      borderColor: "var(--z-accent)",
    },
  },
});

/** fixed slot, so a nameplate doesn't take the whole row */
const RowArt = styled("div", {
  base: {
    flexShrink: 0,
    width: "64px",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  },
});

const Count = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-danger, #F27488)",
    "--z-icon-color": "currentColor",
  },
});

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    textAlign: "start",
    "& h3": { margin: 0, fontSize: "16px" },
    "& > p": {
      margin: 0,
      fontSize: "14px",
      color: "var(--z-fg-secondary)",
      whiteSpace: "pre-wrap",
    },
    "& > small": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const Compare = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "10px",
    "&[data-two='true']": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    "& figure": {
      margin: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      minHeight: "150px",
      padding: "12px",
      borderRadius: "12px",
      background:
        "radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--z-accent) 14%, transparent), transparent 70%), var(--z-bg-input)",
    },
    "& figcaption": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const Tags = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    "& span": {
      paddingInline: "8px",
      borderRadius: "999px",
      fontSize: "12px",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-secondary)",
    },
  },
});

const History = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    "& > strong": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
    "& ol": {
      margin: 0,
      paddingInlineStart: "18px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      maxHeight: "140px",
      overflowY: "auto",
      fontSize: "13px",
    },
    "& li": { display: "flex", flexWrap: "wrap", gap: "6px" },
    "& time": { color: "var(--z-fg-muted)" },
    "& q": { color: "var(--z-fg-secondary)" },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
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
    "& textarea": {
      padding: "8px 10px",
      borderRadius: "var(--z-radius, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
      unicodeBidi: "plaintext",
      resize: "vertical",
      outline: "none",
      _focus: { borderColor: "var(--z-focus)" },
    },
  },
});

const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger, #F27488)" },
});

const Decisions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    "& button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      height: "34px",
      paddingInline: "14px",
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
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "36px 12px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-status-success, #55DCC8)",
    "& button": {
      height: "32px",
      paddingInline: "14px",
      border: "1px solid var(--z-border-subtle)",
      borderRadius: "var(--z-radius, 10px)",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      cursor: "pointer",
    },
  },
});
