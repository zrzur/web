import type { Client, Server, ServerMember, User } from "@zrzur/sdk/solid";

import { memberPageQuery } from "./memberPages";

type Page = { members: ServerMember[]; users: User[]; next?: string };

/**
 * One page of a server's members, ordered by user id. Same result as
 * `server.fetchMembersPage`, but `limit` and `after` reach the server.
 */
export async function fetchMemberPage(
  client: Client,
  server: Server,
  options: { limit?: number; after?: string },
): Promise<Page> {
  const { baseURL, headers } = client.api.config;
  const query = memberPageQuery(options);
  const response = await fetch(
    `${baseURL}/servers/${server.id}/members${query ? `?${query}` : ""}`,
    { headers: headers as Record<string, string> },
  );
  if (!response.ok) throw await response.json().catch(() => undefined);
  const data = (await response.json()) as {
    members: { _id: { server: string; user: string } }[];
    users: { _id: string }[];
    next?: string;
  };
  return {
    members: data.members.map((member) =>
      client.serverMembers.getOrCreate(member._id, member as never),
    ),
    users: data.users.map((user) =>
      client.users.getOrCreate(user._id, user as never),
    ),
    next: data.next,
  };
}

/** Every member, a page at a time (for the few places that need them all) */
export async function fetchAllMembers(client: Client, server: Server) {
  const members: ServerMember[] = [];
  let after: string | undefined;
  do {
    const page = await fetchMemberPage(client, server, { limit: 1000, after });
    members.push(...page.members);
    after = page.next;
  } while (after);
  return members;
}
