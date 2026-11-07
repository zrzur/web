import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { ProfileSection } from "@revolt/ui/components/features/profiles/ProfileCard";
import {
  ProfileTiles,
  ProfileTilesMore,
  TilePlate,
} from "@revolt/ui/components/features/profiles/ProfileTiles";
import {
  communityStillUrl,
  effectStillUrl,
} from "@revolt/ui/components/features/profiles/userStyle";

import { type CommunityItem, communityApi, hasOpenPage } from "./communityApi";
import { useCreatorProfile } from "./creatorProfile";

/**
 * "Their creations" on a profile: a row of equal tiles with the design's real
 * image, its name and Free, each leading to its page. See all goes to the
 * creator's page where one is open; a closed page opens the rest here. The
 * profile's `creator` field decides whether this section shows at all.
 */
export default function CommunityCreations(props: {
  userId: string;
  /** Called when a link leaves the profile */
  onLeave?: () => void;
}) {
  const instance = useInstance();
  const navigate = useNavigate();
  const client = useClient();

  const page = useCreatorProfile(() => props.userId);
  const creations = useQuery(() => ({
    queryKey: ["community-creations", props.userId],
    queryFn: () =>
      communityApi.creations(client(), props.userId).catch(() => []),
  }));
  const items = () => creations.data ?? [];
  const openPage = () => hasOpenPage(page()?.creator);
  const image = (id: string) => communityStillUrl(instance.mediaUrl, id);
  const [all, setAll] = createSignal(false);

  function go(path: string) {
    navigate(path);
    props.onLeave?.();
  }

  function more() {
    if (openPage()) go(`/designs/creator/${props.userId}`);
    else setAll(!all());
  }

  const picture = (item: CommunityItem) => {
    if (item.kind === "Decoration")
      return (
        <img
          src={image(item.file._id)}
          alt=""
          loading="lazy"
          draggable={false}
        />
      );
    if (item.kind === "Effect")
      return (
        <img
          src={effectStillUrl(instance.mediaUrl, item.file._id)}
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          draggable={false}
        />
      );
    return (
      <TilePlate
        class="z-plate z-plate-tile"
        style={{ "--plate": `url("${image(item.file._id)}") center / cover` }}
      />
    );
  };

  const tiles = () =>
    items().map((item) => ({
      key: item._id,
      name: item.name,
      note: <Trans>Free</Trans>,
      onPress: () => go(`/designs/${item._id}`),
      picture: picture(item),
    }));

  return (
    <Show when={items().length}>
      <ProfileSection
        title={<Trans>Their creations</Trans>}
        action={
          <ProfileTilesMore
            count={items().length}
            open={all()}
            leaves={openPage()}
            onPress={more}
          />
        }
      >
        <ProfileTiles tiles={tiles()} all={all()} />
      </ProfileSection>
    </Show>
  );
}
