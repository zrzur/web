import { useQueryClient } from "@tanstack/solid-query";
import { createEffect, onCleanup } from "solid-js";

import { useClient } from ".";

/** A user change that shows on a profile: picture, banner, bio, names */
const PROFILE_FIELDS = [
  "profile",
  "avatar",
  "display_name",
  "username",
  "pronouns",
  "style",
];

type UserUpdateEvent = {
  type: "UserUpdate";
  id: string;
  data?: Record<string, unknown>;
  clear?: string[];
};

/**
 * Open profiles (card, page, modal) follow their person live: a profile is
 * a fetched query, so a new banner, bio or picture used to show only after
 * a reload (owner, 2026-11-27). Only a query on screen is fetched again.
 */
export function LiveProfiles() {
  const client = useClient();
  const queries = useQueryClient();

  createEffect(() => {
    // no client before sign-in: nothing to follow yet
    const current = client();
    if (!current?.events) return;
    const onEvent = (raw: unknown) => {
      const event = raw as UserUpdateEvent;
      if (event?.type !== "UserUpdate") return;
      const touched =
        Object.keys(event.data ?? {}).some((key) =>
          PROFILE_FIELDS.includes(key),
        ) ||
        (event.clear ?? []).some((field) =>
          [
            "ProfileContent",
            "ProfileBackground",
            "Avatar",
            "DisplayName",
          ].includes(field),
        );
      if (touched)
        void queries.invalidateQueries({ queryKey: ["profile", event.id] });
    };
    current.events.on("event", onEvent);
    onCleanup(() => current.events.off("event", onEvent));
  });

  return null;
}
