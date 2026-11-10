import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
} from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  CommunityImage,
  DecorationArt,
  useCreatorAvatar,
} from "@revolt/app/interface/settings/user/profile/CommunityParts";
import {
  type CommunityItem,
  communityApi,
  creatorName,
} from "@revolt/app/interface/settings/user/profile/communityApi";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Avatar, Button } from "@revolt/ui";
import { Sky } from "@revolt/ui/components/design/Sky";
import { DECORATIONS } from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { MemberRow, WornAvatar, useCast } from "./Scenes";
import { ShowMore, usePaged } from "./ShowMore";
import { Wall, useCommunity, useCommunityTiles, wearOf } from "./Wall";
import type { Wear } from "./gallery";
import { Notice } from "./parts";
import { type RankedCreator, mergePages, rankCreators } from "./rank";

/** where the pieces sit around a maker, as a share of the nest */
const orbit = (i: number, count: number) => {
  const turn = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(turn) * 40, y: 50 + Math.sin(turn) * 40 };
};

/**
 * One maker: a nest in the sky. They sit in the middle in their best frame,
 * and what they made circles them. Works with one design and with many.
 */
function Nest(props: {
  face: JSX.Element;
  name: JSX.Element;
  line: JSX.Element;
  works: Wear[];
  first?: boolean;
  onClick?: () => void;
  open?: boolean;
}) {
  const cast = useCast();
  return (
    <NestBase
      type="button"
      data-first={props.first}
      data-open={props.open}
      disabled={!props.onClick}
      onClick={() => props.onClick?.()}
    >
      <Ring aria-hidden="true">
        <For each={props.works}>
          {(wear, i) => {
            const at = () => orbit(i(), props.works.length);
            return (
              <Piece
                data-plate={!!wear.nameplate}
                style={{
                  left: `${at().x}%`,
                  top: `${at().y}%`,
                  "--wobble": `${(i() % 3) * 40}ms`,
                }}
              >
                <Show
                  when={wear.nameplate}
                  fallback={
                    <WornAvatar
                      size={72}
                      style={wear}
                      person={cast.all()[(i() + 2) % cast.all().length]}
                    />
                  }
                >
                  <MemberRow
                    style={wear}
                    person={cast.all()[(i() + 2) % cast.all().length]}
                  />
                </Show>
              </Piece>
            );
          }}
        </For>
        <Face>{props.face}</Face>
      </Ring>
      <strong>{props.name}</strong>
      <small>{props.line}</small>
    </NestBase>
  );
}

