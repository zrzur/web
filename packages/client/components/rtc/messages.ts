import { useLingui } from "@lingui/solid/macro";
import { voiceErrorType } from "./moderation";

export function useVoiceError() {
  const { t } = useLingui();
  return (error: unknown) => {
    switch (voiceErrorType(error)) {
      case "RateLimited":
        return t`Too many actions. Wait a moment and try again.`;
      case "InternalError":
        return t`The server could not apply this voice change. Check the participant state before retrying.`;
      case "CannotJoinCall":
        return t`This voice channel is full.`;
      case "MissingPermission":
        return t`You don't have permission.`;
      case "NotElevated":
        return t`That member's role is too high.`;
      case "InvalidOperation":
        return t`You can't do that to the server owner.`;
      case "NotConnected":
        return t`That member is not in a voice channel.`;
      case "NotAVoiceChannel":
      case "UnknownChannel":
        return t`That voice channel is no longer available.`;
      case "AlreadyConnected":
        return t`You joined voice from another tab or device.`;
      case "VoiceRejoinRefused":
        return t`You were disconnected from voice.`;
      case "NotAllowedError":
        return t`Allow microphone or camera access in your browser settings.`;
      case "NotFoundError":
        return t`No media device was found. Check your device settings.`;
      default:
        return t`Voice connection failed. Check your connection and try again.`;
    }
  };
}
