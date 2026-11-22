import { useLingui } from "@lingui/solid/macro";
import { visuallyHidden } from "styled-system/patterns";

/**
 * Why a voice message, audio file or video could not be played: the same
 * sentence in every player. Screen readers hear it at once (an alert) and as
 * the description of the button that says "Try again"; on screen the player
 * shows the retry arrow and "Try again" in the place of the time.
 */
export function PlaybackFailure(props: { id: string }) {
  const { t } = useLingui();
  return (
    <span id={props.id} role="alert" class={visuallyHidden()}>
      {t`This file could not be played. Check your connection and try again.`}
    </span>
  );
}
