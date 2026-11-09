import type {
  ApplicationCommand,
  CommandApplication,
  ServerCommands,
} from "./types";

/**
 * One entry per bot, kind and name. A bot can have a global command and a
 * command limited to this server with the same name (often a leftover from
 * testing). Both used to be listed, and picking by typing could land on
 * either one; the server's own copy wins, as it was registered for here.
 */
export function dedupeCommands(
  commands: ApplicationCommand[],
): ApplicationCommand[] {
  const kept = new Map<string, ApplicationCommand>();
  for (const command of commands) {
    const key = `${command.application_id}\u0000${command.type}\u0000${command.name}`;
    const seen = kept.get(key);
    if (!seen || (!seen.server_id && command.server_id)) {
      if (seen) kept.delete(key);
      kept.set(key, command);
    }
  }
  return [...kept.values()];
}

/**
 * The command a draft names in full, like `/close` before Enter: only when
 * the draft is exactly one slash word and exactly one command has that name
 * (in the reader's language or as registered). Anything else is left to the
 * list or sent as text.
 */
export function typedCommand(
  text: string,
  commands: ApplicationCommand[],
  label: (command: ApplicationCommand) => string,
): ApplicationCommand | undefined {
  const typed = /^\/(\S+)\s*$/.exec(text)?.[1];
  if (!typed) return undefined;
  const found = commands.filter(
    (command) =>
      command.type === "ChatInput" &&
      (label(command) === typed || command.name === typed),
  );
  return found.length === 1 ? found[0] : undefined;
}

/**
 * The commands of a DM with a bot: its global ones that make sense without
 * a server (no server permissions needed, not age-restricted)
 */
export function dmCommands(
  bot: CommandApplication,
  commands: ApplicationCommand[],
): ServerCommands {
  return {
    applications: [bot],
    commands: commands.filter(
      (command) =>
        !command.server_id &&
        command.default_member_permissions === undefined &&
        !command.nsfw,
    ),
  };
}
