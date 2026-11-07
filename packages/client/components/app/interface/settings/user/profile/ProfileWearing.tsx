import { Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { User } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { Avatar } from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { useDesignMotion } from "@revolt/ui/components/features/profiles/NameplateMotion";
import { ProfileSection } from "@revolt/ui/components/features/profiles/ProfileCard";
import {
  type ProfileTile,
  ProfileTiles,
  ProfileTilesMore,
  TilePlate,
} from "@revolt/ui/components/features/profiles/ProfileTiles";
import { EffectStill } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import { isEffectId } from "@revolt/ui/components/features/profiles/effects/effectIds";
import { useEffectLabels } from "@revolt/ui/components/features/profiles/labels";
import {
  effectStillUrl,
  isCommunityRef,
  nameplateBackground,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";

import { useStyleLabels } from "./StyleEditors";
import { communityApi } from "./communityApi";

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

/** The page of a worn design: its own, or the built-in one's */
const designPage = (kind: "decoration" | "nameplate", ref: string) =>
  isCommunityRef(ref) ? `/designs/${ref.slice(2)}` : `/designs/${kind}-${ref}`;

/**
 * What a creator has on, in the same tiles as their creations: the real item,
 * its name and its kind. The profile's `creator` field decides whether it
 * shows.
 */
export default function ProfileWearing(props: {
  user: User;
  /** Called when an item leaves the profile */
  onLeave?: () => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const instance = useInstance();
  const motion = useDesignMotion();
  const labels = useStyleLabels();
  const effect = useEffectLabels();

  const style = () => userStyleOf(props.user);
  const decorationName = useDesignName(() => style()?.decoration);
  const nameplateName = useDesignName(() => style()?.nameplate);
  const effectName = useDesignName(() => style()?.effect);

  const [all, setAll] = createSignal(false);

  const worn = createMemo(() => {
    const current = style();
    const plate = nameplateBackground(current, instance.mediaUrl, {
      moving: motion(),
    });
    const effectId = current?.effect;
    const items: (Omit<ProfileTile, "key" | "onPress" | "note"> & {
      kind: string;
      path: string;
    })[] = [];

    if (current?.decoration) {
      items.push({
        kind: t`Decoration`,
        name: decorationName() ?? labels.decoration(current.decoration),
        path: designPage("decoration", current.decoration),
        picture: (
          <AvatarDecoration
            decoration={current.decoration}
            file={current.decoration_file}
            size={40}
          >
            <Avatar
              src={props.user.animatedAvatarURL}
              fallback={props.user.displayName}
              size={40}
            />
          </AvatarDecoration>
        ),
      });
    }
    if (current?.nameplate) {
      items.push({
        kind: t`Nameplate`,
        name: nameplateName() ?? labels.nameplate(current.nameplate),
        path: designPage("nameplate", current.nameplate),
        picture: (
          <TilePlate
            class="z-plate z-plate-tile"
            style={{ "--plate": plate }}
          />
        ),
      });
    }
    if (effectId) {
      items.push({
        kind: t`Effect`,
        name: effectName() ?? effect(effectId),
        path: isCommunityRef(effectId)
          ? `/designs/${effectId.slice(2)}`
          : "/designs/effects",
        picture: (
          <Show
            when={isEffectId(effectId)}
            fallback={
              <Show when={current?.effect_file}>
                {(file) => (
                  <img
                    src={effectStillUrl(instance.mediaUrl, file())}
                    alt=""
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    draggable={false}
                  />
                )}
              </Show>
            }
          >
            <EffectStill effect={effectId as never} />
          </Show>
        ),
      });
    }
    return items;
  });

  const tiles = (): ProfileTile[] =>
    worn().map((item) => ({
      key: item.kind,
      name: item.name,
      note: item.kind,
      picture: item.picture,
      onPress: () => {
        navigate(item.path);
        props.onLeave?.();
      },
    }));

  return (
    <Show when={worn().length}>
      <ProfileSection
        title={<Trans>Wearing</Trans>}
        action={
          <ProfileTilesMore
            count={worn().length}
            open={all()}
            onPress={() => setAll(!all())}
          />
        }
      >
        <ProfileTiles tiles={tiles()} all={all()} />
      </ProfileSection>
    </Show>
  );
}
