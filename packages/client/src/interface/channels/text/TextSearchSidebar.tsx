import { For, Show, Suspense, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { API, Channel, Message as MessageClass } from "@zrzur/sdk/solid";

import { Message } from "@revolt/app";
import { useClient } from "@revolt/client";
import { errorDetails } from "@revolt/i18n/errors";
import { CircularProgress, Segmented } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";

import { searchChannels, searchPeople } from "./SearchBox";
import { useSearchLabels } from "./searchLabels";
import {
  type HasValue,
  type SearchResolver,
  parseSearch,
  toSearchRequest,
} from "./searchSyntax";

type Scope = "channel" | "server";

/**
 * Message search sidebar: words and filters typed in the search box
 * (`from:`, `mentions:`, `has:`, `before:`, `after:`, `during:`, `in:`,
 * `pinned:`), in this channel or the whole server, results grouped by
 * channel. Also lists the pinned messages (`query.pinned`).
 */
export function TextSearchSidebar(props: {
  channel: Channel;
  query: Omit<API.DataMessageSearch, "include_users">;
}) {
  const { t } = useLingui();
  const client = useClient();
  const labels = useSearchLabels();
  const [sort, setSort] = createSignal<API.DataMessageSearch["sort"]>("Latest");
  const [scope, setScope] = createSignal<Scope>("channel");

  // the pins list sends its own query; typed text goes through the syntax
  const pinsList = () =>
    !!props.query.pinned && props.query.query === undefined;
  const parsed = createMemo(() => parseSearch(props.query.query ?? ""));

  const resolver: SearchResolver = {
    user(name) {
      const wanted = name.toLowerCase();
      const people = searchPeople(props.channel, client());
      return (
        people.find((p) => p.username?.toLowerCase() === wanted) ??
        people.find((p) => p.name.toLowerCase() === wanted)
      )?.id;
    },
    channel(name) {
      const wanted = name.toLowerCase();
      return searchChannels(props.channel).find(
        (c) => c.name.toLowerCase() === wanted,
      )?.id;
    },
    get inServer() {
      return !!props.channel.server;
    },
  };

  const request = createMemo(() => toSearchRequest(parsed(), resolver));

  // names this device has not loaded yet: ask the server before saying
  // there is nobody of that name (the answer fills the member cache)
  const unknownNames = createMemo(() =>
    request()
      .problems.filter((p) => p.reason === "unknown-user")
      .map((p) => p.value),
  );
  const lookup = useQuery(() => ({
    enabled: !!props.channel.server && unknownNames().length > 0,
    queryKey: ["search-members", props.channel.serverId, unknownNames()],
    queryFn: async () => {
      for (const name of unknownNames())
        await props.channel
          .server!.queryMembersExperimental(name)
          .catch(() => undefined);
      return true;
    },
    staleTime: 60_000,
  }));
  const lookingUp = () => lookup.isFetching;

  /** Problems to show: unknown names only once the server was asked */
  const problems = () =>
    request().problems.filter(
      (p) => !(p.reason === "unknown-user" && lookingUp()),
    );

  const effectiveScope = (): Scope =>
    props.channel.server && (request().serverWide || scope() === "server")
      ? "server"
      : "channel";

  const ready = () =>
    pinsList() ||
    (!request().empty && request().problems.length === 0 && !lookingUp());

  const rateLimited = () =>
    (query.error as { status?: number } | null)?.status === 429;

  const query = useQuery(() => ({
    enabled: ready(),
    queryKey: [
      "search",
      props.channel.id,
      effectiveScope(),
      pinsList() ? props.query : request().params,
      sort(),
    ],
    queryFn: async () => {
      if (pinsList()) {
        return (await props.channel.searchWithUsers(props.query)).messages;
      }
      const params = { ...request().params, sort: sort() };
      if (effectiveScope() === "server") {
        return (await props.channel.server!.searchMessagesWithUsers(params))
          .messages;
      }
      return (await props.channel.searchWithUsers(params)).messages;
    },
  }));

  /** Results in channel groups, first seen first (keeps the sort order) */
  const groups = createMemo(() => {
    const byChannel = new Map<string, MessageClass[]>();
    for (const message of query.data ?? []) {
      const list = byChannel.get(message.channelId) ?? [];
      list.push(message);
      byChannel.set(message.channelId, list);
    }
    return [...byChannel.entries()].map(([id, messages]) => ({
      channel: client().channels.get(id),
      messages,
    }));
  });

  /** Chip text for a filter: localised key, readable value */
  const chip = (key: string, value: string) => {
    const token = parsed().tokens.find(
      (t) => t.key === key && t.value === value,
    )!;
    let shown = value;
    if (token.key === "has")
      shown = labels.has(value.toLowerCase() as HasValue) ?? value;
    if (token.key === "pinned")
      shown = ["true", "yes", "1"].includes(value.toLowerCase())
        ? labels.yes
        : labels.no;
    if (token.key === "in") shown = `#${value}`;
    return `${labels.key(token.key)}: ${shown}`;
  };

  return (
    <Body>
      <Show when={!pinsList()}>
        <Show when={props.channel.server}>
          <Row>
            <Segmented
              aria-label={t`Where to search`}
              value={effectiveScope()}
              onChange={(value) => setScope(value)}
              options={[
                { value: "channel", label: <Trans>This channel</Trans> },
                { value: "server", label: <Trans>Whole server</Trans> },
              ]}
            />
          </Row>
        </Show>
        <Show when={parsed().tokens.some((t) => t.value)}>
          <Chips aria-label={t`Filters`}>
            <For each={parsed().tokens.filter((t) => t.value)}>
              {(token) => <Chip>{chip(token.key, token.value)}</Chip>}
            </For>
          </Chips>
        </Show>
      </Show>

      <Show when={!props.query.sort}>
        <Row>
          <Segmented
            aria-label={t`Sort results`}
            value={sort() ?? "Latest"}
            onChange={setSort}
            options={[
              { value: "Relevance", label: <Trans>Relevance</Trans> },
              { value: "Latest", label: <Trans>Latest</Trans> },
              { value: "Oldest", label: <Trans>Oldest</Trans> },
            ]}
          />
        </Row>
      </Show>

      <Show when={!pinsList() && problems().length}>
        <Empty role="alert">
          <Icon name="warning-circle" size={22} />
          <For each={problems()}>
            {(problem) => <span>{labels.problem(problem)}</span>}
          </For>
        </Empty>
      </Show>

      <Show when={!pinsList() && request().truncated}>
        <Note role="status">
          <Trans>Only the first 64 characters are searched.</Trans>
        </Note>
      </Show>

      <Show when={!pinsList() && lookingUp()}>
        <CircularProgress />
      </Show>

      <Show when={!pinsList() && request().empty && !problems().length}>
        <Empty role="status">
          <Icon name="magnifying-glass" size={22} />
          <span>
            <Trans>
              Type words to search, or a filter like from:, has: or before:.
            </Trans>
          </span>
          <Help>
            <li>
              <code>from:name</code> <span>{labels.hint("from")}</span>
            </li>
            <li>
              <code>has:image</code> <span>{labels.hint("has")}</span>
            </li>
            <li>
              <code>during:2026-11-09</code>{" "}
              <span>{labels.hint("during")}</span>
            </li>
            <Show when={props.channel.server}>
              <li>
                <code>in:general</code> <span>{labels.hint("in")}</span>
              </li>
            </Show>
          </Help>
        </Empty>
      </Show>

      <Suspense fallback={<CircularProgress />}>
        <Show when={ready()}>
          <For each={groups()}>
            {(group) => (
              <section>
                <Show when={effectiveScope() === "server" && !pinsList()}>
                  <GroupTitle>
                    <Icon name="hash" size={14} />
                    <span>{group.channel?.name ?? t`Unknown channel`}</span>
                  </GroupTitle>
                </Show>
                <For each={group.messages}>
                  {(message) => (
                    <a href={message.path} aria-label={t`Jump to message`}>
                      <Message message={message} isLink />
                    </a>
                  )}
                </For>
              </section>
            )}
          </For>
          {/* say so when there is nothing, instead of an empty panel */}
          <Show when={query.isError}>
            <Empty role="alert">
              <Icon name="warning-circle" size={22} />
              <span>
                <Show
                  when={rateLimited()}
                  fallback={
                    <Trans>
                      Search isn't available right now. Try again soon.
                    </Trans>
                  }
                >
                  <Trans>
                    Too many searches. Wait a moment, then try again.
                  </Trans>
                </Show>
              </span>
              <Show when={errorDetails(query.error)}>
                <details class="z-error-details">
                  <summary>
                    <Trans>Details</Trans>
                  </summary>
                  <code>{errorDetails(query.error)}</code>
                </details>
              </Show>
            </Empty>
          </Show>
          <Show when={query.isSuccess && !query.data?.length}>
            <Empty role="status">
              <Show
                when={pinsList()}
                fallback={
                  <>
                    <Icon name="magnifying-glass" size={22} />
                    <span>
                      <Show
                        when={effectiveScope() === "server"}
                        fallback={
                          <Trans>
                            No messages in this channel match your search.
                          </Trans>
                        }
                      >
                        <Trans>
                          No messages in this server match your search.
                        </Trans>
                      </Show>
                    </span>
                  </>
                }
              >
                <Icon name="push-pin" size={22} />
                <span>
                  <Trans>No pinned messages in this channel yet.</Trans>
                </span>
              </Show>
            </Empty>
          </Show>
        </Show>
      </Suspense>
    </Body>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingBlockEnd: "12px",
    "& > section > a, & > section": { display: "block" },
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingBlock: "40px",
    paddingInline: "16px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    paddingInline: "12px",
    fontSize: "12px",
    textAlign: "center",
    color: "var(--z-fg-muted)",
  },
});

const Help = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    marginBlockStart: "8px",
    padding: 0,
    listStyle: "none",
    textAlign: "start",
    fontSize: "13px",
    "& li": { display: "flex", flexDirection: "column", gap: "2px" },
    "& code": {
      alignSelf: "flex-start",
      direction: "ltr",
      paddingInline: "8px",
      paddingBlock: "4px",
      borderRadius: "var(--z-radius-xs)",
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-primary)",
      fontFamily: "var(--fonts-monospace, monospace)",
    },
  },
});

const Row = styled("div", {
  base: {
    display: "flex",
    // on the same start edge as the title above and the results below
    justifyContent: "flex-start",
    paddingBlock: "4px",
    paddingInline: "12px",
  },
});

const Chips = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    paddingInline: "12px",
  },
});

const Chip = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "24px",
    paddingInline: "12px",
    paddingBlock: "4px",
    borderRadius: "var(--z-radius-pill)",
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    fontSize: "12px",
  },
});

const GroupTitle = styled("h3", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    margin: 0,
    paddingInline: "12px",
    paddingBlock: "8px 4px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
  },
});
