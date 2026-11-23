export type IntroPrivacy = {
  share_activity?: boolean | null;
  activity_intro_seen?: boolean;
};

/**
 * Whether the one-time activity question should open for this answer from
 * the server: never answered and not sharing. "Not now" counts as an answer.
 */
export function shouldAskAboutActivity(privacy: IntroPrivacy | undefined) {
  return (
    !!privacy &&
    privacy.activity_intro_seen !== true &&
    privacy.share_activity !== true
  );
}
