import { Trans } from "@lingui/solid/macro";

import { Icon } from "@revolt/ui/icons/Icon";

import { BadgeTag } from "./badges/BadgeMark";

/**
 * Marks an official account next to its name (messages, the conversation
 * header and its profile), so people can tell it from someone pretending to
 * be Zrzur.
 */
export function OfficialLabel() {
  return (
    <BadgeTag icon={<Icon name="shield-check" size={12} />}>
      <Trans>Official</Trans>
    </BadgeTag>
  );
}
