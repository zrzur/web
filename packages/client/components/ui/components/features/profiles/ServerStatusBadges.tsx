import { useLingui } from "@lingui/solid/macro";
import { ServerFlags } from "@zrzur/sdk/solid";

import { BadgeList, BadgeMode } from "./badges/BadgeMark";
import { AnyBadgeId, BadgeSize } from "./badges/catalog";

/** Status badges of a server. Only trusted server flags are displayed. */
export function ServerStatusBadges(props: {
  flags: number;
  size?: BadgeSize;
  mode?: BadgeMode;
}) {
  const { t } = useLingui();
  const ids = () => {
    const list: AnyBadgeId[] = [];
    if (props.flags & ServerFlags.Official) list.push("server_official");
    if (props.flags & ServerFlags.Verified) list.push("server_verified");
    return list;
  };

  return (
    <BadgeList
      ids={ids()}
      label={t`Server badges`}
      size={props.size}
      mode={props.mode}
    />
  );
}
