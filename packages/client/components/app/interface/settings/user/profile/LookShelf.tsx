import { For, Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { saveData } from "@revolt/common/lib/saveData";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { Avatar } from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { isCommunityRef } from "@revolt/ui/components/features/profiles/userStyle";
import { communityShownUrl } from "@revolt/ui/components/features/profiles/userStyleExtras";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type CommunityCreator,
  type CommunityItem,
  type CommunityKind,
  communityApi,
  communityParams,
  creatorName,
} from "./communityApi";
import { NameplateArt } from "./CommunityParts";

/** The real name of a design (`c:<id>`), once it is known */
export function useDesignName(ref: () => string | undefined) {
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

/** How many designs a row shows; the Designs page has the rest */
const SHOWN = 7;

/**
 * A few designs people published, to wear one: under the row that opened
 * it in the Look section. The most popular few only, kept for a while, so
 * it opens at once and costs little; everything else is a tap away on the
 * Designs page. Picking one puts it on the look being edited at once (the
 * profile preview shows it); Save keeps it. None takes it off.
 */
export function LookShelf(props: {
  kind: CommunityKind;
  /** `c:<id>` worn in the look being edited */
  value?: string;
  /** its file */
  file?: string;
  /** whose look: their name and avatar draw the previews */
  name: string;
  avatar?: string;
  onPick: (ref: string | undefined, file?: string) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const navigate = useNavigate();
  const { pop } = useModals();

  // the same few for every row that opens again: no new request for five
  // minutes, and none at all while it is closed
  const shelf = useQuery(() => ({
    queryKey: ["look-shelf", props.kind],
    staleTime: 5 * 60_000,
    queryFn: () =>
      communityApi.list(
        client(),
        props.kind,
        communityParams("popular", "", 0, SHOWN),
      ),
  }));
  const items = () => shelf.data?.items ?? [];
  const creators = () => {
    const byId: Record<string, CommunityCreator> = {};
    for (const creator of shelf.data?.creators ?? [])
      byId[creator._id] = creator;
    return byId;
  };

  const ref = (item: CommunityItem) => `c:${item._id}`;
  /** the design worn now, first, when it is not among the popular few */
  const wornElsewhere = () =>
    isCommunityRef(props.value) &&
    !items().some((item) => ref(item) === props.value)
      ? props.value
      : undefined;
  const wornName = useDesignName(() => wornElsewhere());

  /** the whole gallery of this kind, on the Designs page */
  function openDesigns() {
    pop();
    navigate(`/designs/${props.kind}`);
  }

  /** how a design looks on this person: their avatar, their name */
  const Art = (art: { file?: string; design: string }) => {
    const url = () =>
      communityShownUrl(
        instance.mediaUrl,
        props.kind === "decorations"
          ? "Decoration"
          : props.kind === "nameplates"
            ? "Nameplate"
            : props.kind === "effects"
              ? "Effect"
              : "Frame",
        art.file,
        // pictures in a list are stills: the preview beside it moves
        props.kind === "effects" || props.kind === "frames" || saveData(),
      ) ?? "";
    return (
      <Switch>
        <Match when={props.kind === "decorations"}>
          <AvatarDecoration decoration={art.design} file={art.file} size={52}>
            <Avatar size={52} src={props.avatar} fallback={props.name} />
          </AvatarDecoration>
        </Match>
        <Match when={props.kind === "nameplates"}>
          <NameplateArt
            url={url()}
            avatar={props.avatar}
            name={props.name}
            small
          />
        </Match>
        <Match when={url()}>
          <img
            src={url()}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </Match>
      </Switch>
    );
  };

  return (
    <Shelf data-kind={props.kind}>
      <Grid aria-busy={shelf.isLoading}>
        {/* take it off */}
        <Tile
          type="button"
          aria-pressed={!props.value}
          onClick={() => props.onPick(undefined)}
        >
          <Picture data-none>
            <Icon name="prohibit" size={24} />
          </Picture>
          <Name>
            <Trans>None</Trans>
          </Name>
        </Tile>

        <Show when={wornElsewhere()}>
          {(worn) => (
            <Tile type="button" aria-pressed>
              <Picture>
                <Art design={worn()} file={props.file} />
              </Picture>
              <Name>{wornName() ?? t`Wearing now`}</Name>
              <Maker>
                <Trans>Wearing now</Trans>
              </Maker>
              <Tick />
            </Tile>
          )}
        </Show>

        <For each={items()}>
          {(item) => (
            <Tile
              type="button"
              aria-pressed={props.value === ref(item)}
              onClick={() => props.onPick(ref(item), item.file._id)}
            >
              <Picture>
                <Art design={ref(item)} file={item.file._id} />
              </Picture>
              <Name title={item.name}>
                <bdi>{item.name}</bdi>
              </Name>
              <Maker>
                <bdi>{creatorName(creators()[item.creator_id])}</bdi>
              </Maker>
              <Show when={props.value === ref(item)}>
                <Tick />
              </Show>
            </Tile>
          )}
        </For>

        {/* while they load: the places they will take */}
        <Show when={shelf.isLoading}>
          <For each={[0, 1, 2]}>{() => <Ghost aria-hidden="true" />}</For>
        </Show>

        {/* everything else, with search and favourites, on the Designs page */}
        <Show when={!shelf.isLoading}>
          <Tile type="button" data-more onClick={openDesigns}>
            <Picture data-none>
              <Icon name="arrow-right" size={22} class="go" />
            </Picture>
            <Name>
              <Trans>All in Designs</Trans>
            </Name>
          </Tile>
        </Show>
      </Grid>

      <Switch>
        <Match when={shelf.isError}>
          <Status role="alert">
            <Trans>Designs couldn't load.</Trans>
            <button type="button" onClick={() => void shelf.refetch()}>
              <Trans>Try again</Trans>
            </button>
          </Status>
        </Match>
        <Match when={shelf.isSuccess && !items().length}>
          <Status>
            <Trans>Nobody has published one yet.</Trans>
          </Status>
        </Match>
      </Switch>
    </Shelf>
  );
}

/** the check on the design worn */
function Tick() {
  return (
    <Check aria-hidden="true">
      <Icon name="check" size={12} />
    </Check>
  );
}

const Shelf = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    "--tile": "112px",
    "&[data-kind=nameplates]": { "--tile": "220px" },
    "&[data-kind=effects]": { "--tile": "104px" },
    "&[data-kind=frames]": { "--tile": "140px" },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(var(--tile), 1fr))",
    gap: "8px",
    maxHeight: "min(440px, 55dvh)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "2px",
  },
});

