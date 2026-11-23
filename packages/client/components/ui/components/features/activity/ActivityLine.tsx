import { Show } from "solid-js";

import type { User } from "@zrzur/sdk/solid";

import { lazyRetry } from "../../utils/lazyRetry";

/** The line itself: downloaded the first time someone has an activity */
const Body = lazyRetry(
  () => import("./ActivityLineBody"),
  () => null,
);

/**
 * One line under a name in the member list and the DM list: an icon and
 * "Playing <name>". Nothing when there is no activity, and then nothing is
 * downloaded either (rich presence is off on most servers).
 */
export function ActivityLine(props: { user?: User; class?: string }) {
  return (
    <Show when={(props.user?.activities as unknown[] | undefined)?.length}>
      <Body user={props.user} class={props.class} />
    </Show>
  );
}
