/**
 * Commands of the app itself, there in every chat (as in Discord): they
 * change the text of the message before it is sent, nothing else.
 *
 * - `/shrug text`     text ¯\_(ツ)_/¯
 * - `/tableflip text` text (╯°□°)╯︵ ┻━┻
 * - `/unflip text`    text ┬─┬ノ( º _ ºノ)
 * - `/me text`        _text_ (said as an action, in italics)
 * - `/spoiler text`   ||text|| (hidden until clicked)
 */
export type BuiltinName = "shrug" | "tableflip" | "unflip" | "me" | "spoiler";

export interface BuiltinCommand {
  name: BuiltinName;
  /** The face it adds, for the faces */
  face?: string;
  /** Needs text of its own (a face can be sent alone) */
  needsText?: boolean;
  /** The message to send for the text after the command */
  apply: (text: string) => string;
}

/** After the text, with a space only when there is text */
const withFace = (face: string) => (text: string) =>
  text ? `${text} ${face}` : face;

export const BUILTIN_COMMANDS: BuiltinCommand[] = [
  {
    name: "shrug",
    face: "¯\\_(ツ)_/¯",
    // escaped, so the arm and the underscores are not read as Markdown
    apply: withFace("¯\\\\\\_(ツ)\\_/¯"),
  },
  {
    name: "tableflip",
    face: "(╯°□°)╯︵ ┻━┻",
    apply: withFace("(╯°□°)╯︵ ┻━┻"),
  },
  {
    name: "unflip",
    face: "┬─┬ノ( º _ ºノ)",
    apply: withFace("┬─┬ノ( º \\_ ºノ)"),
  },
  { name: "me", needsText: true, apply: (text) => `_${text}_` },
  { name: "spoiler", needsText: true, apply: (text) => `||${text}||` },
];

/** The built-in commands whose name starts with what is typed after `/` */
export function builtinMatches(query: string): BuiltinCommand[] {
  const q = query.toLocaleLowerCase();
  return BUILTIN_COMMANDS.filter((command) => command.name.startsWith(q));
}

/**
 * The command a draft starts with (`/shrug`, `/me waves`…), or undefined
 * when it starts with no built-in command
 */
export function builtinCommand(draft: string): BuiltinCommand | undefined {
  const name = /^\/(\S+)(?:\s|$)/.exec(draft)?.[1];
  return BUILTIN_COMMANDS.find((command) => command.name === name);
}

/**
 * What a draft becomes when it is sent: the command's message, `""` when a
 * command that needs text has none (nothing to send), or undefined when it
 * is not a built-in command (sent as it is)
 */
export function applyBuiltin(draft: string): string | undefined {
  const command = builtinCommand(draft);
  if (!command) return undefined;
  const text = draft.slice(command.name.length + 1).trim();
  if (command.needsText && !text) return "";
  return command.apply(text);
}