/** The creators as a sky of nests: every lit bird is someone who draws */
export function CreatorsScene(props: {
  version: number;
  onCreator: (id: string) => void;
  onGallery: () => void;
  onStudio?: () => void;
  /** a suspended creator can't publish, so no spot is held for them */
  paused?: boolean;
}) {
  const { t } = useLingui();
  const avatar = useCreatorAvatar();
  const community = useCommunity(() => ({
    sort: "popular",
    version: props.version,
  }));
  const ranked = createMemo(() =>
    rankCreators(
      mergePages([
        {
          items: community.items(),
          creators: Object.values(community.creators()),
        },
      ]),
    ),
  );

  // a nest holds up to six worn designs: twelve nests are about two screens
  const paged = usePaged(() => ranked(), {
    // ranks move as pages arrive: only a shorter list starts again
    key: () => "creators",
    more: community.more,
    loading: community.loading,
    onMore: community.next,
    page: 12,
  });

  const face = (entry: RankedCreator) => {
    const frame = entry.shelf.find((item) => item.kind === "Decoration");
    return (
      <Show
        when={frame}
        fallback={<Avatar size={112} src={avatar(entry.creator)} />}
      >
        {(item) => (
          <CommunityImage item={item()}>
            {(url) => (
              <DecorationArt
                url={url}
                avatar={avatar(entry.creator)}
                name={creatorName(entry.creator)}
                size={112}
              />
            )}
          </CommunityImage>
        )}
      </Show>
    );
  };

  return (
    <Scene>
      <SkyBand>
        <Sky lit={ranked().length + 1} />
      </SkyBand>
      <Head>
        <h1>
          <Trans>The people behind the designs</Trans>
        </h1>
        <p>
          <Trans>
            Every lit bird in this sky is someone who draws for Zrzur.
          </Trans>
        </p>
      </Head>
      <Nests>
        <For each={paged.shown()}>
          {(entry, i) => (
            <Nest
              first={i() === 0}
              face={face(entry)}
              name={
                <>
                  <bdi>{creatorName(entry.creator)}</bdi>
                  <Show when={entry.creator.verified}>
                    <span title={t`Verified creator`}>
                      <Icon name="seal-check" size={20} />
                    </span>
                  </Show>
                </>
              }
              line={
                <>
                  <Plural
                    value={entry.designs}
                    one="# design"
                    other="# designs"
                  />
                  <span aria-hidden="true"> · </span>
                  <Trans>Worn by {entry.uses}</Trans>
                </>
              }
              works={entry.shelf.map(wearOf)}
              onClick={
                entry.creator.open_page
                  ? () => props.onCreator(entry.creator._id)
                  : undefined
              }
            />
          )}
        </For>
        <Nest
          first={!ranked().length}
          face={<WornAvatar size={112} style={{ decoration: "laurel" }} />}
          name={<Trans>The Zrzur team</Trans>}
          line={<Trans>Everything that ships with Zrzur</Trans>}
          works={DECORATIONS.slice(0, 6).map((decoration) => ({ decoration }))}
          onClick={() => props.onGallery()}
        />
        {/* the place held for the next one */}
        <Show when={!props.paused}>
          <Nest
            open
            face={<Empty aria-hidden="true" />}
            name={<Trans>Your spot</Trans>}
            line={<Trans>Publish a design and you show up here.</Trans>}
            works={[]}
            onClick={props.onStudio}
          />
        </Show>
      </Nests>
      <ShowMore state={paged.state()} onMore={paged.next} />
      <Show when={community.failed()}>
        <Notice
          role="alert"
          icon="warning-circle"
          title={<Trans>Designs couldn't be loaded</Trans>}
          action={{
            label: <Trans>Try again</Trans>,
            onClick: community.retry,
          }}
        />
      </Show>
    </Scene>
  );
}

/** One creator: their name set huge on their own art, then their wall */
export function CreatorPage(props: {
  id: string;
  version: number;
  onOpen: (item: CommunityItem) => void;
  onDesign: (slug: string) => void;
  onBack: () => void;
}) {
  const client = useClient();
  const avatar = useCreatorAvatar();
  const toTiles = useCommunityTiles();
  const { openModal } = useModals();
  const [data, { refetch }] = createResource(
    () => ({ id: props.id, v: props.version }),
    ({ id }) => communityApi.creator(client(), id),
  );
  const lookup = () =>
    data() ? { [data()!.creator._id]: data()!.creator } : {};
  const ranked = createMemo(() =>
    data()
      ? rankCreators({ items: data()!.items, creators: lookup() })[0]
      : undefined,
  );
  const tiles = createMemo(() =>
    data()
      ? toTiles(data()!.items, lookup()).map((tile, i) => ({
          ...tile,
          // the first work of a creator is always shown large
          big: i % 5 === 0,
        }))
      : [],
  );

  async function profile() {
    const user =
      client().users.get(props.id) ??
      (await client()
        .users.fetch(props.id)
        .catch(() => undefined));
    if (user) openModal({ type: "user_profile", user });
  }

  return (
    <Switch>
      <Match when={data.loading}>
        <Sign aria-busy="true" />
      </Match>
      <Match when={data.error}>
        <Notice
          role="alert"
          icon="warning-circle"
          title={<Trans>Designs couldn't be loaded</Trans>}
          action={{
            label: <Trans>Try again</Trans>,
            onClick: () => void refetch(),
          }}
        />
      </Match>
      <Match when={!data()}>
        <Notice
          icon="user-circle"
          title={<Trans>Creator not found</Trans>}
          action={{
            label: <Trans>All creators</Trans>,
            onClick: props.onBack,
          }}
        >
          <Trans>This creator has no published designs.</Trans>
        </Notice>
      </Match>
      <Match when={data()}>
        {(loaded) => (
          <>
            <Sign>
              <Show when={ranked()?.cover}>
                {(item) => (
                  <CommunityImage item={item()}>
                    {(url) => <img src={url} alt="" draggable={false} />}
                  </CommunityImage>
                )}
              </Show>
              <Show when={!ranked()?.cover}>
                <Sky lit={1} />
              </Show>
              <SignWords>
                <button type="button" onClick={() => props.onBack()}>
                  <Icon name="caret-left" size={16} />
                  <Trans>All creators</Trans>
                </button>
                <h1>
                  <bdi>{creatorName(loaded().creator)}</bdi>
                </h1>
              </SignWords>
            </Sign>
            <Facts>
              <Avatar size={56} src={avatar(loaded().creator)} />
              <div>
                <strong>
                  <bdi>{creatorName(loaded().creator)}</bdi>
                </strong>
                <span>
                  <Plural
                    value={loaded().items.length}
                    one="# design"
                    other="# designs"
                  />
                  <span aria-hidden="true"> · </span>
                  <Trans>Worn by {ranked()?.uses ?? 0}</Trans>
                </span>
              </div>
              <Button size="lg" variant="tonal" onPress={() => void profile()}>
                <Trans>View profile</Trans>
              </Button>
            </Facts>
            <Wall
              tiles={tiles()}
              onOpen={props.onOpen}
              onDesign={props.onDesign}
            />
          </>
        )}
      </Match>
    </Switch>
  );
}

export const Scene = styled("div", {
  base: {
    position: "relative",
    width: "100cqw",
    marginInlineStart: "calc(50% - 50cqw)",
    marginBlockStart: "-104px",
    minHeight: "calc(100dvh - 48px)",
    paddingBlock: "120px 96px",
    paddingInline: "max(16px, calc(50cqw - 560px))",
    boxSizing: "border-box",
    overflow: "hidden",
    background:
      "radial-gradient(90% 480px at 50% -120px, var(--z-designs-glow), transparent 70%), var(--z-designs-page)",
    _phone: { marginBlockStart: "-68px", paddingBlock: "80px 96px" },
  },
});

/** the sky stays the size it was drawn for, however long the page */
export const SkyBand = styled("div", {
  base: {
    position: "absolute",
    insetBlockStart: 0,
    insetInline: 0,
    height: "clamp(320px, 34cqw, 480px)",
  },
});

export const Head = styled("div", {
  base: {
    position: "relative",
    "& h1": {
      maxWidth: "12ch",
      margin: 0,
      fontSize: "clamp(48px, 9cqw, 120px)",
      lineHeight: 1,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--z-fg-primary)",
      "&:dir(rtl)": { letterSpacing: 0, lineHeight: "1.1" },
    },
    "& p": {
      margin: "16px 0 0",
      width: "min(84cqw, 480px)",
      fontSize: "18px",
      lineHeight: "26px",
      color: "var(--z-fg-secondary)",
    },
  },
});

/** two columns that do not line up, like birds that do not fly in rows */
const Nests = styled("div", {
  base: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "24px 40px",
    marginBlockStart: "40px",
    "& > :nth-child(even)": { marginBlockStart: "120px" },
    "@media (max-width: 899px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "32px",
      "& > :nth-child(even)": { marginBlockStart: 0 },
    },
  },
});

