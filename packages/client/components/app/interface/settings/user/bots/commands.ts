/** Shape of a registered command, as the API returns it */
export type BotCommand = {
  _id: string;
  type?: "ChatInput" | "User" | "Message";
  name: string;
  name_localizations?: Record<string, string>;
  description?: string;
  options?: unknown[];
};

/** Names in other languages, e.g. "ar: مرحبا · de: hallo" */
export function localizedNames(command: BotCommand) {
  return Object.entries(command.name_localizations ?? {})
    .map(([locale, name]) => `${locale}: ${name}`)
    .join(" · ");
}
