import {
  For,
  Index,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useCreatorAvatar } from "@revolt/app/interface/settings/user/profile/CommunityParts";
import {
  type CommunityCreator,
  type CommunityItem,
  type CommunityPage,
  communityApi,
  communityFramesOpen,
  creatorName,
} from "@revolt/app/interface/settings/user/profile/communityApi";
import { useStyleLabels } from "@revolt/app/interface/settings/user/profile/styleLabels";
import { useClient, useClientLifecycle } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { ProfileEffect } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import { ProfilePreview } from "@revolt/ui/components/features/profiles/frames/ProfilePreview";
import {
  NAME_GRADIENTS,
  NAME_SOLIDS,
} from "@revolt/ui/components/features/profiles/nameStyles";
import {
  NAME_FONTS,
  nameStyle,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import {
  THEME_PRESETS,
  effectStillUrl,
} from "@revolt/ui/components/features/profiles/userStyleExtras";
import type { DesignEvent } from "@zrzur/sdk";
import { withoutNull } from "@zrzur/sdk/solid";

import { isDesignsSite } from "../../DesignsSite";
import { flyToDock } from "./FlockStage";
import { useFontLabel } from "./Home";
import {
  LOOKS,
  StyleCard,
  VIBES,
  useLookText,
  useVibeLine,
  useVibeText,
} from "./Looks";
import {
  type Person,
  Face,
  MemberRow,
  WornAvatar,
  useCast,
  useWearer,
} from "./Scenes";
import { ShowMore, usePaged } from "./ShowMore";
import { useTryOn } from "./TryOn";
import { EARLY_LIMIT, takeEarly } from "./early";
import {
  type TileKind,
  type WallFilter,
  type Wear,
  composeLooks,
  isGiantFrame,
  keepSame,
  watchMotion,
  weave,
} from "./gallery";
import { appendPage, applyDesignEvent } from "./live";
import { LoadError, Notice } from "./parts";
import { rankCreators } from "./rank";

const PAGE = 48;

/** One thing on the wall */
export type Tile = {
  key: string;
  kind: TileKind;
  name: string;
  /** who made it; empty for a maker who stays anonymous on the public site */
  maker?: string;
  wear?: Wear;
  person?: Person;
  /** shown huge, or edge to edge */
  big?: boolean;
  /** the page of this design */
  slug?: string;
  item?: CommunityItem;
  mood?: string;
  /** on a maker's tile */
  makerId?: string;
  avatar?: string;
  count?: number;
  /** a frame tile past the first few: drawn as the sample card, not live */
  sample?: boolean;
};

/**
 * Frame tiles drawn as your own live profile card. Each is a whole profile
 * (theme, badges, sections), so the rest show the light sample card.
 */
const LIVE_CARDS = 6;

/** Ready looks put together from the designs there are */
const READY_LOOKS = 6;

/** Community designs, a page at a time, for any list on the site */
export function useCommunity(
  source: () => {
    query?: string;
    sort?: "popular" | "new";
    favourites?: boolean;
    /** a change to ask again for (your favourites: only you change them);
     * designs joining, changing and leaving arrive live without it */
    version?: number;
    /** nothing to ask for, e.g. a visitor's favourites */
    off?: boolean;
  },
) {
  const client = useClient();
  const { isLoggedIn } = useClientLifecycle();
  const [items, setItems] = createSignal<CommunityItem[]>([]);
  const [creators, setCreators] = createSignal<
    Record<string, CommunityCreator>
  >({});
  const [more, setMore] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  let offset = 0;
  let asked = 0;
  /** the kinds the last load asked for */
  let kinds: readonly CommunityItem["kind"][] = [];

  async function load(reset: boolean) {
    const now = source();
    if (now.off) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ask = ++asked;
    if (reset) offset = 0;
    setLoading(true);
    setFailed(false);
    try {
      // creators' frames only where the server has them open
      const kinds_ = communityFramesOpen(client())
        ? (["decorations", "nameplates", "effects", "frames"] as const)
        : (["decorations", "nameplates", "effects"] as const);
      const pages = await Promise.all(
        kinds_.map((kind) => {
          const ask = () =>
            communityApi.list(client(), kind, {
              query: now.query || undefined,
              sort: now.sort === "new" ? undefined : "popular",
              favourites: now.favourites || undefined,
              limit: PAGE,
              offset: offset || undefined,
            });
          // the first page the site asked for while this code downloaded,
          // for visitors only (signed in, favourites are marked)
          const first =
            !offset &&
            !now.query &&
            now.sort !== "new" &&
            !now.favourites &&
            PAGE === EARLY_LIMIT
              ? takeEarly<CommunityPage>(kind)
              : undefined;
          const asked =
            first && !isLoggedIn() ? first.then(withoutNull).catch(ask) : ask();
          // a server without effects or frames (switched off, or older)
          // still shows everything else
          return kind === "effects" || kind === "frames"
            ? asked.catch(() => ({ items: [], creators: [] }))
            : asked;
        }),
      );
      if (ask !== asked) return;
      kinds = kindNames(kinds_);
      const fresh = pages.flatMap((page) => page.items);
      setItems((list) => (reset ? fresh : appendPage(list, fresh)));
      setCreators((known) => {
        const next = reset ? {} : { ...known };
        for (const page of pages)
          for (const creator of page.creators)
            (next as Record<string, CommunityCreator>)[creator._id] = creator;
        return next;
      });
      offset += PAGE;
      setMore(pages.some((page) => page.items.length === PAGE));
    } catch {
      if (ask === asked) setFailed(true);
    } finally {
      if (ask === asked) setLoading(false);
    }
  }

  createEffect(
    on(
      () => JSON.stringify(source()),
      () => void load(true),
    ),
  );

  // designs joining, changing and leaving the gallery, in place: only the
  // tile that changed redraws, and nothing is fetched again
  const live = (event: DesignEvent) => {
    const now = source();
    if (now.off) return;
    setItems((list) =>
      applyDesignEvent(list, event, {
        kinds,
        sort: now.sort === "new" ? "new" : "popular",
        query: now.query,
        favourites: now.favourites,
        complete: !more(),
      }),
    );
    // a maker new to this list: just theirs, once
    if (event.type === "CommunityItemCreate") {
      const maker = event.creator_id;
      if (
        maker &&
        !creators()[maker] &&
        items().some((item) => item._id === event._id)
      )
        void communityApi
          .details(client(), event._id)
          .then(({ creator }) => {
            if (creator)
              setCreators((known) => ({ ...known, [creator._id]: creator }));
          })
          .catch(() => undefined);
    }
  };
  createEffect(() => {
    const current = client();
    current.on("designEvent", live);
    onCleanup(() => current.removeListener("designEvent", live));
  });

  return {
    items,
    creators,
    more,
    loading,
    failed,
    next: () => void load(false),
    retry: () => void load(true),
  };
}

export type Community = ReturnType<typeof useCommunity>;

const kindOfPath = {
  decorations: "Decoration",
  nameplates: "Nameplate",
  effects: "Effect",
  frames: "Frame",
} as const;

/** The kinds of designs a load asked for, as designs name them */
function kindNames(
  paths: readonly (keyof typeof kindOfPath)[],
): CommunityItem["kind"][] {
  return paths.map((path) => kindOfPath[path]);
}

/** The same small number for the same design, wherever it is in a list */
function steady(id: string, size: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % Math.max(size, 1);
}

const tileKinds = {
  Decoration: "frame",
  Nameplate: "plate",
  Effect: "effect",
  Frame: "card",
} as const;

/** What a community design puts on you */
export function wearOf(item: CommunityItem): Wear {
  const ref = `c:${item._id}`;
  switch (item.kind) {
    case "Nameplate":
      return { nameplate: ref, nameplate_file: item.file._id };
    case "Effect":
      return { effect: ref, effect_file: item.file._id };
    case "Frame":
      return { profile_frame: ref, profile_frame_file: item.file._id };
    default:
      return { decoration: ref, decoration_file: item.file._id };
  }
}

/** Community designs as tiles, who made each included */
export function useCommunityTiles() {
  const { t } = useLingui();
  const cast = useCast();
  return (items: CommunityItem[], creators: Record<string, CommunityCreator>) =>
    items.map((item): Tile => {
      return {
        key: item._id,
        kind: tileKinds[item.kind],
        name: item.name,
        maker: creatorName(creators[item.creator_id]) || t`A verified maker`,
        wear: wearOf(item),
        // by the design, not its place: a design arriving live above it
        // leaves every other tile as it was
        person: cast.all()[steady(item._id, cast.all().length)],
        slug: item._id,
        item,
      };
    });
}

/**
 * What ships with Zrzur, made by its own team: ready-made looks, name fonts
 * and colours. Decorations, nameplates, effects and frames are all creators'
 * designs (the built-in ones became community designs on 2026-11-26).
 */
export function useBuiltInTiles() {
  const { t } = useLingui();
  const lookText = useLookText();
  const fontLabel = useFontLabel();
  const cast = useCast();
  const team = () => t`The Zrzur team`;
  const at = (i: number) => cast.all()[i % cast.all().length];

  return {
    looks: (ids?: string[]): Tile[] =>
      LOOKS.filter((look) => !ids || ids.includes(look.id)).map((look, i) => ({
        key: `look-${look.id}`,
        kind: "look",
        name: lookText(look.id)[0],
        maker: team(),
        wear: look.style,
        person: at(i + 3),
        slug: `look-${look.id}`,
      })),
    types: (): Tile[] =>
      NAME_FONTS.filter((font) => font.id !== "default").map((font, i) => ({
        key: `type-${font.id}`,
        kind: "type",
        name: fontLabel(font.id),
        wear: { name_font: font.id },
        person: at(i + 1),
      })),
    inks: (): Tile[] =>
      [...NAME_SOLIDS.map((c) => [c]), ...NAME_GRADIENTS].map((colour, i) => ({
        key: `ink-${colour.join("-")}`,
        kind: "ink",
        name: "",
        wear: { name_colour: [...colour] },
        person: at(i + 2),
      })),
  };
}

/**
 * The wall. It shows a page of tiles and "Show more" adds the next, so six
 * designs and six hundred read the same way and scrolling stays light. Shapes change with the kind and the
 * scale jumps: a frame the size of a poster. A nameplate keeps its real shape.
 */
export function Wall(props: {
  tiles: Tile[];
  /** more can be fetched */
  more?: boolean;
  loading?: boolean;
  onMore?: () => void;
  onOpen: (item: CommunityItem) => void;
  onDesign: (slug: string) => void;
  onMood?: (mood: string) => void;
  onMaker?: (id: string) => void;
}) {
  const paged = usePaged(() => props.tiles, {
    key: (tile) => tile.key,
    more: () => !!props.more,
    loading: () => !!props.loading,
    onMore: () => props.onMore?.(),
    // about a screenful (a phone shows three or four tiles, a desktop about
    // twelve); the rest follows a frame at a time
    batch:
      typeof matchMedia === "function" &&
      matchMedia("(max-width: 600px)").matches
        ? 6
        : 12,
  });

  return (
    <>
      <Grid>
        <For each={paged.shown()}>
          {(tile) => (
            <Switch>
              <Match when={tile.kind === "paint"}>
                <PaintBand />
              </Match>
              <Match when={tile.kind === "maker"}>
                <MakerTile tile={tile} onMaker={props.onMaker} />
              </Match>
              <Match when={tile.kind === "mood"}>
                <MoodTile mood={tile.mood!} onMood={props.onMood} />
              </Match>
              <Match when={true}>
                <DesignTile
                  tile={tile}
                  onOpen={props.onOpen}
                  onDesign={props.onDesign}
                />
              </Match>
            </Switch>
          )}
        </For>
      </Grid>
      <ShowMore state={paged.state()} onMore={paged.next} />
    </>
  );
}

/**
 * How long the pointer rests on a tile before it plays or shows on you. While
 * the wall scrolls, tiles slide under a still pointer: each would start its
 * effect and repaint the mirror, which made scrolling heavy. A resting pointer
 * is a choice; a passing one is not. Clicks and the keyboard act at once.
 */
const REST_MS = 200;

/** Calls `then` once the pointer has rested for REST_MS; `cancel` on leave */
function useRest() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => clearTimeout(timer);
  onCleanup(cancel);
  return {
    after: (then: () => void) => {
      cancel();
      timer = setTimeout(then, REST_MS);
    },
    cancel,
  };
}