const NestBase = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    padding: 0,
    border: "none",
    borderRadius: "var(--z-shape-card, 14px)",
    background: "none",
    color: "var(--z-fg-primary)",
    font: "inherit",
    cursor: "pointer",
    "&:disabled": { cursor: "default" },
    "& strong": {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      maxWidth: "100%",
      fontSize: "clamp(28px, 4cqw, 44px)",
      lineHeight: 1.2,
      fontWeight: 700,
      "--z-icon-color": "var(--z-fg-secondary)",
    },
    "& small": {
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "4px",
    },
  },
});

/** the circle: it turns a little when you come near */
const Ring = styled("div", {
  base: {
    position: "relative",
    width: "min(100%, 400px)",
    aspectRatio: "1",
    transition: "transform 480ms cubic-bezier(0.2, 0, 0, 1)",
    // the line the work flies on
    "&::before": {
      content: "''",
      position: "absolute",
      inset: "10%",
      borderRadius: "50%",
      border: "1px dashed var(--z-designs-edge-hover)",
    },
    "button:hover > &": { transform: "rotate(10deg)" },
    "[data-first='true'] > &": { width: "min(100%, 520px)" },
    "[data-open='true'] > &": { width: "min(100%, 240px)" },
    _motionReduce: { "button:hover > &": { transform: "none" } },
  },
});

