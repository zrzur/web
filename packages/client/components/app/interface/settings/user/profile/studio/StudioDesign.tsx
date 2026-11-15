import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Button, Dialog } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type CommunityItem,
  type CommunityPermissions,
  CREATOR_TERMS_VERSION,
  communityApi,
  isRankRefusal,
  kindOf,
} from "../communityApi";

import {
  Actions,
  Callout,
  Crumbs,
  Page,
  PageHead,
  Panel,
  SpecList,
  StatusMark,
  Thumb,
  useStudioWords,
} from "./parts";
import { actionsOf, reviewNote, shownStatus } from "./studioModel";

/**
 * One design, for its creator: where it stands, what a reviewer said, all
 * that happened to it, what was promised with it, and what can be done next.
 */
export function StudioDesign(props: {
  item: CommunityItem;
  perms: CommunityPermissions;
  readOnly: boolean;
  avatar?: string;
  name: string;
  dialog?: boolean;
  onLeave: () => void;
  onBack: () => void;
  /** open the editor, at the rights step when a promise is all that is missing */
  onEdit: (item: CommunityItem, step?: "rights") => void;
  /** the design changed, or is gone (`undefined`) */
  onChanged: (item: CommunityItem | undefined, id: string) => void;
  /** the server refused over the rank: read the rank again */
  onRankRefused: () => void;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const describeError = useError();
  const words = useStudioWords();

  const [details] = createResource(
    // again after every change: the history grows
    () =>
      [props.item._id, props.item.status, props.item.pending?.status] as const,
    ([id]) => communityApi.details(client(), id).catch(() => undefined),
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [asking, setAsking] = createSignal<"withdraw" | "delete">();

  const can = () => actionsOf(props.item, props.readOnly);
  /**
   * Who withdrew it: the creator, or staff (a takedown, with a reason and an
   * appeal). The history says; the server sends the creator's own id on their
   * own entries only. Unknown until the history is here.
   */
  const withdrawnBy = (): "you" | "staff" | undefined => {
    if (props.item.status !== "Archived" || !details()) return undefined;
    const last = history().find((entry) => entry.action === "Archive");
    return last?.actor_id === client().user?.id ? "you" : "staff";
  };
  const staffReason = () =>
    history().find((entry) => entry.action === "Archive")?.reason ?? undefined;
  const status = () => shownStatus(props.item);
  const title = () => props.item.pending?.name ?? props.item.name;
  const when = (ms: number) =>
    new Intl.DateTimeFormat(i18n().locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);
  const history = () =>
    [...(details()?.history ?? [])].sort((a, b) => b.created_at - a.created_at);

  async function run<T>(action: () => Promise<T>, done: (result: T) => void) {
    setBusy(true);
    setError(undefined);
    try {
      done(await action());
      setAsking(undefined);
    } catch (failure) {
      setError(describeError(failure));
      if (isRankRefusal(failure)) props.onRankRefused();
    } finally {
      setBusy(false);
    }
  }
  const changed = (item: CommunityItem) => props.onChanged(item, item._id);

  function publish() {
    // nothing goes out without the creator's promise on this version
    // (under older terms it does not count: they are asked again)
    if (props.item.rights?.terms_version !== CREATOR_TERMS_VERSION)
      return props.onEdit(props.item, "rights");
    void run(() => communityApi.submit(client(), props.item._id), changed);
  }

  const toneOf = () =>
    status() === "ChangesRequested" ? ("warning" as const) : ("error" as const);

  return (
    <Page
      data-dialog={props.dialog ? "" : undefined}
      data-testid="studio-design"
    >
      <Crumbs aria-label={t`You are here`}>
        <Show when={!props.dialog}>
          <button type="button" onClick={() => props.onLeave()}>
            <Trans>Designs</Trans>
          </button>
          <span aria-hidden="true">/</span>
        </Show>
        <button
          type="button"
          data-testid="studio-back"
          onClick={() => props.onBack()}
        >
          <Trans>Creator Studio</Trans>
        </button>
        <span aria-hidden="true">/</span>
        <b>
          <bdi>{title()}</bdi>
        </b>
      </Crumbs>

      <PageHead>
        <div>
          <h1>
            <bdi>{title()}</bdi>
          </h1>
          <Meta>
            <StatusMark status={status()} />
            <span>{words.kind(kindOf(props.item))}</span>
            <span>
              <Trans>
                Version{" "}
                {number(props.item.pending?.revision ?? props.item.revision)}
              </Trans>
            </span>
          </Meta>
        </div>
        <Actions>
          <Show when={can().download}>
            <Button
              variant="tonal"
              isDisabled={busy()}
              onPress={() =>
                void communityApi
                  .download(client(), props.item._id)
                  .catch(() => setError(t`The copy could not be downloaded.`))
              }
            >
              <Icon name="download-simple" size={16} />
              <Trans>Download your copy</Trans>
            </Button>
          </Show>
          <Show when={can().remove}>
            <Button
              variant="tonal"
              data-testid="studio-delete"
              isDisabled={busy()}
              onPress={() => setAsking("delete")}
            >
              <Icon name="trash" size={16} />
              <Trans>Delete</Trans>
            </Button>
          </Show>
          <Show when={can().withdraw}>
            <Button
              variant="tonal"
              data-testid="studio-withdraw"
              isDisabled={busy()}
              onPress={() => setAsking("withdraw")}
            >
              <Icon name="archive" size={16} />
              <Trans>Withdraw</Trans>
            </Button>
          </Show>
          <Show when={can().restore && withdrawnBy() === "you"}>
            <Button
              variant="filled"
              data-testid="studio-restore"
              isDisabled={busy()}
              onPress={() =>
                void run(
                  () => communityApi.restore(client(), props.item._id),
                  changed,
                )
              }
            >
              <Trans>Take back as a draft</Trans>
            </Button>
          </Show>
          <Show when={can().edit}>
            <Button
              variant={can().publish ? "tonal" : "filled"}
              data-testid="studio-edit"
              isDisabled={busy()}
              onPress={() => props.onEdit(props.item)}
            >
              <Icon name="pencil-simple" size={16} />
              <Show
                when={props.item.status === "Published"}
                fallback={<Trans>Edit</Trans>}
              >
                <Trans>Make a new version</Trans>
              </Show>
            </Button>
          </Show>
          <Show when={can().publish}>
            <Button
              variant="filled"
              data-testid="studio-publish"
              isDisabled={busy()}
              onPress={publish}
            >
              <Show
                when={props.item.kind === "Effect"}
                fallback={<Trans>Publish</Trans>}
              >
                <Trans>Send for review</Trans>
              </Show>
            </Button>
          </Show>
        </Actions>
      </PageHead>

      <Show when={error()}>
        <Callout tone="error" testid="studio-error">
          {error()}
        </Callout>
      </Show>

      <Columns>
        <Main>
          <Switch>
            <Match
              when={["ChangesRequested", "Rejected", "Suspended"].includes(
                status(),
              )}
            >
              <Callout
                tone={toneOf()}
                testid="studio-note"
                title={
                  <Switch>
                    <Match when={status() === "ChangesRequested"}>
                      <Trans>A reviewer asked for changes</Trans>
                    </Match>
                    <Match when={status() === "Rejected"}>
                      <Trans>A reviewer rejected this design</Trans>
                    </Match>
                    <Match when={true}>
                      <Trans>A reviewer took this design down</Trans>
                    </Match>
                  </Switch>
                }
              >
                {reviewNote(props.item) ?? <Trans>No note was left.</Trans>}
              </Callout>
            </Match>
            <Match when={status() === "PendingReview"}>
              <Callout
                tone="info"
                title={<Trans>Waiting for a reviewer</Trans>}
              >
                <Show
                  when={props.item.status === "Published"}
                  fallback={
                    <Trans>
                      It goes live when a reviewer approves it. Editing it takes
                      it out of the queue until you send it again.
                    </Trans>
                  }
                >
                  <Trans>
                    The live version stays up until a reviewer approves the new
                    one.
                  </Trans>
                </Show>
              </Callout>
            </Match>
            <Match when={status() === "Archived" && withdrawnBy() === "staff"}>
              <Callout
                tone="error"
                testid="studio-staff-withdrew"
                title={<Trans>Zrzur staff withdrew this design</Trans>}
              >
                <Show when={staffReason()}>
                  {/* its own line and its own direction: a reason may be in
                      another language than the app */}
                  <StaffReason dir="auto">{staffReason()}</StaffReason>
                </Show>
                <Trans>
                  Nobody sees or wears it, and you can't take it back yourself.
                  The reason and how to appeal are in your settings, under
                  Reports &amp; standing.
                </Trans>
              </Callout>
            </Match>
            <Match when={status() === "Archived" && withdrawnBy() === "you"}>
              <Callout
                tone="info"
                title={<Trans>You withdrew this design</Trans>}
              >
                <Trans>
                  Nobody sees or wears it. We keep the file with your account so
                  you can take it back as a draft and publish it again, until
                  you delete it.
                </Trans>
              </Callout>
            </Match>
            <Match
              when={props.item.status === "Published" && props.item.pending}
            >
              <Callout
                tone="info"
                title={<Trans>A new version is saved as a draft</Trans>}
              >
                <Trans>
                  People still see version {number(props.item.revision)}.
                  Publish the new one when it is ready.
                </Trans>
              </Callout>
            </Match>
          </Switch>

          <Panel>
            <h2>
              <Trans>History</Trans>
            </h2>
            <Switch>
              <Match when={details.loading}>
                <p>
                  <Trans>Loading…</Trans>
                </p>
              </Match>
              <Match when={!history().length}>
                <p data-testid="studio-history-empty">
                  <Trans>
                    Nothing yet. Saving a draft is not recorded; sending,
                    publishing and reviewers' decisions are.
                  </Trans>
                </p>
              </Match>
              <Match when={true}>
                <Timeline data-testid="studio-history">
                  <For each={history()}>
                    {(entry) => (
                      <li data-action={entry.action}>
                        <strong>{words.action(entry.action)}</strong>
                        <time>
                          {when(entry.created_at)}
                          {" · "}
                          <Trans>Version {number(entry.revision)}</Trans>
                        </time>
                        <Show when={entry.reason}>
                          <q dir="auto">{entry.reason}</q>
                        </Show>
                      </li>
                    )}
                  </For>
                </Timeline>
              </Match>
            </Switch>
          </Panel>
        </Main>

        <Side>
          <Thumb
            item={props.item}
            private={props.perms.creator === "Suspended"}
            avatar={props.avatar}
            name={props.name}
            large
          />

          <Panel>
            <h2>
              <Trans>Numbers</Trans>
            </h2>
            <SpecList>
              <div>
                <dt>
                  <Trans>Worn by</Trans>
                </dt>
                <dd>
                  {props.item.status === "Published"
                    ? number(props.item.popularity ?? 0)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>
                  <Trans>First published</Trans>
                </dt>
                <dd>
                  {props.item.published_at
                    ? when(props.item.published_at)
                    : "—"}
                </dd>
              </div>
              <Show when={(props.item.reports ?? 0) > 0}>
                <div>
                  <dt>
                    <Trans>Reports</Trans>
                  </dt>
                  <dd>{number(props.item.reports ?? 0)}</dd>
                </div>
              </Show>
            </SpecList>
          </Panel>

          <Panel data-testid="studio-rights-kept">
            <h2>
              <Trans>What you declared</Trans>
            </h2>
            <Show
              when={props.item.rights}
              fallback={
                <p>
                  <Trans>
                    Nothing yet. You are asked before this version is published.
                  </Trans>
                </p>
              }
            >
              {(rights) => (
                <SpecList>
                  <div>
                    <dt>
                      <Trans>Parts made by others</Trans>
                    </dt>
                    <dd dir="auto">
                      {rights().third_party ?? <Trans>None</Trans>}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Trans>Parts made with AI tools</Trans>
                    </dt>
                    <dd dir="auto">
                      {rights().ai_parts ?? <Trans>None</Trans>}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Trans>Creator Terms</Trans>
                    </dt>
                    <dd dir="ltr">{rights().terms_version}</dd>
                  </div>
                  <div>
                    <dt>
                      <Trans>Confirmed on</Trans>
                    </dt>
                    <dd>{when(rights().confirmed_at)}</dd>
                  </div>
                </SpecList>
              )}
            </Show>
          </Panel>

          <Show when={props.item.description || props.item.tags?.length}>
            <Panel>
              <h2>
                <Trans>Details</Trans>
              </h2>
              <Show
                when={props.item.pending?.description ?? props.item.description}
              >
                <p dir="auto">
                  {props.item.pending?.description ?? props.item.description}
                </p>
              </Show>
              <Show
                when={(props.item.pending?.tags ?? props.item.tags)?.length}
              >
                <Tags>
                  <For each={props.item.pending?.tags ?? props.item.tags}>
                    {(tag) => <bdi>{tag}</bdi>}
                  </For>
                </Tags>
              </Show>
            </Panel>
          </Show>
        </Side>
      </Columns>

      <Dialog
        show={asking() === "withdraw"}
        onClose={() => setAsking(undefined)}
        title={<Trans>Withdraw this design?</Trans>}
        actions={[
          { text: <Trans>Cancel</Trans> },
          {
            text: <Trans>Withdraw</Trans>,
            onClick: () => {
              void run(
                () => communityApi.archive(client(), props.item._id),
                changed,
              );
              return false;
            },
          },
        ]}
        isDisabled={busy()}
      >
        <Trans>
          It leaves Designs and everyone wearing it at once. We keep the file
          with your account, so you can take it back as a draft later.
        </Trans>
        <Show when={error()}>
          <DialogError role="alert">{error()}</DialogError>
        </Show>
      </Dialog>

      <Dialog
        show={asking() === "delete"}
        onClose={() => setAsking(undefined)}
        title={<Trans>Delete this design for good?</Trans>}
        actions={[
          { text: <Trans>Cancel</Trans> },
          {
            text: <Trans>Delete</Trans>,
            onClick: () => {
              const id = props.item._id;
              void run(
                () => communityApi.remove(client(), id),
                () => props.onChanged(undefined, id),
              );
              return false;
            },
          },
        ]}
        isDisabled={busy()}
      >
        <Trans>
          The design and its image are deleted. This can't be undone; download
          your copy first if you want to keep it.
        </Trans>
        <Show when={error()}>
          <DialogError role="alert">{error()}</DialogError>
        </Show>
      </Dialog>
    </Page>
  );
}

const Meta = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 12px",
    marginBlockStart: "4px",
    fontSize: "14px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
  },
});

