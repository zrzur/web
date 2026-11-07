import {
  CommunityImage,
  DecorationArt,
  NameplateArt,
} from "@revolt/app/interface/settings/user/profile/CommunityParts";
import type { CommunityItem } from "@revolt/app/interface/settings/user/profile/communityApi";

import { useWearer } from "./Scenes";

/**
 * A community design on the viewer's own avatar (decoration) or name
 * (nameplate); a visitor without an account sees it on a blank avatar
 */
export function Preview(props: {
  item: CommunityItem;
  size: number;
  large?: boolean;
  /** shown when nobody is signed in */
  sampleName?: string;
}) {
  const wearer = useWearer();
  const name = () =>
    wearer.real() ? wearer.name() : (props.sampleName ?? wearer.name());
  return (
    <CommunityImage item={props.item}>
      {(url) =>
        props.item.kind === "Decoration" ? (
          <DecorationArt
            url={url}
            avatar={wearer.avatar()}
            name={name()}
            size={props.size}
          />
        ) : (
          <NameplateArt
            url={url}
            avatar={wearer.avatar()}
            name={name()}
            small={!props.large}
          />
        )
      }
    </CommunityImage>
  );
}
