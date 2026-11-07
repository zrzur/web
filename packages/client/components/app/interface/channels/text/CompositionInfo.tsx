import { createCountdownFromNow } from "@solid-primitives/date";
import { For, Match, Show, Switch, createMemo, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { createResizeObserver } from "@solid-primitives/resize-observer";
import { Channel, User } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useDurationFormat } from "@revolt/i18n/durations";
import { useUsers } from "@revolt/markdown/users";
import { Avatar, OverflowingText, Symbol } from "@revolt/ui";
import { FlockDots } from "@revolt/ui/components/design/FlockDots";

interface Props {
  channel: Channel;
  scrollRef?: HTMLElement | null;
}

/**
 * Display composition
 */
export function CompositionInfo(props: Props) {
  const { t } = useLingui();
  const durationFormat = useDurationFormat();
  const client = useClient();

  const isSlowmodeExempt = () => props.channel.havePermission("BypassSlowmode");

  const slowmodeCountdown = createMemo(() => {
    if (!props.channel.slowmode || isSlowmodeExempt()) return 0;

    const entry = props.channel.userSlowmode();
    if (!entry) return;

    const receivedAt = entry.receivedAt ?? Date.now();
    // Add 100 ms here so the countdown has a bit to render
    const targetTs = receivedAt + 100 + entry.retry_after * 1000;
    return createCountdownFromNow(targetTs);
  });

  const cooldownRemaining = createMemo(() => {
    const cd = slowmodeCountdown();

    if (!cd) return 0;

    const [store] = cd;

    const h = store.hours ?? 0;
    const m = store.minutes ?? 0;
    const s = store.seconds ?? 0;

    const totalSeconds = h * 3600 + m * 60 + s;
    return totalSeconds > 0 ? totalSeconds : 0;
  });

  const slowmodeText = createMemo(() => {
    const cd = slowmodeCountdown();

    if (!cd) return "";

    const [store] = cd;

    return durationFormat(
      { seconds: store.seconds, minutes: store.minutes, hours: store.hours },
      { style: "digital" },
    );
  });

  const slowmodeWaitTime = createMemo(() => {
    const s = props.channel.slowmode;
    if (!s) return "";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    return durationFormat({ seconds: sec, minutes: m, hours: h });
  });

  /**
   * Generate list of user IDs
   * @returns User IDs
   */
  const users = useUsers(
    () =>
      (
        props.channel.typing.filter(
          (user) =>
            typeof user !== "undefined" &&
            user.id !== client().user!.id &&
            user.relationship !== "Blocked",
        ) as User[]
      )
        .sort((a, b) => a!.id.toUpperCase().localeCompare(b!.id.toUpperCase()))
        .map((user) => user.id),
    true,
  );

  let barRef: HTMLDivElement | undefined;

  onMount(() => createResizeObserver(() => props.scrollRef, setBarWidth));

  function setBarRef(r?: HTMLDivElement) {
    barRef = r;
    setBarWidth();
  }

  function setBarWidth() {
    if (barRef && props.scrollRef)
      barRef.style.width = `calc(100% - ${
        props.scrollRef.offsetWidth - props.scrollRef.clientWidth
      }px)`;
  }

  return (
    <Show when={props.channel.slowmode || users().length || setBarRef()}>
      <Bar ref={setBarRef}>
        <Show when={users().length} fallback={<Dummy />}>
          <Typing role="status" aria-live="polite">
            <FlockDots moving />
            <Avatars>
              <For each={users().slice(0, 3)}>
                {(user, index) => (
                  <Avatar
                    src={user!.avatar}
                    size={16}
                    holepunch={
                      index() + 1 < Math.min(users().length, 3)
                        ? "overlap-subtle"
                        : "none"
                    }
                  />
                )}
              </For>
            </Avatars>
            <OverflowingText class={typingText}>
              <Switch fallback={<Trans>Several people are typing…</Trans>}>
                <Match when={users().length === 1}>
                  <Trans>
                    <strong>{users()[0]!.username}</strong> is typing…
                  </Trans>
                </Match>
                <Match when={users().length < 5}>
                  <Trans>
                    <strong>
                      {users()
                        .slice(0, -1)
                        .map((user) => user!.username)
                        .join(", ")}
                    </strong>{" "}
                    and <strong>{users().slice(-1)[0]!.username}</strong> are
                    typing…
                  </Trans>
                </Match>
              </Switch>
            </OverflowingText>
          </Typing>
        </Show>
        <Show when={props.channel.slowmode}>
          <div
            class={SlowmodeHolder()}
            use:floating={{
              tooltip: {
                placement: "top",
                content: t`Members can send one message every ${slowmodeWaitTime()}.`,
              },
            }}
          >
            <Symbol style={{ "font-size": "1rem" }}>schedule</Symbol>
            <SlowmodeText>
              <Switch fallback={t`Slowmode is enabled.`}>
                <Match when={isSlowmodeExempt()}>{t`Slowmode immune`}</Match>
                <Match when={cooldownRemaining() > 0}>{slowmodeText()}</Match>
              </Switch>
            </SlowmodeText>
          </div>
        </Show>
      </Bar>
    </Show>
  );
}

/**
 * Avatar alignment
 */
const Avatars = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,
    height: "fit-content",

    "& :not(:first-child)": {
      marginInlineStart: "-6px",
    },
  },
});

/**
 * The line above the message box: who is typing and the slow mode timer.
 * No strip of its own: it sits on the chat background, quiet and small.
 */
const Bar = styled("div", {
  base: {
    minHeight: "24px",
    paddingInline: "16px",

    display: "flex",
    gap: "10px",

    userSelect: "none",
    alignItems: "center",
    flexDirection: "row",

    color: "var(--z-fg-muted)",
    background: "transparent",
  },
});

/** The flock, avatars, then "Name is typing…" */
const Typing = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
});

/** Names in the main text colour, the rest muted */
const typingText = cva({
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    "& strong": { color: "var(--z-fg-secondary)", fontWeight: 600 },
  },
})();

const Dummy = styled("div", {
  base: {
    display: "flex",
    width: 0,
  },
});

const SlowmodeHolder = cva({
  base: {
    display: "flex",
    alignItems: "center",
    marginInlineStart: "auto",
    gap: "var(--gap-sm)",
    color: "var(--z-fg-muted)",
    flexShrink: 0,
  },
});

const SlowmodeText = styled("span", {
  base: {
    fontSize: "0.75rem",
    fontWeight: "600",
  },
});
