import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { createEffect, createMemo, For, on, onCleanup, Show } from "solid-js";
import { styled } from "styled-system/jsx";

import { useClient, useSound } from "@revolt/client";
import { useNavigate } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import {
  type IncomingRing,
  clearOutgoingRing,
  dismissIncomingRing,
  outgoingOutcome,
  ringState,
} from "@revolt/rtc/ringing";
import { Avatar } from "@revolt/ui/components/design/Avatar";
import { Button } from "@revolt/ui/components/design/Button";
import { useSnackbar } from "@revolt/ui/components/design/Snackbar";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Ringing in DM and group calls, loaded only when a call rings:
 * the incoming call card (with the ringtone), and on the caller's side the
 * outgoing tone and what happens when nobody answers.
 */
export default function CallRinging() {
  const voice = useVoice();
  const client = useClient();
  const sound = useSound();

  // ringing for a call this device is already in (joined here or the
  // account joined it elsewhere) is not shown
  const incoming = createMemo(() =>
    ringState().incoming.filter((ring) => {
      if (voice.channel()?.id === ring.channelId) return false;
      const self = client().user?.id;
      const channel = client().channels.get(ring.channelId);
      return !!channel && !(self && channel.voiceParticipants.has(self));
    }),
  );

  // one ringtone however many calls ring
  createEffect(
    on(
      () => incoming().length > 0,
      (ringing) => {
        if (!ringing) return;
        onCleanup(sound.loop("ringtoneIncoming"));
        // desktop app: the taskbar button flashes while it rings
        window.native?.callAttention?.(true);
        onCleanup(() => window.native?.callAttention?.(false));
      },
    ),
  );

  return (
    <>
      <Stack aria-live="assertive">
        <For each={incoming()}>
          {(ring) => <IncomingCallCard ring={ring} />}
        </For>
      </Stack>
      <OutgoingRinging />
    </>
  );
}

/**
 * Accept: Ctrl/Cmd+Shift+Enter. Decline: Ctrl/Cmd+Shift+Backspace.
 * Listed in the shortcuts screen (Calls).
 */
export function ringShortcut(
  event: Pick<
    KeyboardEvent,
    "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
  >,
): "accept" | "decline" | undefined {
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey)
    return;
  if (event.code === "Enter" || event.code === "NumpadEnter") return "accept";
  if (event.code === "Backspace") return "decline";
}

function IncomingCallCard(props: { ring: IncomingRing }) {
  const { t } = useLingui();
  const voice = useVoice();
  const client = useClient();
  const navigate = useNavigate();

  const channel = () => client().channels.get(props.ring.channelId);
  const caller = () => client().users.get(props.ring.initiatorId);
  const group = () => channel()?.type === "Group";
  const name = () =>
    group()
      ? (channel()?.name ?? "")
      : (caller()?.displayName ?? caller()?.username ?? "");

  let busy = false;

  const accept = (video = false) => {
    const target = channel();
    if (!target || busy) return;
    busy = true;
    dismissIncomingRing(target.id);
    // a call in another channel ends: one call at a time
    void voice.connect(target, undefined, undefined, 0, { video });
    navigate(target.path);
  };

  const decline = () => {
    const target = channel();
    const self = client().user?.id;
    if (!target || !self || busy) return;
    busy = true;
    dismissIncomingRing(target.id);
    // the server tells the caller and this account's other devices; if it
    // fails, this device still stops ringing
    void client()
      .api.put(`/channels/${target.id as ""}/end_ring/${self as ""}`)
      .catch((error: unknown) =>
        console.warn("[calls] decline did not reach the server", error),
      );
  };

  // only the newest card answers the keys
  const newest = () =>
    ringState().incoming.at(-1)?.channelId === props.ring.channelId;
  const onKey = (event: KeyboardEvent) => {
    if (!newest()) return;
    const action = ringShortcut(event);
    if (!action) return;
    event.preventDefault();
    if (action === "accept") accept();
    else decline();
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  // not looking at the app: a system notification as well (the same tag
  // as the web push, so one replaces the other instead of adding a second)
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    !document.hasFocus()
  ) {
    try {
      const notice = new Notification(name(), {
        body: group()
          ? t`${caller()?.displayName ?? caller()?.username} is calling the group`
          : t`is calling you`,
        icon: group() ? channel()?.iconURL : caller()?.avatarURL,
        tag: `call-${props.ring.channelId}`,
        requireInteraction: true,
      });
      notice.onclick = () => {
        window.focus();
        notice.close();
      };
      onCleanup(() => notice.close());
    } catch {
      // some browsers only allow notifications from the service worker
    }
  }

  const titleId = `incoming-call-${props.ring.channelId}`;

  return (
    <Card
      role="alertdialog"
      aria-labelledby={titleId}
      data-incoming-call={props.ring.channelId}
    >
      <Avatar
        size={48}
        src={group() ? channel()?.iconURL : caller()?.animatedAvatarURL}
        fallback={name()}
      />
      <Text>
        <Name id={titleId} dir="auto">
          {name()}
        </Name>
        <Sub>
          <Show when={group()} fallback={<Trans>is calling you</Trans>}>
            <Trans>
              {caller()?.displayName ?? caller()?.username} is calling the group
            </Trans>
          </Show>
        </Sub>
      </Text>
      <Actions>
        <Button
          variant="_error"
          shape="round"
          size="icon"
          onPress={decline}
          aria-label={t`Decline`}
          use:floating={{
            tooltip: { placement: "bottom", content: t`Decline` },
          }}
          data-ring-decline
        >
          <Symbol>call_end</Symbol>
        </Button>
        <Button
          variant="tonal"
          shape="round"
          size="icon"
          onPress={() => accept(true)}
          aria-label={t`Accept with video`}
          use:floating={{
            tooltip: { placement: "bottom", content: t`Accept with video` },
          }}
          data-ring-video
        >
          <Symbol>videocam</Symbol>
        </Button>
        <Button
          variant="success"
          shape="round"
          size="icon"
          onPress={() => accept()}
          aria-label={t`Accept`}
          use:floating={{
            tooltip: { placement: "bottom", content: t`Accept` },
          }}
          data-ring-accept
        >
          <Symbol>call</Symbol>
        </Button>
      </Actions>
    </Card>
  );
}

