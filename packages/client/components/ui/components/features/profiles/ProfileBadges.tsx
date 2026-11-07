import { useLingui } from "@lingui/solid/macro";
import { User } from "@zrzur/sdk/solid";

import { BadgeList } from "./badges/BadgeMark";
import { AnyBadgeId, badgesFromBits } from "./badges/catalog";

/**
 * Badges next to the name on profiles and the profile popover. They come
 * from `User.badges`, which only the server writes; bots show none.
 */
export function ProfileBadges(props: { ids: AnyBadgeId[] }) {
  const { t } = useLingui();

  return (
    <BadgeList
      ids={props.ids}
      label={t`Profile badges`}
      mode="press"
      size="sm"
    />
  );
}

/** A person's badges, most important first */
export function profileBadgeIds(user: User) {
  if (user.bot) return [];
  return badgesFromBits(user.badges || 0)
    .sort((a, b) => a.priority - b.priority)
    .map((meta) => meta.id);
}
