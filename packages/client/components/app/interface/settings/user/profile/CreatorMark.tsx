import { Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { User } from "@zrzur/sdk/solid";

import { Icon } from "@revolt/ui/icons/Icon";

/**
 * The mark right after a name, only for someone with the creator rank. Reads
 * the profile's `creator` field, the same answer the profile sections use.
 */
export default function CreatorMark(props: { user: User }) {
  const { t } = useLingui();
  const profile = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => props.user.fetchProfile(),
  }));

  return (
    <Show when={profile.data?.creator}>
      <span
        role="img"
        aria-label={t`Verified creator`}
        use:floating={{
          tooltip: { placement: "top", content: t`Verified creator` },
        }}
        style={{ display: "inline-flex", "flex-shrink": 0 }}
      >
        <Icon name="seal-check" size={18} />
      </span>
    </Show>
  );
}