/** A tap tries it on and sends it flying to you */
function useTileActions(wear: () => Wear | undefined, name: () => string) {
  const tryOn = useTryOn();
  const rest = useRest();
  return {
    pressed: () => !!wear() && tryOn.wearing(wear()!),
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === "mouse") rest.after(() => tryOn.peek(wear()));
    },
    onPointerLeave: () => {
      rest.cancel();
      tryOn.peek(undefined);
    },
    onFocus: () => tryOn.peek(wear()),
    onBlur: () => tryOn.peek(undefined),
    tap: (el: HTMLElement, fly = true) => {
      const pieces = wear();
      if (!pieces || isDesignsSite()) return;
      if (fly && !tryOn.wearing(pieces)) flyToDock(el);
      tryOn.toggle(pieces, name());
    },
  };
}

function Caption(props: {
  tile: Tile;
  onOpen: (item: CommunityItem) => void;
  onDesign: (slug: string) => void;
}) {
  const body = () => (
    <>
      <strong>
        <bdi>{props.tile.name}</bdi>
      </strong>
      <Show when={props.tile.maker}>
        <small>
          <Trans>
            by <bdi>{props.tile.maker}</bdi>
          </Trans>
        </small>
      </Show>
    </>
  );
  return (
    <Show when={props.tile.slug} fallback={<CaptionText>{body()}</CaptionText>}>
      <CaptionLink
        type="button"
        onClick={() =>
          props.tile.item
            ? props.onOpen(props.tile.item)
            : props.onDesign(props.tile.slug!)
        }
      >
        {body()}
      </CaptionLink>
    </Show>
  );
}

