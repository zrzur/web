import { useLingui } from "@lingui/solid/macro";
import { visuallyHidden } from "styled-system/patterns";

/**
 * Why a voice message, audio file or video could not be played: the same
 * sentence in every player. Here it is the description of the button that
 * says "Try again"; it is spoken once, through the shared live region
 * ([`announcePlaybackFailure`]), and only for the player the user tapped.
 * On screen the player shows the retry arrow and "Try again" in the place of
 * the time.
 */
export function PlaybackFailure(props: { id: string }) {
  const failure = usePlaybackFailureText();
  return (
    <span id={props.id} class={visuallyHidden()}>
      {failure()}
    </span>
  );
}

/** The sentence, for the description and for the announcement */
export function usePlaybackFailureText() {
  const { t } = useLingui();
  return () =>
    t`This file could not be played. Check your connection and try again.`;
}

/** One live region for every player, made when first needed */
let region: HTMLElement | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Say why playback failed, once. The region is emptied first, so the same
 * sentence after a second tap is spoken again.
 */
export function announcePlaybackFailure(text: string) {
  if (typeof document === "undefined") return;
  if (!region?.isConnected) {
    region = document.createElement("div");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "assertive");
    region.setAttribute("data-playback-announcer", "");
    region.className = visuallyHidden();
    document.body.append(region);
  }
  const live = region;
  live.textContent = "";
  clearTimeout(pending);
  pending = setTimeout(() => (live.textContent = text), 50);
}
