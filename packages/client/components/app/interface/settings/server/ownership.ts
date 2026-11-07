/**
 * Rules for handing a server to someone else (the server enforces the same:
 * server_edit.rs refuses bots and anyone who is not a member)
 */

/** Whether this person can become the owner */
export function canTransferTo(
  user: { id: string; bot?: unknown },
  server: { ownerId: string },
) {
  return !user.bot && user.id !== server.ownerId;
}

/** Whether what was typed confirms the server name (case and spaces aside) */
export function confirmsName(typed: string, name: string) {
  const fold = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return fold(typed) !== "" && fold(typed) === fold(name);
}