function DesignTile(props: {
  tile: Tile;
  onOpen: (item: CommunityItem) => void;
  onDesign: (slug: string) => void;
}) {
  const wearer = useWearer();
  const { t } = useLingui();
  const instance = useInstance();
  const client = useClient();
  const act = useTileActions(
    () => props.tile.wear,
    () => props.tile.name,
  );
  // big enough to see the decoration's detail in a tile of the wall
  const size = () => (props.tile.big ? 208 : 96);
  // an effect plays while the pointer or the keyboard rests on its tile
  const [playing, setPlaying] = createSignal(false);
  const [play, setPlay] = createSignal(0);
  const rest = useRest();
  const start = () => {
    rest.cancel();
    setPlaying(true);
    setPlay((n) => n + 1);
  };
  return (
    <TileBase
      ref={(el) => {
        onCleanup(watchMotion(el));
        onCleanup(fitRows(el));
      }}
      data-kind={props.tile.kind}
      data-big={props.tile.big}
      data-on={act.pressed()}
    >
      <Art
        type="button"
        aria-pressed={act.pressed()}
        aria-label={t`Try on ${props.tile.name}`}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") rest.after(start);
          act.onPointerEnter(e);
        }}
        onPointerLeave={() => {
          rest.cancel();
          setPlaying(false);
          act.onPointerLeave();
        }}
        onFocus={() => {
          start();
          act.onFocus();
        }}
        onBlur={() => {
          setPlaying(false);
          act.onBlur();
        }}
        onClick={(e) => {
          start();
          // a whole framed profile is too big to fly to the dock
          act.tap(e.currentTarget, props.tile.kind !== "card");
        }}
      >
        <Switch>
          <Match when={props.tile.kind === "effect"}>
            <EffectStage>
              <ProfileEffect
                effect={playing() ? props.tile.wear!.effect : undefined}
                file={props.tile.wear!.effect_file}
                play={play()}
                idle={
                  <Show when={props.tile.item}>
                    <FileStill
                      src={effectStillUrl(
                        instance.mediaUrl,
                        props.tile.wear!.effect_file,
                      )}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerpolicy="no-referrer"
                      draggable={false}
                    />
                  </Show>
                }
              />
            </EffectStage>
          </Match>
          <Match when={props.tile.kind === "look"}>
            {/* signed in: your own profile, small, wearing the look; a
                visitor sees the sample card */}
            <Show
              when={client().user}
              fallback={
                <StyleCard
                  style={props.tile.wear!}
                  person={props.tile.person}
                  compact
                />
              }
            >
              {(me) => (
                <LookStack>
                  <ProfilePreview
                    user={me()}
                    style={{ ...userStyleOf(me()), ...props.tile.wear }}
                  />
                  {/* a whole set: its nameplate too, as a member list
                      shows it (the card shows the rest) */}
                  <Show when={props.tile.wear?.nameplate}>
                    <MemberRow
                      style={{ ...userStyleOf(me()), ...props.tile.wear }}
                    />
                  </Show>
                </LookStack>
              )}
            </Show>
          </Match>
          <Match when={props.tile.kind === "frame"}>
            {/* a decoration reaches half the picture again past it: the
                tile holds all of it, never cut at the top */}
            <DecoRoom style={{ "--room": `${size() * 1.5}px` }}>
              <WornAvatar
                size={size()}
                style={props.tile.wear!}
                person={props.tile.person}
              />
            </DecoRoom>
          </Match>
          <Match when={props.tile.kind === "plate"}>
            <MemberRow style={props.tile.wear!} person={props.tile.person} />
          </Match>
          <Match when={props.tile.kind === "card"}>
            {/* signed in: your own profile, as people will see it, with
                your look and this frame; a visitor sees the sample card */}
            <Show
              when={!props.tile.sample && client().user}
              fallback={
                <StyleCard
                  style={props.tile.wear!}
                  person={props.tile.person}
                  compact
                />
              }
            >
              {(me) => (
                <ProfilePreview
                  user={me()}
                  style={{ ...userStyleOf(me()), ...props.tile.wear }}
                />
              )}
            </Show>
          </Match>
          <Match when={props.tile.kind === "open"}>
            <OpenRing />
          </Match>
          <Match when={props.tile.kind === "type" || props.tile.kind === "ink"}>
            <Word
              dir="auto"
              data-ink={props.tile.kind === "ink" || undefined}
              style={{
                ...nameStyle(props.tile.wear),
                "--name-length": wearer.who(props.tile.person).name.length,
              }}
            >
              {wearer.who(props.tile.person).name}
            </Word>
          </Match>
        </Switch>
      </Art>
      <Show when={props.tile.name}>
        <Caption
          tile={props.tile}
          onOpen={props.onOpen}
          onDesign={props.onDesign}
        />
      </Show>
    </TileBase>
  );
}

