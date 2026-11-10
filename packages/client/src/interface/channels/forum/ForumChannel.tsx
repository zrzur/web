import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { validTagEmoji } from "@revolt/app/interface/settings/channel/tagEmoji";
import { useClient } from "@revolt/client";
import { useTime } from "@revolt/i18n";
import { Emoji } from "@revolt/markdown/emoji";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { Button, Header } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { startAccess } from "@revolt/app/interface/channels/threadAccess";
import { Tag } from "@revolt/modal/modals/ForumTag";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";

import { activity, forumPosts } from "./posts";

/**
 * A forum: posts (threads with a title and tags), the most recently active
 * first. One primary action, New post; tags filter the list.
 */
export function ForumChannel(props: ChannelPageProps) {
  const { t } = useLingui();
  const client = useClient();
  const dayjs = useTime();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const [archived, setArchived] = createSignal(false);
  const [tag, setTag] = createSignal<string>();

  const [loaded, { refetch }] = createResource(
    () => [props.channel.id, archived()] as const,
    ([, archived]) => props.channel.fetchThreads({ archived, limit: 100 }),
  );

  const posts = () =>
    forumPosts(client().channels.toList(), props.channel.id, {
      archived: archived(),
      tag: tag(),
    });

  const tagName = (id: string) =>
    props.channel.forum?.tags.find((entry) => entry.id === id);

  const newPost = () =>
    openModal({ type: "create_thread", channel: props.channel });

  return (
    <>
      <Header placement="primary">
        <ChannelHeader channel={props.channel} />
      </Header>
      <Page>
        <Toolbar>
          <Show when={startAccess(props.channel) === "allowed"}>
            <Button onPress={newPost}>
              <Icon name="plus" size={16} />
              <Trans>New post</Trans>
            </Button>
          </Show>
          <Filters role="toolbar" aria-label={t`Filter posts`}>
            <Tag type="button" aria-pressed={!tag()} onClick={() => setTag()}>
              <Trans>All</Trans>
            </Tag>
            <For each={props.channel.forum?.tags ?? []}>
              {(entry) => (
                <Tag
                  type="button"
                  aria-pressed={tag() === entry.id}
                  onClick={() =>
                    setTag(tag() === entry.id ? undefined : entry.id)
                  }
                >
                  <Show when={validTagEmoji(entry.emoji)}>
                    {(emoji) => <Emoji emoji={emoji()} />}
                  </Show>
                  {entry.name}
                </Tag>
              )}
            </For>
            <Tag
              type="button"
              aria-pressed={archived()}
              onClick={() => setArchived(!archived())}
            >
              <Icon name="archive" size={14} />
              <Trans>Archived</Trans>
            </Tag>
          </Filters>
        </Toolbar>

        <Switch>
          <Match when={startAccess(props.channel) === "switched-off"}>
            <Reason role="note">
              <Trans>
                Forums are off in this server. You can still read the posts.
              </Trans>
            </Reason>
          </Match>
          <Match when={startAccess(props.channel) === "no-permission"}>
            <Reason role="note">
              <Trans>You can't start posts in this forum.</Trans>
            </Reason>
          </Match>
        </Switch>

        <Switch>
          <Match when={loaded.loading && !posts().length}>
            <Empty>
              <Trans>Loading…</Trans>
            </Empty>
          </Match>
          <Match when={loaded.error}>
            <Empty>
              <Trans>Posts couldn't be loaded.</Trans>
              <Button variant="text" onPress={() => void refetch()}>
                <Trans>Try again</Trans>
              </Button>
            </Empty>
          </Match>
          <Match when={!posts().length}>
            <Empty>
              <Icon name="note-pencil" size={32} />
              <Show
                when={!archived() && !tag()}
                fallback={<Trans>Nothing matches this filter.</Trans>}
              >
                <Show
                  when={startAccess(props.channel) === "allowed"}
                  fallback={<Trans>No posts yet.</Trans>}
                >
                  <Trans>No posts yet. Start the first one.</Trans>
                </Show>
              </Show>
            </Empty>
          </Match>
          <Match when={posts().length}>
            <List>
              <For each={posts()}>
                {(post) => (
                  <Post
                    type="button"
                    onClick={() =>
                      navigate(`/server/${post.serverId}/channel/${post.id}`)
                    }
                  >
                    <PostTitle>
                      <Show when={post.thread?.locked}>
                        <Icon name="lock-simple" size={14} />
                      </Show>
                      {post.name}
                    </PostTitle>
                    <PostMeta>
                      <For each={post.thread?.tags ?? []}>
                        {(id) => (
                          <Show when={tagName(id)}>
                            {(entry) => (
                              <TagLabel>
                                <Show when={validTagEmoji(entry().emoji)}>
                                  {(emoji) => (
                                    <>
                                      <Emoji emoji={emoji()} />{" "}
                                    </>
                                  )}
                                </Show>
                                {entry().name}
                              </TagLabel>
                            )}
                          </Show>
                        )}
                      </For>
                      <span>
                        {t`${plural(post.thread?.messageCount ?? 0, {
                          one: "# message",
                          other: "# messages",
                        })}`}
                      </span>
                      <span>· {dayjs(activity(post)).fromNow()}</span>
                    </PostMeta>
                  </Post>
                )}
              </For>
            </List>
          </Match>
        </Switch>
      </Page>
    </>
  );
}

const Page = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    background: "var(--z-bg-chat, var(--z-bg-app))",
  },
});

/** Why the forum offers no New post */
const Reason = styled("p", {
  base: {
    margin: 0,
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
  },
});

const Toolbar = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
  },
});

const Filters = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "48px 16px",
    textAlign: "center",
    color: "var(--z-fg-secondary)",
  },
});

const List = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const Post = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    padding: "12px 16px",
    borderRadius: "var(--z-radius-lg)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    textAlign: "start",
    cursor: "pointer",
    _hover: { background: "var(--z-slate-1, var(--z-bg-raised))" },
    _focusVisible: {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
  },
});

const PostTitle = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 600,
    fontSize: "16px",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const PostMeta = styled("span", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
  },
});

const TagLabel = styled("span", {
  base: {
    padding: "2px 8px",
    borderRadius: "var(--z-radius-pill)",
    background: "var(--z-accent-muted)",
    color: "var(--z-fg-primary)",
  },
});
