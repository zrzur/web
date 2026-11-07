import { useQuery } from "@tanstack/solid-query";

import { useClient } from "@revolt/client";

import { communityApi } from "./communityApi";

/**
 * Someone's public creator page. The server answers only for an active
 * creator with an open page (or for yourself), so anyone else, a suspended
 * creator included, comes back as null. Only for the way to that page: whether
 * someone is a creator comes with their profile (`profile.creator`).
 */
export function useCreatorProfile(userId: () => string) {
  const client = useClient();
  const query = useQuery(() => ({
    queryKey: ["community-creator", userId()],
    queryFn: () => communityApi.creator(client(), userId()).catch(() => null),
  }));

  /** The page, if this person has the creator rank right now */
  return () => (query.data?.creator.verified ? query.data : undefined);
}
