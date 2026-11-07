import { createEffect, onCleanup, onMount, untrack } from "solid-js";

import { useClient } from "@revolt/client";
import {
  answerFailed,
  answerPending,
  isRememberedCreator,
  knownAnswer,
  rememberCreator,
  sharedAnswer,
} from "@revolt/common/lib/creatorCache";

import {
  type CommunityPermissions,
  communityApi,
  maySeeStudio,
} from "./communityApi";

const VISITOR = "visitor";
const NOTHING: CommunityPermissions = { permissions: [] };

/** Whoever is mounted asks again when the window comes back; one is enough */
const askers = new Set<() => void>();
const onWindowFocus = () => askers.values().next().value?.();

/**
 * The signed-in person's permissions: one answer, shared by everything that
 * asks. Reading it never suspends, so it cannot hold up the page change that
 * asked, and asking again keeps what is on screen until the new answer is
 * here. A rank changed elsewhere arrives with the next window focus, entry
 * into Designs or refusal by the server (`refresh`).
 *
 * `perms`: undefined until the answer for this account is here.
 * `failed`: the server could not say, which is not the same as "no rank".
 * `retrying`: asked again after a failure; the answer is on its way.
 */
export function useCommunityPermissions() {
  const client = useClient();
  const account = () => client()?.user?.id ?? VISITOR;

  const ask = (fresh: boolean) => {
    const id = account();
    if (id === VISITOR) return;
    sharedAnswer<CommunityPermissions>(
      id,
      () => communityApi.permissions(client()),
      { fresh },
    ).catch(() => {
      // kept with the shared answer: `failed` says so
    });
  };
  const refresh = () => ask(true);

  createEffect(() => {
    account();
    untrack(() => ask(false));
  });

  onMount(() => {
    if (!askers.size) window.addEventListener("focus", onWindowFocus);
    askers.add(refresh);
  });
  onCleanup(() => {
    askers.delete(refresh);
    if (!askers.size) window.removeEventListener("focus", onWindowFocus);
  });

  return {
    perms: () => {
      const id = account();
      return id === VISITOR ? NOTHING : knownAnswer<CommunityPermissions>(id);
    },
    failed: () => answerFailed(account()),
    retrying: () => answerFailed(account()) && answerPending(),
    retry: refresh,
    refresh,
  };
}

export type CommunityPermissionsAccess = ReturnType<
  typeof useCommunityPermissions
>;

/**
 * Whether the person signed in may open Creator Studio, for what is shown to
 * creators only. While the server's answer is on its way, what it said last
 * time for this account is used, so a creator's row is there at once and
 * nobody else sees it appear. Once the server has answered, only that counts,
 * and a failed answer means no: it fails closed. The server checks again on
 * every request.
 */
export function useCreatorAccess(
  access: CommunityPermissionsAccess = useCommunityPermissions(),
) {
  const client = useClient();
  const userId = () => client()?.user?.id;

  createEffect(() => {
    const id = userId();
    const known = access.perms();
    if (id && known) rememberCreator(id, maySeeStudio(known));
  });

  return () => {
    if (access.failed()) return false;
    const known = access.perms();
    return known ? maySeeStudio(known) : isRememberedCreator(userId());
  };
}
