import { useLingui } from "@lingui/solid/macro";

import { useVoice } from "@revolt/rtc";
import { Icon } from "@revolt/ui/icons/Icon";

import { ControlButton } from "../callCard/VoiceCallCardActions";

import { setSoundboardOpen, soundboardOpen } from "./soundboardOpen";

/**
 * The call's soundboard button: opens the server's sounds for those who may
 * play them
 */
export default function SoundboardButton(props: { size: "xs" | "sm" }) {
  const voice = useVoice();
  const { t } = useLingui();
  const allowed = () => !!voice.channel()?.havePermission("UseSoundboard");

  return (
    <ControlButton
      size={props.size}
      tone={soundboardOpen() ? "on" : "neutral"}
      data-voice-control="soundboard"
      aria-pressed={soundboardOpen()}
      disabled={
        voice.state() !== "CONNECTED" || !voice.speakingPermission || !allowed()
      }
      label={allowed() ? t`Soundboard` : t`Missing permission`}
      onClick={() => setSoundboardOpen(!soundboardOpen())}
    >
      <Icon name="music-note" size={props.size === "xs" ? 18 : 22} />
    </ControlButton>
  );
}
