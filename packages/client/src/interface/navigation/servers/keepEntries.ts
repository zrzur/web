import type { ResolvedEntry } from "@revolt/state";

/**
 * The rail's entries, reusing the ones already drawn
 *
 * The ordering store builds new entry objects every time it is read (any
 * server change reads it again), and the rail's list draws a new row for
 * every new object. So every unread dot or settings sync redrew every
 * server: an open menu closed, a tooltip vanished and a finger resting on
 * a server lost the node it was holding. An entry that still shows the
 * same server, or the same folder with the same servers, is kept.
 * @param previous Entries handed out last time
 * @param next Entries from the store now
 * @returns Next entries, with unchanged ones swapped for the kept objects
 */
export function keepEntries(
  previous: ResolvedEntry[] | undefined,
  next: ResolvedEntry[],
): ResolvedEntry[] {
  if (!previous?.length) return next;

  const kept = new Map(previous.map((entry) => [entry.id, entry]));

  return next.map((entry) => {
    const old = kept.get(entry.id);
    if (!old || old.type !== entry.type) return entry;

    if (old.type === "server" && entry.type === "server") {
      return old.server === entry.server ? old : entry;
    }

    if (old.type === "folder" && entry.type === "folder") {
      const same =
        old.folder === entry.folder &&
        old.servers.length === entry.servers.length &&
        old.servers.every((server, index) => server === entry.servers[index]);
      return same ? old : entry;
    }

    return entry;
  });
}