/** The wall's row step and gap (Grid spells them out for Panda) */
const ROW_PX = 2;
const GAP_PX = 8;

/**
 * Give a tile the rows its content needs, and again whenever that changes
 * (a picture loads, a card is drawn): no tile is taller than what is in it
 * @returns stop watching
 */
function fitRows(el: HTMLElement) {
  const fit = () => {
    const height = el.getBoundingClientRect().height;
    if (!height) return;
    const rows = Math.max(1, Math.ceil((height + GAP_PX) / (ROW_PX + GAP_PX)));
    el.style.gridRowEnd = `span ${rows}`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(el);
  return () => observer.disconnect();
}

/** A look: your card and, for a set, your nameplate under it */
const LookStack = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px", width: "100%" },
});

/** The whole of a decoration: the picture and the art round it */
const DecoRoom = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "var(--room)",
    height: "var(--room)",
    maxWidth: "100%",
  },
});

const FileStill = styled("img", {
  base: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
});

/** Someone who makes these, standing among their work */
function MakerTile(props: { tile: Tile; onMaker?: (id: string) => void }) {
  return (
    <Maker
      type="button"
      disabled={!props.tile.makerId}
      onClick={() => props.onMaker?.(props.tile.makerId!)}
    >
      <Face
        size={72}
        name={props.tile.name}
        src={props.tile.avatar}
        colour={props.tile.person?.colour}
      />
      <strong>
        <bdi>{props.tile.name}</bdi>
      </strong>
      <small>
        <Plural
          value={props.tile.count ?? 0}
          one="# design"
          other="# designs"
        />
      </small>
    </Maker>
  );
}

