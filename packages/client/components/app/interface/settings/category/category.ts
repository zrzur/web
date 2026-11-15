import type { Channel, Server } from "@zrzur/sdk/solid";

import { type Pair, pair, sees } from "../channel/permissions/visibility";

/** What category settings are opened with */
export type CategoryContext = { server: Server; categoryId: string };

/** A category as the server stores it (newer fields than the API types) */
export type StoredCategory = {
  id: string;
  title: string;
  channels: string[];
  description?: string | null;
  default_permissions?: { a: number; d: number } | null;
  role_permissions?: Record<string, { a: number; d: number }>;
};

/** The category these settings are about; undefined once it is gone */
export function findCategory(
  context: CategoryContext,
): StoredCategory | undefined {
  return context.server.categories?.find(
    (category) => category.id === context.categoryId,
  ) as StoredCategory | undefined;
}

/** The category's channels this person knows, in the category's order */
export function channelsOf(
  context: CategoryContext,
  category: StoredCategory | undefined,
): Channel[] {
  const known = new Map(
    context.server.channels.map((channel) => [channel.id, channel]),
  );
  return (category?.channels ?? [])
    .map((id) => known.get(id))
    .filter((channel): channel is Channel => !!channel);
}

/** Whether people with no role are kept out of the category */
export function isPrivateCategory(
  serverDefault: bigint | number,
  category: { default_permissions?: { a: number; d: number } | null },
): boolean {
  return !sees(
    BigInt(serverDefault),
    pair(category.default_permissions ?? undefined),
  );
}

/**
 * Whether a channel that does not follow its category is open to people
 * with no role (so a private category does not hide it)
 */
export function openToEveryone(
  serverDefault: bigint | number,
  channel: { defaultPermissions?: Pair | { a: number; d: number } },
): boolean {
  return sees(BigInt(serverDefault), pair(channel.defaultPermissions));
}

type Overrides = { everyone: Pair; roles: Record<string, Pair> };

/**
 * Whether a role that the category keeps out still sees a channel with its
 * own permissions
 */
export function seenByRoleOutside(
  serverDefault: bigint | number,
  category: Overrides,
  channel: Overrides,
  role: { id: string; permissions: Pair },
): boolean {
  const base = BigInt(serverDefault);
  const inCategory = sees(base, category.everyone, {
    permissions: role.permissions,
    override: category.roles[role.id],
  });
  const inChannel = sees(base, channel.everyone, {
    permissions: role.permissions,
    override: channel.roles[role.id],
  });
  return !inCategory && inChannel;
}
