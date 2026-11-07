import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useNameFontLabel } from "@revolt/app/interface/settings/user/profile/StyleEditors";
import { type CommunityItem } from "@revolt/app/interface/settings/user/profile/communityApi";
import { useClient } from "@revolt/client";
import { Segmented } from "@revolt/ui";
import {
  DECORATIONS,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { FlockStage } from "./FlockStage";
import { StyleCard, useVibeText } from "./Looks";
import { MemberRow, WornAvatar } from "./Scenes";
import {
  Wall,
  WallEmpty,
  WallHolders,
  useCommunity,
  useGalleryTiles,
} from "./Wall";
import type { WallFilter } from "./gallery";

/** names of the name fonts */
export const useFontLabel = useNameFontLabel;

/**
 * The gallery: one sky, one wall. There is no separate fitting room: every
 * design on every page tries on with a tap, and it lands on you in the dock.
 * With a filter or a search the sky steps aside and the wall comes first.
 */
export function DesignsHome(props: {
  filter: WallFilter;
  onFilter: (filter: WallFilter) => void;
  query: string;
  onQuery: (value: string) => void;
  version: number;
  onOpen: (item: CommunityItem) => void;
  onDesign: (slug: string) => void;
  onMaker: (id: string) => void;
}) {
  const { t } = useLingui();
  const vibeText = useVibeText();

  const [mood, setMood] = createSignal<string>();
  const [sort, setSort] = createSignal<"popular" | "new">("popular");
  const community = useCommunity(() => ({
    query: props.query,
    sort: sort(),
    version: props.version,
  }));
  const tiles = useGalleryTiles({
    filter: () => props.filter,
    mood,
    query: () => props.query,
    community,
  });
  const quiet = () => props.filter === "all" && !props.query.trim() && !mood();

  const kinds = (): { id: WallFilter; label: string }[] => [
    { id: "all", label: t`Everything` },
    { id: "looks", label: t`Looks` },
    { id: "decorations", label: t`Decorations` },
    { id: "nameplates", label: t`Nameplates` },
    { id: "effects", label: t`Effects` },
    { id: "colours", label: t`Colours` },
    { id: "name", label: t`Name` },
    { id: "community", label: t`Community` },
  ];

  return (
    <>
      <Show
        when={quiet()}
        fallback={
          <Hidden>
            <Trans>Designs</Trans>
          </Hidden>
        }
      >
        <FlockStage
          lit={Object.keys(community.creators()).length + 1}
          title={<Trans>Pick a bird. Wear its colours.</Trans>}
          text={
            <Trans>
              Every bird in this flock is a design for your Zrzur profile. Tap
              one and it lands on you.
            </Trans>
          }
        />
      </Show>

      <Layout>
        <div>
          <Kinds aria-label={t`Kinds of designs`}>
            <For each={kinds()}>
              {(kind) => (
                <button
                  type="button"
                  aria-current={
                    props.filter === kind.id && !mood() ? "true" : undefined
                  }
                  onClick={() => {
                    setMood(undefined);
                    props.onFilter(kind.id);
                  }}
                >
                  {kind.label}
                </button>
              )}
            </For>
            <Show when={mood()}>
              {(current) => (
                <button
                  type="button"
                  aria-current="true"
                  aria-label={t`Remove filter ${vibeText(current())}`}
                  onClick={() => setMood(undefined)}
                >
                  {vibeText(current())}
                  <Icon name="x" size={16} />
                </button>
              )}
            </Show>
            <Show when={community.items().length > 1}>
              <SortSpot>
                <Segmented
                  aria-label={t`Sort`}
                  value={sort()}
                  onChange={setSort}
                  options={[
                    { value: "popular", label: t`Most worn` },
                    { value: "new", label: t`Newest` },
                  ]}
                />
              </SortSpot>
            </Show>
          </Kinds>

          <Show
            when={tiles().length}
            fallback={
              <Show when={!community.loading()} fallback={<WallHolders />}>
                <WallEmpty
                  failed={community.failed()}
                  waiting={props.filter === "community" && !props.query.trim()}
                  onRetry={community.retry}
                  onClear={() => {
                    props.onQuery("");
                    setMood(undefined);
                    props.onFilter("all");
                  }}
                />
              </Show>
            }
          >
            <Wall
              tiles={tiles()}
              more={community.more()}
              loading={community.loading()}
              onMore={community.next}
              onOpen={props.onOpen}
              onDesign={props.onDesign}
              onMaker={props.onMaker}
              onMood={(next) => {
                setMood(next);
                props.onFilter("all");
              }}
            />
          </Show>
        </div>
      </Layout>
    </>
  );
}

/** Your profile card as it is now */
export function WornCard() {
  const client = useClient();
  const worn = () => userStyleOf(client().user) ?? {};
  return <StyleCard style={worn()} />;
}

/**
 * Real designs on a sample avatar, for places that have nothing of their own
 * yet: three frames you could save, or what a creator makes
 */
export function Samples(props: { kind: "saved" | "made" }) {
  return (
    <SampleRow aria-hidden="true">
      <Show
        when={props.kind === "saved"}
        fallback={
          <>
            <WornAvatar size={64} style={{ decoration: DECORATIONS[1] }} />
            <SamplePlate>
              <MemberRow style={{ nameplate: "ocean" }} />
            </SamplePlate>
          </>
        }
      >
        <For each={[DECORATIONS[0], DECORATIONS[4], DECORATIONS[6]]}>
          {(decoration) => <WornAvatar size={64} style={{ decoration }} />}
        </For>
      </Show>
    </SampleRow>
  );
}

const Hidden = styled("h1", {
  base: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
  },
});

/** the wall and, on wide screens, the column beside it */
const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "24px",
    alignItems: "start",
    "& > div:first-child": {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      minWidth: 0,
    },
  },
});

/** the kinds as big words: the current one lit, the rest in the dark */
const Kinds = styled("nav", {
  base: {
    position: "sticky",
    top: "64px",
    zIndex: 3,
    display: "flex",
    gap: "4px 24px",
    minWidth: 0,
    marginBlock: "8px 0",
    paddingBlock: "4px",
    overflowX: "auto",
    scrollbarWidth: "none",
    background: "var(--z-designs-page)",
    "&::-webkit-scrollbar": { display: "none" },
    "& > button": {
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      minHeight: "44px",
      padding: 0,
      border: "none",
      background: "none",
      color: "var(--z-fg-muted)",
      font: "inherit",
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
      whiteSpace: "nowrap",
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      transition: "color 120ms cubic-bezier(0.2, 0, 0, 1)",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
        borderRadius: "6px",
      },
      _phone: { fontSize: "18px", lineHeight: "26px" },
    },
    "& > button[aria-current]": { color: "var(--z-fg-primary)" },
    _phone: {
      top: 0,
      marginInline: "-16px",
      paddingInline: "16px",
      gap: "16px",
    },
  },
});

/** the order sits at the far end of the same row, never a row of its own */
const SortSpot = styled("div", {
  base: {
    flexShrink: 0,
    alignSelf: "center",
    marginInlineStart: "auto",
    _phone: { "& button": { minHeight: "44px" } },
  },
});

const SampleRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "32px",
  },
});

const SamplePlate = styled("div", { base: { width: "220px", minWidth: 0 } });
