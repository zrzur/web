import { useLingui } from "@lingui/solid/macro";
import "@revolt/app/menus/voice-menu.css";
import { voiceOccupancy } from "@revolt/rtc/moderation";
import { Show } from "solid-js";
import type { Channel } from "@zrzur/sdk/solid";

/** Two digits, like Discord's "01 | 07" user limit pill */
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Participant count pill: "count | limit" when the room has a user limit,
 * otherwise just the count while anyone is connected
 */
export function VoiceOccupancy(props: { channel: Channel }) {
  const { t } = useLingui();
  const occupancy = () => voiceOccupancy(props.channel);

  return (
    <Show when={occupancy().maximum !== undefined || occupancy().count > 0}>
      <span
        class="z-voice-occupancy hover-hide"
        data-voice-channel={props.channel.id}
        data-voice-count={occupancy().count}
        data-full={occupancy().full || undefined}
        title={
          occupancy().full
            ? t`This voice channel is full.`
            : occupancy().maximum !== undefined
              ? t`${occupancy().count} of ${occupancy().maximum} participants`
              : t`Participants`
        }
        aria-label={t`Participants`}
      >
        <span>{pad(occupancy().count)}</span>
        <Show when={occupancy().maximum !== undefined}>
          <span>{pad(occupancy().maximum!)}</span>
        </Show>
      </span>
    </Show>
  );
}