const Tile = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    padding: "10px 8px 8px",
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "var(--z-radius-md, 12px)",
    background: "var(--z-bg-app)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    cursor: "pointer",
    transition:
      "border-color var(--z-motion-fast, 120ms) ease, transform var(--z-motion-fast, 120ms) ease",
    _hover: { borderColor: "var(--z-border-strong)" },
    _active: { transform: "scale(0.98)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "&[data-more]": {
      borderStyle: "dashed",
      background: "transparent",
      color: "var(--z-fg-secondary)",
      _hover: { color: "var(--z-fg-primary)" },
    },
    "&[aria-pressed=true]": {
      borderColor: "var(--z-accent)",
      boxShadow: "0 0 0 1px var(--z-accent)",
    },
  },
});

const Picture = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    overflow: "hidden",
    height: "76px",
    "--z-icon-color": "var(--z-fg-muted)",
    "[data-kind=nameplates] &": { height: "48px" },
    "[data-kind=effects] &": {
      height: "120px",
      "& > img": {
        width: "auto",
        height: "100%",
        aspectRatio: "9 / 16",
        objectFit: "cover",
      },
    },
    "[data-kind=frames] &": { height: "120px" },
    // the picture keeps to its place, whatever its shape
    "& > img": {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      borderRadius: "var(--z-radius-sm, 8px)",
    },
    "& > *": { maxWidth: "100%" },
  },
});

const Name = styled("span", {
  base: {
    maxWidth: "100%",
    fontSize: "13px",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Maker = styled("span", {
  base: {
    maxWidth: "100%",
    marginBlockStart: "-2px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Check = styled("span", {
  base: {
    // the opposite corner to the heart
    position: "absolute",
    top: "6px",
    insetInlineEnd: "6px",
    display: "grid",
    placeItems: "center",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "var(--z-accent)",
    color: "var(--z-accent-text, white)",
    "--z-icon-color": "currentColor",
  },
});

const Ghost = styled("span", {
  base: {
    height: "120px",
    borderRadius: "var(--z-radius-md, 12px)",
    background: "var(--z-bg-app)",
    animation: "skeletonPulse 1.2s ease-in-out infinite",
    "[data-kind=effects] &": { height: "166px" },
    "[data-kind=frames] &": { height: "166px" },
    "[data-kind=nameplates] &": { height: "92px" },
  },
});

const Status = styled("p", {
  base: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "& button": {
      border: "none",
      background: "transparent",
      color: "var(--z-link)",
      font: "inherit",
      cursor: "pointer",
      padding: 0,
    },
  },
});
