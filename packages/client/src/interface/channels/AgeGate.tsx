import { JSXElement, Show, Suspense } from "solid-js";

import { CircularProgress } from "@revolt/ui";
import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";

// The gate's screens load only for content marked as mature: kept out of the
// files the app installs up front (scripts/precacheShell.mjs). If the file
// still does not arrive after a second try, the content stays closed.
const AgeGateScreen = lazyRetry(
  () => import("./AgeGateScreen").then((m) => ({ default: m.AgeGateScreen })),
  () => null,
);

/**
 * Age gate filter for any content. Content that is not marked as mature
 * shows at once, inside the loading boundary every channel sits in
 * (see common/lib/loaded.ts).
 */
export function AgeGate(props: {
  enabled: boolean;
  contentId: string;
  contentName: string;
  contentType: "channel";
  children: JSXElement;
}) {
  return (
    <Show
      when={props.enabled}
      fallback={
        <Suspense fallback={<CircularProgress />}>{props.children}</Suspense>
      }
    >
      <AgeGateScreen {...props} />
    </Show>
  );
}