const Piece = styled("span", {
  base: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    transition: "transform 480ms cubic-bezier(0.2, 0, 0, 1)",
    transitionDelay: "var(--wobble)",
    "button:hover &": { transform: "translate(-50%, -50%) rotate(-10deg)" },
    "&[data-plate='true']": { width: "200px" },
    _motionReduce: {
      "button:hover &": { transform: "translate(-50%, -50%)" },
    },
    _phone: { "&[data-plate='true']": { width: "148px" } },
  },
});

const Face = styled("span", {
  base: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "grid",
    placeItems: "center",
    transition: "transform 480ms cubic-bezier(0.2, 0, 0, 1)",
    "button:hover &": { transform: "translate(-50%, -50%) rotate(-10deg)" },
    _motionReduce: {
      "button:hover &": { transform: "translate(-50%, -50%)" },
    },
  },
});

const Empty = styled("span", {
  base: {
    display: "block",
    width: "112px",
    height: "112px",
    borderRadius: "50%",
    border: "2px dashed var(--z-designs-edge-hover)",
  },
});

const Sign = styled("section", {
  base: {
    position: "relative",
    width: "100cqw",
    marginInlineStart: "calc(50% - 50cqw)",
    height: "clamp(240px, 44vh, 400px)",
    overflow: "hidden",
    background: "var(--z-designs-surface)",
    "& > img": {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
  },
});

/** on a solid plate: the cover may be any colour */
const SignWords = styled("div", {
  base: {
    position: "absolute",
    insetBlockEnd: 0,
    insetInline: "max(16px, calc(50cqw - 560px))",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    "& h1": {
      maxWidth: "100%",
      margin: 0,
      padding: "8px 16px 4px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "clamp(48px, 10cqw, 128px)",
      lineHeight: 1.05,
      fontWeight: 700,
      color: "var(--z-fg-primary)",
      background: "var(--z-designs-page)",
      borderStartStartRadius: "var(--z-shape-card, 14px)",
      borderStartEndRadius: "var(--z-shape-card, 14px)",
    },
    "& button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      minHeight: "44px",
      marginBlockEnd: "8px",
      paddingInline: "12px",
      borderRadius: "var(--z-shape-button, 10px)",
      border: "none",
      background: "var(--z-designs-art-ground)",
      color: "var(--z-designs-on-art)",
      font: "inherit",
      fontSize: "14px",
      fontWeight: 600,
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      "&:dir(rtl) svg": { transform: "scaleX(-1)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
  },
});

const Facts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px 16px",
    "& > div": {
      flex: "1 1 200px",
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    },
    "& strong": { fontSize: "15px", lineHeight: "24px", fontWeight: 600 },
    "& > div > span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
  },
});
