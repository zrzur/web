/** The parts of a channel a name is read from */
type Named = {
  type: string;
  name?: string;
  displayName?: string;
  recipient?: { displayName?: string; username?: string };
};

/**
 * The name people see for a conversation. A direct message goes by the other
 * person's display name, the same one the sidebar and the chat header show,
 * and only falls back to the username; every other channel goes by its own
 * name.
 */
export function conversationName(
  channel: Named | undefined,
): string | undefined {
  if (!channel) return undefined;
  if (channel.type === "DirectMessage")
    return (
      channel.recipient?.displayName ??
      channel.recipient?.username ??
      channel.displayName
    );
  return channel.displayName ?? channel.name;
}
