let loading: Promise<unknown> | undefined;

/**
 * Start loading a bot's card at the press on its name, before the click
 * opens it: the card and its bot sections are lazy chunks, and without this
 * the sections only start once the card has loaded and drawn. Later presses
 * reuse the first load; a failed load is tried again on the next press.
 */
export function preloadBotCard() {
  loading ??= Promise.all([
    import("../../floating/UserCard"),
    import("./ProfileBotAbout"),
    import("./ProfileOwner"),
    import("./ProfileCommands"),
  ]).catch(() => (loading = undefined));
  return loading;
}