/** Every profile colour at once: stripes the height of a wall */
function PaintBand() {
  const labels = useStyleLabels();
  const tryOn = useTryOn();
  const rest = useRest();
  return (
    <Paint>
      <Index each={THEME_PRESETS}>
        {(preset) => (
          <button
            type="button"
            aria-pressed={tryOn.wearing({ theme: preset().colours })}
            style={{
              background: `linear-gradient(180deg, ${preset().colours[0]}, ${preset().colours[1]})`,
            }}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse")
                rest.after(() => tryOn.peek({ theme: [...preset().colours] }));
            }}
            onPointerLeave={() => {
              rest.cancel();
              tryOn.peek(undefined);
            }}
            onClick={(e) => {
              if (isDesignsSite()) return;
              flyToDock(e.currentTarget);
              tryOn.toggle(
                { theme: [...preset().colours] },
                labels.theme(preset().id),
              );
            }}
          >
            <span>{labels.theme(preset().id)}</span>
          </button>
        )}
      </Index>
    </Paint>
  );
}

/** A mood: real cards thrown on a table */
function MoodTile(props: { mood: string; onMood?: (mood: string) => void }) {
  const { t } = useLingui();
  const vibeText = useVibeText();
  const vibeLine = useVibeLine();
  const cast = useCast();
  const looks = () =>
    (VIBES.find((vibe) => vibe.id === props.mood)?.looks ?? [])
      .slice(0, 3)
      .map((id) => LOOKS.find((look) => look.id === id)!);
  return (
    <Deck
      type="button"
      aria-label={t`${vibeText(props.mood)} collection`}
      onClick={() => props.onMood?.(props.mood)}
    >
      <div aria-hidden="true">
        <For each={looks()}>
          {(look, i) => (
            <div>
              <StyleCard
                style={look.style}
                person={cast.all()[i() + 4]}
                compact
              />
            </div>
          )}
        </For>
      </div>
      <strong>{vibeText(props.mood)}</strong>
      <span>{vibeLine(props.mood)}</span>
    </Deck>
  );
}