const Columns = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    gap: "24px",
    alignItems: "start",
    "@container (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Main = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});

const Side = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});

const Timeline = styled("ol", {
  base: {
    display: "flex",
    flexDirection: "column",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      paddingInlineStart: "28px",
      paddingBlockEnd: "20px",
      fontSize: "14px",
      lineHeight: "22px",
      "--dot": "var(--z-fg-muted)",
    },
    "& li:last-child": { paddingBlockEnd: 0 },
    "& li::before": {
      content: '""',
      position: "absolute",
      insetInlineStart: "3px",
      top: "6px",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      background: "var(--dot)",
    },
    "& li::after": {
      content: '""',
      position: "absolute",
      insetInlineStart: "7px",
      top: "22px",
      bottom: "2px",
      width: "2px",
      background: "var(--z-border-subtle)",
    },
    "& li:last-child::after": { display: "none" },
    "& li[data-action='Publish'], & li[data-action='Approve']": {
      "--dot": "var(--z-status-success)",
    },
    "& li[data-action='Submit']": { "--dot": "var(--z-link)" },
    "& li[data-action='RequestChanges']": {
      "--dot": "var(--z-status-warning)",
    },
    "& li[data-action='Reject'], & li[data-action='Suspend']": {
      "--dot": "var(--z-danger)",
    },
    "& strong": { fontWeight: 600 },
    "& time": {
      fontSize: "12px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
    "& q": {
      quotes: "none",
      marginBlockStart: "4px",
      padding: "8px 12px",
      borderRadius: "var(--z-radius, 10px)",
      background: "var(--z-bg-raised)",
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
  },
});

const Tags = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    "& bdi": {
      paddingInline: "10px",
      borderRadius: "var(--z-radius-pill, 999px)",
      background: "var(--z-bg-raised)",
      fontSize: "13px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const StaffReason = styled("q", {
  base: {
    display: "block",
    quotes: "none",
    marginBlockEnd: "4px",
    fontWeight: 500,
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const DialogError = styled("p", {
  base: {
    margin: "12px 0 0",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-danger)",
  },
});
