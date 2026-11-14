import {
  Accessor,
  For,
  JSX,
  Match,
  Show,
  Signal,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { Channel, Message as MessageInterface } from "@zrzur/sdk/solid";
import isEqual from "fast-deep-equal/es6";
import { styled } from "styled-system/jsx";

import { useClient, useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { useTime } from "@revolt/i18n";
import { useState } from "@revolt/state";

import {
  BlockedMessage,
  Button,
  ConversationStart,
  Deferred,
  JumpToBottom,
  MessageDivider,
} from "@revolt/ui";
import { useMotion } from "@revolt/ui/motion";

import { CompositionInfo } from "./CompositionInfo";
import { editableByMe } from "./editable";
import {
  type History,
  type HistorySource,
  type HistoryState,
  createHistory,
} from "./history/controller";
import {
  type HistoryScrollerApi,
  type ReaderPosition,
  HistoryScroller,
} from "./history/HistoryScroller";
import { type PageSide, jumpBar } from "./history/reader";
import { emptyWindow } from "./history/window";
import { Message } from "./Message";
import { useMessageCache } from "./MessageCache";

interface Props {
  /**
   * Channel to fetch messages from
   */
  channel: Channel;

  /**
   * Pending messages to render at the end of the list
   */
  pendingMessages?: (props: { tail: boolean; ids: string[] }) => JSX.Element;

  /**
   * Highlighted message id
   */
  highlightedMessageId: Accessor<string | undefined>;

  /**
   * Last read message id
   */
  lastReadId: Accessor<string | undefined>;

  /**
   * Clear the highlighted message
   */
  clearHighlightedMessage: () => void;

  /**
   * Bind the "go to the newest message" function to the parent component
   * @param fn Function
   */
  jumpToBottomRef?: (fn: () => void) => void;

  /**
   * Whether the reader sees the newest message: the newest messages are
   * loaded and the list is scrolled to its bottom. Only then is the channel
   * read.
   */
  atPresent?: Signal<boolean>;
}

/**
 * The server's ways to read a channel's messages
 */
function sourceOf(channel: Channel): HistorySource<MessageInterface> {
  const page = (
    params: Parameters<Channel["fetchMessagesWithUsers"]>[0],
  ): Promise<MessageInterface[]> =>
    channel.fetchMessagesWithUsers(params).then((result) => result.messages);

  return {
    latest: (limit) => page({ limit }),
    before: (id, limit) => page({ limit, before: id }),
    after: (id, limit) => page({ limit, after: id, sort: "Oldest" }),
    nearby: (id, limit) => page({ limit, nearby: id }),
  };
}

/**
 * Render messages in a Channel
 *
 * What is loaded, what is being loaded and where the reader is are owned by
 * the history controller (./history); this component draws that state.
 */
export function Messages(props: Props) {
  const cache = useMessageCache();
  const lifecycle = useClientLifecycle();
  const client = useClient();
  const state = useState();
  const dayjs = useTime();
  const motion = useMotion();

  /**
   * The history of the open channel, as its controller reports it
   */
  const [history, setHistory] = createSignal<HistoryState<MessageInterface>>({
    window: emptyWindow(),
    pending: undefined,
    failed: undefined,
    unseen: 0,
  });

  /**
   * Loaded messages, newest first
   */
  const messages = createMemo(() => history().window.items);
  const atStart = () => history().window.atStart;
  const atEnd = () => history().window.atEnd;

  /**
   * Whether the reader sees the newest message
   */
  // eslint-disable-next-line solid/reactivity
  const [, setAtPresent] = props.atPresent ?? createSignal(true);

  /**
   * Where the reader is in the list
   */
  const [reader, setReader] = createSignal<ReaderPosition>({
    below: 0,
    viewport: 0,
    atPresent: true,
    newestVisible: true,
  });

  /**
   * The controller of the open channel
   */
  let controller: History<MessageInterface> | undefined;

  /**
   * The scroller, once it is drawn
   */
  let scroller: HistoryScrollerApi | undefined;

  /**
   * Reference for the list container (its children are the rows)
   */
  const [listRef, setListRef] = createSignal<HTMLDivElement>();

  const messageElement = (id: string) =>
    listRef()?.querySelector(`#${CSS.escape(id)}`);

  /**
   * Fewer animations: the system setting, or motion switched off in the app
   */
  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    motion.duration("messages", "enter") === 0;

  /**
   * The reader moved
   */
  function onReader(position: ReaderPosition) {
    setReader(position);
    setAtPresent(position.atPresent);
    if (position.atPresent) controller?.seen();
  }

  /**
   * Load the channel's history whenever the channel changes
   * NB. the component does not remount on channel switch
   */
  createEffect(
    on(
      () => props.channel,
      (channel) => {
        const current = createHistory<MessageInterface>({
          source: sourceOf(channel),
          view: {
            atPresent: () => scroller?.atPresent() ?? true,
            commit: (change, move) =>
              scroller ? scroller.commit(change, move) : change(),
            nextFrame: () => scroller?.nextFrame() ?? Promise.resolve(),
            settled: (maxWaitMs) =>
              scroller?.settled(maxWaitMs) ?? Promise.resolve(),
            ready: (side) => scroller?.ready(side) ?? Promise.resolve(),
            rowLimit: () => scroller?.rowLimit() ?? 150,
          },
          isOwn: (message) => message.authorId === client().user?.id,
          onChange: setHistory,
        });
        controller = current;
        setAtPresent(true);

        const around = props.highlightedMessageId();
        const restore = cache!.unmanage(channel);
        current.open(around ? { around } : restore ? { restore } : {});

        // while this list shows the channel its messages stay in memory
        cache!.opened(channel);

        // put the window aside when navigating away
        onCleanup(() => {
          cache!.closed(channel);
          const { window, pending } = current.state();
          if (window.items.length && pending !== "initial") {
            cache!.manage(channel, { window, mark: scroller?.capture() });
          }
          current.dispose();
          if (controller === current) controller = undefined;
        });
      },
    ),
  );

  /**
   * Jump to the highlighted message when it changes
   * (a channel opened on a message loads around it, above)
   */
  createEffect(
    on(
      () => props.highlightedMessageId(),
      (messageId) => {
        if (messageId) controller?.toMessage(messageId);
      },
      { defer: true },
    ),
  );

  /**
   * A link to the message that is already highlighted does not change the
   * address, so nothing above runs: jump again here
   */
  function onLinkClick(event: MouseEvent) {
    const messageId = props.highlightedMessageId();
    // (the router has already claimed the click: defaultPrevented says nothing here)
    if (
      !messageId ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    const link = (event.target as Element | null)?.closest?.("a[href]");
    if (!link) return;

    const target = new URL((link as HTMLAnchorElement).href, location.href);
    if (
      target.origin === location.origin &&
      target.pathname === location.pathname
    ) {
      controller?.toMessage(messageId);
    }
  }

  /**
   * Handle incoming messages
   * @param message Message object
   */
  function onMessage(message: MessageInterface) {
    if (message.channelId !== props.channel.id) return;

    const shown = atEnd();
    controller?.received(message);

    // your own messages were already shown while sending
    if (shown && message.authorId !== client().user?.id) {
      queueMicrotask(() =>
        motion.play(messageElement(message.id), "messages", "enter"),
      );
    }
  }

  /**
   * Handle deleted messages
   */
  function onMessageDelete(message: { id: string; channelId: string }) {
    if (
      message.channelId === props.channel.id &&
      messages().find((msg) => msg.id === message.id)
    ) {
      const current = controller;
      // fade the message out and close the gap, then drop it
      motion
        .play(messageElement(message.id), "messages", "exit", {
          collapse: true,
        })
        .then(() => current?.removed([message.id]));
    }
  }

  /**
   * Handle bulk-deleted messages
   */
  function onMessageDeleteBulk(
    deleted_messages: { id: string; channelId: string }[],
    channel?: { id: string },
  ) {
    if (channel?.id === props.channel.id) {
      controller?.removed(deleted_messages.map((message) => message.id));
    }
  }

  onMount(() => {
    // Setup references if they exist
    props.jumpToBottomRef?.(jumpToBottom);

    const c = client();
    c.addListener("messageCreate", onMessage);
    c.addListener("messageDelete", onMessageDelete);
    c.addListener("messageDeleteBulk", onMessageDeleteBulk);
    document.addEventListener("click", onLinkClick);
  });

  onCleanup(() => {
    const c = client();
    c.removeListener("messageCreate", onMessage);
    c.removeListener("messageDeleteBulk", onMessageDeleteBulk);
    c.removeListener("messageDelete", onMessageDelete);
    document.removeEventListener("click", onLinkClick);
  });

  // Messages may have been missed while the connection was away
  createEffect(
    on(
      () => lifecycle.lifecycle.state(),
      (state) => {
        if (state === State.Connected) controller?.reconnected();
      },
      { defer: true },
    ),
  );

  // We need to cache created objects to prevent needless re-rendering
  const objectCache = new Map();

  // Determine which messages have a tail and add message dividers
  const messagesWithTail = createMemo<ListEntry[]>(() => {
    const messagesWithTail: ListEntry[] = [];
    const lastReadId = props.lastReadId() ?? "0";

    let blockedMessages = 0;
    let insertedUnreadDivider = false;

    /**
     * Create blocked message divider
     */
    const createBlockedMessageCount = () => {
      if (blockedMessages) {
        messagesWithTail.push({
          t: 2,
          count: blockedMessages,
        });

        blockedMessages = 0;
      }
    };

    const arr = messages();
    arr.forEach((message, index) => {
      const next = arr[index + 1];
      let tail = true;

      // If there is a next message, compare it to the current message
      let date = null;
      if (next) {
        // Compare dates between messages
        const adate = message.createdAt,
          bdate = next.createdAt,
          atime = +adate,
          btime = +bdate;

        if (
          adate.getFullYear() !== bdate.getFullYear() ||
          adate.getMonth() !== bdate.getMonth() ||
          adate.getDate() !== bdate.getDate()
        ) {
          date = adate;
        }

        // Compare time and properties of messages
        if (
          // split up different authors
          message.authorId !== next.authorId ||
          // split up chains which are too far apart
          Math.abs(btime - atime) >= 420000 ||
          // treat masquerade as a change in author
          !isEqual(message.masquerade, next.masquerade) ||
          // ensure all system messages render independently
          message.systemMessage ||
          next.systemMessage ||
          // replies present on current message
          message.replyIds?.length ||
          // bot answers start with their own "used /command" line
          message.interaction ||
          // every official message shows who sent it
          message.author?.official ||
          // next message in history has already been read
          // so there will be a message divider present
          (next.id.localeCompare(lastReadId) === -1 && !insertedUnreadDivider)
        ) {
          tail = false;
        }
      } else {
        tail = false;
      }

      // Try to add the unread divider
      if (
        !insertedUnreadDivider &&
        message.id.localeCompare(lastReadId) === -1
      ) {
        insertedUnreadDivider = true;

        messagesWithTail.push(
          objectCache.get(true) ?? {
            t: 1,
            unread: true,
          },
        );
      }

      if (message.author?.relationship === "Blocked") {
        blockedMessages++;
      } else {
        // Push any blocked messages if they haven't been yet
        createBlockedMessageCount();

        // Add message to list, retrieve if it exists in the cache
        messagesWithTail.push(
          objectCache.get(`${message.id}:${tail}`) ?? {
            t: 0,
            message,
            tail,
          },
        );
      }

      // Add date to list, retrieve if it exists in the cache
      if (date) {
        messagesWithTail.push(
          objectCache.get(date) ?? {
            t: 1,
            date: dayjs(date).format("LL"),
          },
        );
      }
    });

    // Push remainder of blocked messages
    createBlockedMessageCount();

    // Strip unread divider if it is the first item
    // (hence would show alone at the bottom of messages)
    if (messagesWithTail[0]?.t === 1) {
      messagesWithTail.shift();
    }

    // Flush cache
    objectCache.clear();

    // Populate cache with current objects
    for (const object of messagesWithTail) {
      if (object.t === 0) {
        objectCache.set(`${object.message.id}:${object.tail}`, object);
      } else if (object.t === 1) {
        objectCache.set(object.unread ?? object.date, object);
      }
    }

    return messagesWithTail.reverse();
  });

  /**
   * Go to the newest message
   */
  function jumpToBottom() {
    controller?.toPresent();

    if (props.highlightedMessageId()) {
      props.clearHighlightedMessage();
    }
  }

  /**
   * The bar that leads back to the present, when it shows
   */
  const bar = createMemo(
    () =>
      messages().length
        ? jumpBar({
            atEnd: atEnd(),
            below: reader().below,
            viewport: reader().viewport,
            unseen: history().unseen,
            newestVisible: reader().newestVisible,
          })
        : undefined,
    undefined,
    { equals: isEqual },
  );

  /**
   * A jump or the first load failed (a page that failed shows in the list)
   */
  const jumpFailed = () => {
    const failed = history().failed;
    return failed === "initial" || failed === "around" || failed === "present";
  };

  /**
   * In place of the placeholders of a page that could not be loaded
   */
  const pageFailure = (side: PageSide) => (
    <LoadFailure data-history-failure={side} older={side === "older"}>
      <span>
        <Trans>Couldn't load messages.</Trans>
      </span>
      <Button variant="text" onPress={() => controller?.retry()}>
        <Trans>Try again</Trans>
      </Button>
    </LoadFailure>
  );

  /**
   * Select last message for editing if signal is true
   */
  createEffect(
    on(
      () => state.draft.editingMessageId,
      (shouldSetEditingMessageId) => {
        if (shouldSetEditingMessageId === true) {
          // forwarded copies and polls are not editable
          const chosenMessage = messages().find(editableByMe);
          state.draft.setEditingMessage(chosenMessage);
          if (chosenMessage) {
            // Wait until the next render pass to allow the edit message ui to
            // fill the messages screen. This prevents the message box from
            // jumping up the height of the edit message ui.
            setTimeout(() => controller?.toMessage(chosenMessage.id), 1);
          }
        }
      },
    ),
  );

  /**
   * Check whether to trail the currently pending messages
   * @returns Whether to trail pending message
   */
  function pendingMessageIsTrailing() {
    const messages = messagesWithTail();
    const lastMessage = messages[messages.length - 1];

    return lastMessage &&
      lastMessage.t === 0 &&
      // check if last message is authored by us
      lastMessage.message.author?.self &&
      // split up chains that are too far apart
      Math.abs(+new Date() - +lastMessage.message.createdAt) < 420000
      ? true
      : false;
  }

  /**
   * Message ids
   * @returns List of message ids
   */
  function sentMessageIdempotency() {
    return messages().map((msg) => msg.nonce!);
  }

  return (
    <>
      <HistoryScroller
        ref={(api) => (scroller = api)}
        atStart={atStart}
        atEnd={atEnd}
        pending={() => history().pending}
        failed={() => history().failed}
        empty={() => messages().length === 0}
        rows={listRef}
        reducedMotion={reducedMotion}
        onWant={(side) =>
          side === "older" ? controller?.loadOlder() : controller?.loadNewer()
        }
        onReader={onReader}
        failure={pageFailure}
      >
        <Deferred>
          <div ref={setListRef}>
            <Show when={atStart()}>
              <ConversationStart channel={props.channel} />
            </Show>
            <For each={messagesWithTail()}>
              {(entry) => (
                <Entry
                  {...entry}
                  highlightedMessageId={props.highlightedMessageId}
                  editingMessageId={
                    typeof state.draft.editingMessageId === "string"
                      ? state.draft.editingMessageId
                      : undefined
                  }
                />
              )}
            </For>
            <Show when={atEnd()}>
              {props.pendingMessages?.({
                tail: pendingMessageIsTrailing(),
                ids: sentMessageIdempotency(),
              })}
              <Padding />
            </Show>
          </div>
        </Deferred>
      </HistoryScroller>
      <AnchorToEnd>
        <div>
          <Switch>
            <Match when={jumpFailed()}>
              <LoadFailure floating data-history-failure="jump" role="alert">
                <span>
                  <Trans>Couldn't load messages.</Trans>
                </span>
                <Button variant="text" onPress={() => controller?.retry()}>
                  <Trans>Try again</Trans>
                </Button>
              </LoadFailure>
            </Match>
            <Match when={bar()}>
              {(shown) => (
                <JumpToBottom
                  unseen={shown().unseen}
                  loading={history().pending === "present"}
                  onClick={jumpToBottom}
                />
              )}
            </Match>
          </Switch>
          <CompositionInfo
            channel={props.channel}
            scrollRef={
              listRef()?.parentElement?.parentElement?.parentElement
                ?.parentElement
            }
          />
        </div>
      </AnchorToEnd>
    </>
  );
}

/**
 * Anchor to the end of the messages list
 */
const AnchorToEnd = styled("div", {
  base: {
    zIndex: 30,
    position: "relative",

    "& > div": {
      width: "100%",
      position: "absolute",
      bottom: 0,
    },
  },
});

/**
 * Container padding
 */
const Padding = styled("div", {
  base: {
    height: "26px",
  },
});

/**
 * "Couldn't load messages. Try again": in the list where a page is missing,
 * or above the message box when a jump failed
 */
const LoadFailure = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "8px",
    minHeight: "56px",
    paddingBlock: "8px",
    paddingInline: "16px",

    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
  variants: {
    // at the very top of the list: clear of the bar that floats over it
    older: {
      true: { paddingTop: "64px" },
    },
    floating: {
      true: {
        marginInline: "16px",
        marginBottom: "var(--gap-md)",
        borderRadius: "10px",
        color: "var(--z-fg-primary)",
        background: "var(--z-popover-bg)",
        border: "1px solid var(--z-popover-border)",
        boxShadow: "var(--z-popover-lift)",
      },
    },
  },
});

/**
 * List entries
 */
type ListEntry =
  | {
      // Message
      t: 0;
      message: MessageInterface;
      tail: boolean;
      highlight: boolean;
    }
  | {
      // Message Divider
      t: 1;
      date?: string;
      unread?: boolean;
    }
  | {
      // Blocked messages
      t: 2;
      count: number;
    };

/**
 * Render individual list entry
 */
function Entry(
  props: ListEntry &
    Pick<Props, "highlightedMessageId"> & { editingMessageId?: string },
) {
  const [local, other] = splitProps(props, [
    "t",
    "highlightedMessageId",
    "editingMessageId",
  ]);

  return (
    <Switch>
      <Match when={local.t === 0}>
        <Message
          {...(other as ListEntry & { t: 0 })}
          highlight={
            (other as ListEntry & { t: 0 }).message.id ===
            local.highlightedMessageId()
          }
          editing={
            (other as ListEntry & { t: 0 }).message.id ===
            local.editingMessageId
          }
        />
      </Match>
      <Match when={local.t === 1}>
        <MessageDivider {...(other as ListEntry & { t: 1 })} />
      </Match>
      <Match when={local.t === 2}>
        <BlockedMessage count={(other as ListEntry & { t: 2 }).count} />
      </Match>
    </Switch>
  );
}