/** The tiles of the whole gallery for a filter */
export function useGalleryTiles(input: {
  filter: () => WallFilter;
  mood: () => string | undefined;
  query: () => string;
  community: Community;
}) {
  const built = useBuiltInTiles();
  const fromCommunity = useCommunityTiles();
  const openSlot = useOpenTile();
  const avatar = useCreatorAvatar();
  const cast = useCast();
  const { t } = useLingui();
  const lookText = useLookText();

  // tiles that did not change stay the same objects, so new data redraws
  // only the tiles it changed, never the whole wall (no "refresh")
  const known = new Map<string, { sign: string; entry: Tile }>();
  const tiles = createMemo(() => {
    const q = input.query().trim().toLocaleLowerCase();
    const has = (tile: Tile) => !q || tile.name.toLocaleLowerCase().includes(q);
    const mine = fromCommunity(
      input.community.items(),
      input.community.creators(),
    );
    const ids = VIBES.find((vibe) => vibe.id === input.mood())?.looks;
    const large = (list: Tile[], test: (i: number) => boolean) =>
      list.map((tile, i) => ({ ...tile, big: test(i) }));
    const frames = large(
      mine.filter((t) => t.kind === "frame").filter(has),
      isGiantFrame,
    );
    const plates = mine.filter((t) => t.kind === "plate").filter(has);
    const effects = mine.filter((tile) => tile.kind === "effect").filter(has);
    const cards = mine
      .filter((tile) => tile.kind === "card")
      .filter(has)
      .map((tile, i) => (i < LIVE_CARDS ? tile : { ...tile, sample: true }));
    // whole looks put together from the designs there are, before the
    // team's own; a mood shows only its own looks
    const sets: Tile[] = ids
      ? []
      : composeLooks(
          LOOKS.map((look) => look.style),
          {
            decorations: frames.map((tile) => tile.wear!),
            nameplates: plates.map((tile) => tile.wear!),
            frames: cards.map((tile) => tile.wear!),
            effects: effects.map((tile) => tile.wear!),
          },
          READY_LOOKS,
        ).map((wear, i) => {
          const name = lookText(LOOKS[i % LOOKS.length].id)[0];
          return {
            key: `set-${i}`,
            kind: "look",
            name: t`${name} set`,
            maker: t`The Zrzur team`,
            wear,
            person: cast.all()[(i + 5) % cast.all().length],
          };
        });
    const looks = [...sets.filter(has), ...built.looks(ids).filter(has)];
    const types = built.types().filter(has);
    const inks = built.inks();
    const paint: Tile = { key: "paint", kind: "paint", name: "" };
    const makers = rankCreators({
      items: input.community.items(),
      creators: input.community.creators(),
    }).map(
      (entry, i): Tile => ({
        key: `maker-${entry.creator._id}`,
        kind: "maker",
        name: creatorName(entry.creator),
        makerId: entry.creator.open_page ? entry.creator._id : undefined,
        avatar: avatar(entry.creator),
        count: entry.designs,
        person: cast.all()[i % cast.all().length],
      }),
    );
    const moods = VIBES.filter((vibe) => vibe.id !== "all").map(
      (vibe): Tile => ({
        key: `mood-${vibe.id}`,
        kind: "mood",
        name: "",
        mood: vibe.id,
      }),
    );

    switch (input.filter()) {
      case "looks":
        return looks;
      case "decorations":
        return frames;
      case "nameplates":
        return plates;
      case "effects":
        return effects;
      case "frames":
        return cards;
      case "colours":
        return [paint];
      case "name":
        return [...types, ...inks];
      case "community":
        return weave<Tile>({
          frame: frames.filter((tile) => tile.item),
          plate: plates.filter((tile) => tile.item),
          effect: effects,
          card: cards.filter((tile) => tile.item),
        });
      default:
        if (q || input.mood())
          return weave<Tile>({
            look: looks,
            frame: frames,
            plate: plates,
            effect: effects,
            card: cards,
            type: types,
          });
        return weave<Tile>({
          look: looks,
          frame: frames,
          plate: plates,
          effect: effects,
          type: types,
          ink: inks.slice(0, 4),
          paint: [paint],
          mood: moods,
          maker: makers,
          open: mine.length < 6 ? [openSlot()] : [],
        });
    }
  });
  return createMemo(() => keepSame(known, tiles()));
}

function useOpenTile() {
  const { t } = useLingui();
  return (): Tile => ({
    key: "open",
    kind: "open",
    name: t`Your design could be here`,
  });
}

/** The wall while it is on its way: its own shapes, empty */
export function WallHolders() {
  return (
    <Grid aria-busy="true">
      <For each={["big", "s", "s", "wide", "s", "s", "wide", "s"]}>
        {(shape) => <Holder data-shape={shape} />}
      </For>
    </Grid>
  );
}

/** Nothing on the wall, for a reason worth saying */
export function WallEmpty(props: {
  failed?: boolean;
  /** the community wall before anyone has published */
  waiting?: boolean;
  onRetry: () => void;
  onClear: () => void;
}) {
  return (
    <Show when={!props.failed} fallback={<LoadError onRetry={props.onRetry} />}>
      <Show
        when={!props.waiting}
        fallback={
          <Notice
            art={<OpenRing />}
            title={<Trans>The first design here could be yours</Trans>}
            action={{
              label: <Trans>Browse designs</Trans>,
              onClick: props.onClear,
            }}
          >
            <Trans>
              Designs made by the community appear here as soon as a creator
              publishes one.
            </Trans>
          </Notice>
        }
      >
        <Notice
          icon="magnifying-glass"
          title={<Trans>Nothing in the flock matches</Trans>}
          action={{
            label: <Trans>Clear search</Trans>,
            onClick: props.onClear,
          }}
        >
          <Trans>Try another word, or a creator's name.</Trans>
        </Notice>
      </Show>
    </Show>
  );
}

