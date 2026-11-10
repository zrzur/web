import type { Channel, Client } from "@zrzur/sdk/solid";

/**
 * Hovering (or focusing) someone who shares their screen shows a still of
 * it. The row is read when the event comes (it is gone by the time the card
 * has loaded); a pointer that left meanwhile shows nothing.
 */
export function streamPreviewHover(who: {
  sharing: () => boolean;
  client: () => Client;
  channel: () => Channel;
  userId: () => string;
  name: () => string;
}) {
  let hovering = false;
  let hide: (() => void) | undefined;
  return {
    enter(event: Event) {
      const row = event.currentTarget as HTMLElement;
      hovering = true;
      if (!who.sharing()) return;
      return import("./StreamPreviewCard").then((card) => {
        if (hovering)
          hide = card.show(
            row,
            who.client(),
            who.channel(),
            who.userId(),
            who.name(),
          );
      });
    },
    leave() {
      hovering = false;
    },
    /** The row is gone: take its card with it */
    dispose() {
      hide?.();
    },
  };
}
