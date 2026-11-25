import { For, Show, Suspense, createSignal, onCleanup } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";

import { useUsers } from "@revolt/markdown/users";
import { useVoice } from "@revolt/rtc";
import { Avatar } from "@revolt/ui/components/design/Avatar";
import { Button } from "@revolt/ui/components/design/Button";
import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";
import { Icon } from "@revolt/ui/icons/Icon";

import { callDuration } from "./dmCallView";

import "./dmCall.css";

// the call itself needs the LiveKit components: they load with the first
// call this device is in, not for the join bar
const DmCallRoom = lazyRetry(
  () => import("./DmCallRoom"),
  () => null,
);

/**
 * A call in a direct message or group, shown above the conversation (loaded
 * by DmCallGate the first time it is needed)
 */
export default function DmCallStage(props: {
  channel: Channel;
  display: "join" | "stage" | "phone";
}) {
  return (
    <Show
      when={props.display !== "join"}
      fallback={<JoinBar channel={props.channel} />}
    >
      <Suspense>
        <DmCallRoom channel={props.channel} phone={props.display === "phone"} />
      </Suspense>
    </Show>
  );
}

/** Now, once a second while something on screen shows a call time */
export function useNow() {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(timer));
  return now;
}

/** When the call in this conversation started (the first one in it) */
export function callStart(channel: Channel) {
  let first: number | undefined;
  for (const participant of channel.voiceParticipants.values()) {
    const at = participant.joinedAt?.getTime?.();
    if (at && (!first || at < first)) first = at;
  }
  return first;
}

/**
 * Others are in a call here, this device is not: who is in it, for how
 * long, and Join (with or without the camera)
 */
function JoinBar(props: { channel: Channel }) {
  const voice = useVoice();
  const { t } = useLingui();
  const now = useNow();

  const ids = () => [...props.channel.voiceParticipants.keys()];
  const users = useUsers(ids);
  const canJoin = () => props.channel.havePermission("Connect");
  const names = () =>
    users()
      .map((user) => user?.username)
      .filter(Boolean)
      .join(t`, `);
  const since = () => {
    const start = callStart(props.channel);
    return start ? callDuration(now() - start) : undefined;
  };

  return (
    <div
      class="z-dmcall-join"
      data-dm-call="join"
      role="region"
      aria-label={t`Call in this conversation`}
    >
      <div class="z-dmcall-join-faces" aria-hidden="true">
        <For each={users().slice(0, 4)}>
          {(user) => (
            <Avatar
              size={32}
              src={user?.avatar}
              fallback={user?.username}
              interactive={false}
            />
          )}
        </For>
      </div>
      <div class="z-dmcall-join-text">
        <span class="z-dmcall-join-title">{t`In a call`}</span>
        <span class="z-dmcall-join-sub">
          <bdi>{names()}</bdi>
          <Show when={since()}>
            {(time) => (
              <>
                {" · "}
                <span class="z-dmcall-time">{time()}</span>
              </>
            )}
          </Show>
        </span>
      </div>
      <Show when={canJoin()}>
        <div class="z-dmcall-join-actions">
          <Button
            variant="tonal"
            size="icon"
            aria-label={t`Join with video`}
            data-dm-call-join-video
            use:floating={{
              tooltip: { placement: "bottom", content: t`Join with video` },
            }}
            onPress={() =>
              voice.connect(props.channel, undefined, undefined, 0, {
                video: true,
              })
            }
          >
            <Icon name="video-camera" size={20} />
          </Button>
          <Button
            variant="filled"
            data-dm-call-join
            onPress={() => voice.connect(props.channel)}
          >
            <Icon name="phone" size={18} />
            {t`Join`}
          </Button>
        </div>
      </Show>
    </div>
  );
}