/**
 * The caller's side: the outgoing tone while people are rung, and when
 * nobody answers (everyone declined, or the ring timed out) the call ends
 * with a short message, instead of sitting alone in it.
 */
function OutgoingRinging() {
  const { t } = useLingui();
  const voice = useVoice();
  const client = useClient();
  const sound = useSound();
  const snackbar = useSnackbar();

  const ring = () => {
    const out = ringState().outgoing;
    return out && voice.channel()?.id === out.channelId ? out : undefined;
  };
  const channel = (): Channel | undefined => voice.channel();

  // someone joined: the call is answered, nothing is rung any more
  createEffect(() => {
    const out = ring();
    const self = client().user?.id;
    if (
      out &&
      [...(channel()?.voiceParticipants.keys() ?? [])].some((id) => id !== self)
    )
      clearOutgoingRing(out.channelId);
  });

  // the caller left or moved to another call
  createEffect(() => {
    const out = ringState().outgoing;
    if (out && voice.channel()?.id !== out.channelId) clearOutgoingRing();
  });

  createEffect(
    on(
      () => (ring()?.ringing.length ?? 0) > 0 && voice.state() === "CONNECTED",
      (ringing) => {
        if (ringing) onCleanup(sound.loop("ringtoneOutgoing"));
      },
    ),
  );

  createEffect(
    on(
      () => outgoingOutcome(ring()),
      (outcome) => {
        const out = ring();
        if (!outcome || !out) return;
        const target = channel();
        const other =
          target?.type === "DirectMessage"
            ? (target.recipient?.displayName ?? target.recipient?.username)
            : undefined;
        clearOutgoingRing(out.channelId);
        voice.disconnect();
        snackbar?.show({
          replaceActive: true,
          message:
            outcome === "declined"
              ? other
                ? t`${other} declined the call.`
                : t`Everyone declined the call.`
              : other
                ? t`${other} didn't answer.`
                : t`Nobody answered.`,
        });
      },
    ),
  );

  return null;
}

const Stack = styled("div", {
  base: {
    position: "fixed",
    insetBlockStart: "var(--gap-lg)",
    insetInlineStart: "50%",
    transform: "translateX(-50%)",
    zIndex: 200,
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
    width: "min(400px, calc(100vw - 32px))",
    pointerEvents: "none",
    "&:empty": { display: "none" },
    // RTL: the same centre, translated the other way
    "[dir=rtl] &": { transform: "translateX(50%)" },
  },
});

const Card = styled("div", {
  base: {
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md) var(--gap-lg)",
    borderRadius: "var(--z-radius-lg)",
    background: "var(--z-bg-popover)",
    border: "1px solid var(--z-border-subtle)",
    boxShadow: "var(--z-shadow-md)",
    color: "var(--z-fg-primary)",
    animation: "scrimFadeIn .2s ease-out",
    _motionReduce: { animation: "none" },
  },
});

const Text = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const Name = styled("div", {
  base: {
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Sub = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-sm)",
    flexShrink: 0,
  },
});
