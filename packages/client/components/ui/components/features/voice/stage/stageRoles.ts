import type { StageState } from "@revolt/rtc/voiceExtrasStore";

/** Where someone is on a stage */
export type StageRole = "speaker" | "hand" | "audience";

/**
 * Split the people in a stage call into speakers, raised hands and the rest
 * of the audience. Speakers and hands come from the stage state (only those
 * still in the call), the audience is everyone else in the call.
 * @param state Stage state
 * @param inCall Ids of everyone in the call
 * @param me Your id
 */
export function stageRoles(state: StageState, inCall: string[], me: string) {
  const present = new Set(inCall);
  // you are in the call as soon as you joined, even before the roster says so
  if (me) present.add(me);
  const speakers = state.speakers.filter((id) => present.has(id));
  const hands = state.hands.filter(
    (id) => present.has(id) && !speakers.includes(id),
  );
  const taken = new Set([...speakers, ...hands]);
  const audience = [...present].filter((id) => !taken.has(id));
  const mine: StageRole = speakers.includes(me)
    ? "speaker"
    : hands.includes(me)
      ? "hand"
      : "audience";
  return { speakers, hands, audience, mine };
}
