/**
 * Whether you can edit a message: your own, and neither a forwarded copy
 * (someone else's words) nor a poll (it can't change under the people who
 * voted). The server refuses the same.
 */
export function editableByMe(message: {
  author?: { self?: boolean } | null;
  forwarded?: unknown;
  poll?: unknown;
}): boolean {
  return !!message.author?.self && !message.forwarded && !message.poll;
}