/** a frame nobody wears yet */
const OpenRing = styled("span", {
  base: {
    display: "block",
    width: "88px",
    height: "88px",
    borderRadius: "50%",
    border: "2px dashed var(--z-designs-edge-hover)",
  },
});

const Maker = styled("button", {
  base: {
    gridColumn: "span 3",
    gridRow: "span 20",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    gap: "4px",
    minWidth: 0,
    padding: "16px",
    border: "none",
    borderRadius: "var(--z-shape-card, 14px)",
    background: "var(--z-designs-surface-raised)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "& strong": {
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
    },
    "& small": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "@media (max-width: 899px)": { gridColumn: "span 3" },
    "@media (max-width: 600px)": { gridColumn: "span 6" },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    // fine steps: a design's tile takes exactly the height of what is in
    // it (fitRows); a fixed piece spans whole steps of 10 px (2 + the gap)
    gridAutoRows: "2px",
    gridAutoFlow: "dense",
    gap: "8px",
    "@media (max-width: 899px)": {
      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
      gap: "8px",
    },
  },
});

const TileBase = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
    borderRadius: "var(--z-shape-card, 14px)",
    background: "var(--z-designs-art-ground)",
    color: "var(--z-designs-on-art)",
    outline: "2px solid transparent",
    outlineOffset: "-2px",
    transition: "outline-color 120ms cubic-bezier(0.2, 0, 0, 1)",
    // off screen: not painted, and its animated decoration does not run
    "& .z-deco-ring": { animationPlayState: "paused !important" },
    "&[data-awake] .z-deco-ring": {
      animationPlayState: "running !important",
    },
    // as tall as what is in it: fitRows gives it its rows
    alignSelf: "start",
    gridColumn: "span 3",
    "&[data-on='true']": { outlineColor: "var(--z-focus)" },
    // one width for every design, so the wall packs like a brick wall
    // with no holes; only a giant frame takes two
    "&[data-kind='look']": { gridColumn: "span 3" },
    // a whole profile card in its frame: a poster of a tile, with room
    // round the card for the frame that reaches past it
    "&[data-kind='card']": { gridColumn: "span 3" },
    "&[data-kind='frame'][data-big='true']": { gridColumn: "span 6" },
    "&[data-kind='plate']": { gridColumn: "span 3" },
    "&[data-kind='type']": { gridColumn: "span 3" },
    "&[data-kind='ink']": { gridColumn: "span 3" },
    "@media (max-width: 899px)": {
      "&[data-kind='frame'][data-big='true']": { gridColumn: "span 6" },
    },
    // Phones: every card is the width of the page, one under the other
    // (owner, 2026-11-17: all the same size, as the search field is). Two
    // sizes side by side left a single small card with a hole beside it.
    "@media (max-width: 600px)": {
      "&, &[data-kind]": { gridColumn: "span 6" },
    },
  },
});

const Art = styled("button", {
  base: {
    flex: 1,
    display: "grid",
    placeItems: "center",
    minHeight: 0,
    width: "100%",
    // room above what is in a tile, as below it before the caption
    padding: "12px 12px 4px",
    overflow: "hidden",
    border: "none",
    background: "none",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    "& > *": { transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)" },
    "&:hover > *": { transform: "scale(1.05)" },
    _motionReduce: { "&:hover > *": { transform: "none" } },
    // a small profile card: from the top, and it does not grow on hover
    "[data-kind='look'] > &": {
      alignItems: "start",
      "& > div": { width: "100%" },
      "&:hover > *": { transform: "none" },
    },
    "[data-kind='plate'] > &": {
      "& > div": { width: "100%" },
      padding: "12px 12px 0",
      minHeight: "48px",
    },
    // the whole name fits: its size is worked out from this box
    "[data-kind='ink'] > &": { containerType: "inline-size" },
    "[data-kind='effect'] > &": { padding: 0 },
    // the card and the room its frame needs round it (ProfilePreview keeps
    // its own; the sample card has framedCompact in Looks.tsx) fit the tile;
    // the frame is never cut at the tile's edge
    "[data-kind='card'] > &": {
      alignItems: "start",
      padding: "12px",
      "& > div": { width: "100%" },
      "&:hover > *": { transform: "none" },
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-4px",
      borderRadius: "var(--z-shape-card, 14px)",
    },
  },
});

/** The still and the play share one frame, the size of the tile's art */
const EffectStage = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    // the shape of a profile card, so the tile shows how the effect will look
    aspectRatio: "5 / 8",
    overflow: "hidden",
  },
});

const captionBase = {
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  minWidth: 0,
  padding: "4px 12px 8px",
  textAlign: "start",
  "& strong": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
  },
  "& small": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-designs-on-art-muted)",
  },
} as const;

const CaptionText = styled("div", { base: captionBase });

