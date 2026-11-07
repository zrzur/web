import { For, Show, Suspense, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { API, Channel } from "@zrzur/sdk/solid";

import { Message } from "@revolt/app";
import { CircularProgress, Segmented } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";

/**
 * Message search sidebar
 */
export function TextSearchSidebar(props: {
  channel: Channel;
  query: Omit<API.DataMessageSearch, "include_users">;
}) {
  const { t } = useLingui();
  const [sort, setSort] = createSignal<API.DataMessageSearch["sort"]>("Latest");

  // nothing typed yet (the phone search screen opens empty): wait for words
  const ready = () => !!props.query.query?.trim() || !!props.query.pinned;

  const query = useQuery(() => ({
    enabled: ready(),
    queryKey: ["search", props.channel.id, props.query, sort()],
    queryFn: () =>
      props.channel
        .searchWithUsers(
          props.query.sort
            ? props.query
            : {
                ...props.query,
                sort: sort(),
              },
        )
        .then((result) => result.messages),
  }));

  return (
    <>
      <Show when={!props.query.sort}>
        <SortRow>
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
        </SortRow>
      </Show>
      <Show when={!ready()}>
        <Empty role="status">
          <Icon name="magnifying-glass" size={22} />
          <span>
            <Trans>Type to search messages in this channel.</Trans>
          </span>
        </Empty>
      </Show>
      <Suspense fallback={<CircularProgress />}>
        <For each={query.data}>
          {(message) => (
            <a href={message.path}>
              <Message message={message} isLink />
            </a>
          )}
        </For>
        {/* say so when there is nothing, instead of an empty panel */}
        <Show when={query.isError}>
          <Empty role="status">
            <Icon name="warning-circle" size={22} />
            <span>
              <Trans>Search isn't available right now. Try again soon.</Trans>
            </span>
          </Empty>
        </Show>
        <Show when={query.isSuccess && !query.data?.length}>
          <Empty role="status">
            <Show
              when={props.query.pinned}
              fallback={
                <>
                  <Icon name="magnifying-glass" size={22} />
                  <span>
                    <Trans>No messages match your search.</Trans>
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
      </Suspense>
    </>
  );
}

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    paddingBlock: "40px",
    paddingInline: "16px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});

const SortRow = styled("div", {
  base: { display: "flex", justifyContent: "center", paddingBlock: "4px 8px" },
});
