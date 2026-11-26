import { Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { User, UserProfile } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { ProfileSection } from "@revolt/ui/components/features/profiles/ProfileCard";
import {
  type ProfileTile,
  ProfileTiles,
  ProfileTilesMore,
} from "@revolt/ui/components/features/profiles/ProfileTiles";
import {
  WornDecoration,
  WornEffect,
  WornFrame,
  WornName,
  WornPlate,
  communityId,
  wearsNameStyle,
} from "@revolt/ui/components/features/profiles/WornPreviews";
import { useEffectLabels } from "@revolt/ui/components/features/profiles/labels";
import { useTilesShown } from "@revolt/ui/components/features/profiles/profileSize";
import {
  isCommunityRef,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";

import { communityApi } from "./communityApi";
import { useNameFontLabel, useStyleLabels } from "./styleLabels";

/** The real name of a design someone wears, once it is known */
function useDesignName(ref: () => string | undefined) {
  const client = useClient();
  const query = useQuery(() => ({
    queryKey: ["community-item", ref()],
    enabled: isCommunityRef(ref()),
    queryFn: () =>
      communityApi
        .details(client(), ref()!.slice(2))
        .then((details) => details.item.name)
        .catch(() => null),
  }));
  return () => query.data ?? undefined;
}

/** The page of a worn design (every one is a creator's, `c:<id>`) */
const designPage = (ref: string) => `/designs/${ref.slice(2)}`;

/**
 * What a creator has on, each design drawn as it really looks on them (see
 * WornPreviews): the nameplate as a row of its own behind their name, then
 * the square designs side by side. Each keeps its name and kind and opens
 * its design. The profile's `creator` field decides whether it shows.
 */
export default function ProfileWearing(props: {
  user: User;
  /** Called when an item leaves the profile */
  onLeave?: () => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const queries = useQueryClient();
  const labels = useStyleLabels();
  const fontLabel = useNameFontLabel();
  const effect = useEffectLabels();
  const perRow = useTilesShown();

  const style = () => userStyleOf(props.user);
  const decorationName = useDesignName(() => style()?.decoration);
  const nameplateName = useDesignName(() => style()?.nameplate);
  const effectName = useDesignName(() => style()?.effect);
  const frameName = useDesignName(() => style()?.profile_frame);

  const wearer = () => ({
    name: props.user.displayName ?? props.user.username,
    avatar: props.user.animatedAvatarURL,
  });
  // the banner of the profile this is drawn in, already loaded with it
  const banner = () =>
    queries.getQueryData<UserProfile>(["profile", props.user.id])
      ?.animatedBannerURL;

  const [all, setAll] = createSignal(false);

  const worn = createMemo(() => {
    const current = style();
    const items: (Omit<ProfileTile, "key" | "onPress" | "note"> & {
      kind: string;
      path: string;
    })[] = [];
    if (!current) return items;

    if (current.nameplate) {
      items.push({
        kind: t`Nameplate`,
        name: nameplateName() ?? labels.nameplate(current.nameplate),
        path: designPage(current.nameplate),
        wide: true,
        picture: <WornPlate look={current} wearer={wearer()} />,
      });
    }
    if (current.decoration) {
      items.push({
        kind: t`Decoration`,
        name: decorationName() ?? labels.decoration(current.decoration),
        path: designPage(current.decoration),
        picture: <WornDecoration look={current} wearer={wearer()} />,
      });
    }
    if (current.profile_frame) {
      const id = communityId(current.profile_frame);
      items.push({
        kind: t`Profile frame`,
        name: frameName() ?? labels.frame(current.profile_frame),
        path: id ? `/designs/${id}` : "/designs/frames",
        picture: (
          <WornFrame look={current} wearer={wearer()} banner={banner()} />
        ),
      });
    }
    if (current.effect) {
      const id = communityId(current.effect);
      items.push({
        kind: t`Effect`,
        name: effectName() ?? effect(current.effect),
        path: id ? `/designs/${id}` : "/designs/effects",
        picture: <WornEffect look={current} />,
      });
    }
    if (wearsNameStyle(current)) {
      const font =
        current.name_font && current.name_font !== "default"
          ? current.name_font
          : undefined;
      items.push({
        kind: t`Name style`,
        name: font
          ? fontLabel(font)
          : current.name_colour?.length
            ? t`Colours`
            : fontLabel("default"),
        path: font ? "/designs/name" : "/designs/colours",
        picture: <WornName look={current} wearer={wearer()} />,
      });
    }
    return items;
  });

  const tiles = (): ProfileTile[] =>
    worn().map((item) => ({
      key: item.kind,
      name: item.name,
      note: item.kind,
      wide: item.wide,
      picture: item.picture,
      onPress: () => {
        navigate(item.path);
        props.onLeave?.();
      },
    }));

  // Show more counts the square designs: a wide one always has its own row
  const square = () => worn().filter((item) => !item.wide).length;

  return (
    <Show when={worn().length}>
      <ProfileSection
        title={<Trans>Wearing</Trans>}
        action={
          <ProfileTilesMore
            count={square()}
            open={all()}
            onPress={() => setAll(!all())}
          />
        }
      >
        <ProfileTiles tiles={tiles()} all={all() || square() <= perRow()} />
      </ProfileSection>
    </Show>
  );
}