const CaptionLink = styled("button", {
  base: {
    ...captionBase,
    width: "100%",
    border: "none",
    background: "none",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    "& strong": {
      ...captionBase["& strong"],
    },
    _hover: { "& strong": { textDecoration: "underline" } },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
      borderRadius: "var(--z-shape-button, 10px)",
    },
    // 44 px tap target on phones
    _phone: { minHeight: "44px", justifyContent: "center" },
  },
});

const Word = styled("span", {
  base: {
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "28px",
    lineHeight: "36px",
    color: "var(--z-designs-on-art)",

    // never cut: a long name gets smaller until it fits the tile
    "&[data-ink]": {
      overflow: "visible",
      textOverflow: "clip",
      fontSize: "min(16px, calc(100cqw / (var(--name-length) * 0.62)))",
      lineHeight: "24px",
    },
  },
});

const Paint = styled("div", {
  base: {
    gridColumn: "1 / -1",
    gridRow: "span 30",
    overflow: "hidden",
    borderRadius: "var(--z-shape-card, 14px)",
    display: "flex",
    "& button": {
      flex: "1 1 0",
      minWidth: 0,
      position: "relative",
      padding: 0,
      border: "none",
      cursor: "pointer",
      transition: "flex-grow 320ms cubic-bezier(0.2, 0, 0, 1)",
      _hover: { flexGrow: 3 },
      _focusVisible: {
        flexGrow: 3,
        outline: "4px solid var(--z-focus)",
        outlineOffset: "-4px",
      },
      _motionReduce: { transition: "none" },
    },
    "& button[aria-pressed='true']": { flexGrow: 3 },
    // the name stands on a solid plate at the foot of the stripe
    "& span": {
      position: "absolute",
      insetBlockEnd: "8px",
      insetInlineStart: "50%",
      transform: "translateX(-50%)",
      maxWidth: "calc(100% - 8px)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      padding: "2px 8px",
      borderRadius: "6px",
      background: "var(--z-designs-art-ground)",
      color: "var(--z-designs-on-art)",
      fontSize: "12px",
      lineHeight: "20px",
      fontWeight: 600,
      opacity: 0,
      transition: "opacity 120ms ease",
    },
    "& button:hover span, & button:focus-visible span, & button[aria-pressed='true'] span":
      { opacity: 1 },
    "@media (max-width: 899px)": {
      overflowX: "auto",
      scrollbarWidth: "none",
      "&::-webkit-scrollbar": { display: "none" },
      "& button": { flex: "0 0 72px" },
      "& button[aria-pressed='true']": { flex: "0 0 136px" },
    },
  },
});

const Deck = styled("button", {
  base: {
    position: "relative",
    // one tile wide, like every design beside it
    gridColumn: "span 3",
    gridRow: "span 28",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    overflow: "hidden",
    padding: "20px",
    border: "none",
    borderRadius: "var(--z-shape-card, 14px)",
    background: "var(--z-designs-surface-raised)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > div": {
      position: "absolute",
      insetBlockStart: "-12px",
      insetInlineStart: "50%",
      width: "140px",
      marginInlineStart: "-70px",
      height: "100%",
      pointerEvents: "none",
    },
    "& > div > div": {
      position: "absolute",
      insetBlockStart: "28px",
      insetInlineStart: 0,
      width: "140px",
      transformOrigin: "50% 130%",
      transition: "transform 320ms cubic-bezier(0.2, 0, 0, 1)",
      _motionReduce: { transition: "none" },
    },
    "& > div > div:nth-child(1)": { transform: "rotate(-14deg)" },
    "& > div > div:nth-child(2)": { transform: "rotate(12deg)" },
    "&:hover > div > div:nth-child(1)": {
      transform: "rotate(-22deg) translateX(-16px)",
      _motionReduce: { transform: "rotate(-14deg)" },
    },
    "&:hover > div > div:nth-child(2)": {
      transform: "rotate(20deg) translateX(16px)",
      _motionReduce: { transform: "rotate(12deg)" },
    },
    // the card's own words only: the sample cards hold spans of their own
    "& > strong": {
      position: "relative",
      fontSize: "28px",
      lineHeight: 1.2,
      fontWeight: 700,
    },
    "& > span": {
      position: "relative",
      maxWidth: "100%",
      marginBlockStart: "8px",
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Holder = styled("div", {
  base: {
    borderRadius: "var(--z-shape-card, 14px)",
    background: "var(--z-designs-surface)",
    gridColumn: "span 3",
    gridRow: "span 20",
    animation: "skeletonPulse 1.4s ease-in-out infinite",
    _motionReduce: { animation: "none" },
    "&[data-shape='big']": { gridColumn: "span 6", gridRow: "span 40" },
    "&[data-shape='wide']": { gridColumn: "span 6", gridRow: "span 10" },
  },
});
