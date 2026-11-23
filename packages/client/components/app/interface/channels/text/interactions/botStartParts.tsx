import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";

/**
 * The parts of a conversation with a bot (bots in DMs): only such a
 * conversation draws them, so they are not part of the app's first download
 * (scripts/precacheShell.mjs). Each waits in its own loading boundary, and
 * shows nothing if its file can't be loaded.
 */
const parts = () => import("./BotStart");

/** The top of a conversation with a bot, with Start */
export const BotStart = lazyRetry(
  () => parts().then((m) => ({ default: m.BotStart })),
  () => null,
);

/** Above the message box when a bot link waits for Start */
export const BotStartBar = lazyRetry(
  () => parts().then((m) => ({ default: m.BotStartBar })),
  () => null,
);

/** In place of the message box after Stop bot */
export const BotStopped = lazyRetry(
  () => parts().then((m) => ({ default: m.BotStopped })),
  () => null,
);

/** The DM header menu items of a conversation with a bot */
export const BotMenuItems = lazyRetry(
  () => parts().then((m) => ({ default: m.BotMenuItems })),
  () => null,
);
