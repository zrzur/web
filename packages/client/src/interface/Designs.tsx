import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  designsUrl,
  publicReportUrl,
} from "@revolt/app/interface/discover/sites";
import {
  CreatorChip,
  useCommunityPermissions,
  useDate,
  useWearDesign,
} from "@revolt/app/interface/settings/user/profile/CommunityParts";
import { CreatorStudio } from "@revolt/app/interface/settings/user/profile/CreatorStudio";
import { CreatorsAdmin } from "@revolt/app/interface/settings/user/profile/CreatorsAdmin";
import { ReviewQueue } from "@revolt/app/interface/settings/user/profile/ReviewQueue";
import {
  CommunityItem,
  can,
  communityApi,
  creatorName,
  hasOpenPage,
  maySeeStudio,
} from "@revolt/app/interface/settings/user/profile/communityApi";
import { useCreatorAccess } from "@revolt/app/interface/settings/user/profile/creatorAccess";
import { useClient, useClientLifecycle } from "@revolt/client";
import { STAFF_TOOLS_ENABLED } from "@revolt/common/lib/staffTools";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useLocation, useNavigate } from "@revolt/routing";
import { Dialog } from "@revolt/ui";
import {
  type UserStyle,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";

import { Sky } from "@revolt/ui/components/design/Sky";
import { Icon } from "@revolt/ui/icons/Icon";
import {
  appUrl,
  designsBase,
  isDesignsSite,
  useAccountGate,
} from "../DesignsSite";
import { DesignPage } from "./designs/DesignPage";
import { Dock } from "./designs/Dock";
import { DesignsHome, Samples, WornCard } from "./designs/Home";
import {
  CreatorPage,
  CreatorsScene,
  Head,
  Scene,
  SkyBand,
} from "./designs/Makers";
import { Mirror } from "./designs/Mirror";
import { Preview } from "./designs/Preview";
import { useWearer } from "./designs/Scenes";
import {
  type Chapter,
  CreatorTools,
  Stage as StagePanel,
  ToolButton,
} from "./designs/Stage";
import { TryOnProvider } from "./designs/TryOn";
import {
  Wall,
  WallHolders,
  useCommunity,
  useCommunityTiles,
} from "./designs/Wall";
import { isDesignSlug } from "./designs/designSlug";
import type { WallFilter } from "./designs/gallery";
import { designsTokens } from "./designs/palette";
import { LoadError, Notice } from "./designs/parts";
import { mergePages as merge } from "./designs/rank";

/**
 * Designs: a gallery of avatar decorations, nameplates and looks. Everyone
 * can browse and try them on, in one sky and one wall; only creators publish
 * (from Creator Studio), and only published designs ever reach this page.
 *
 *   /designs                 the sky and the whole wall
 *   /designs/looks           the wall, one kind (also decorations, nameplates,
 *                            colours, name, community)
 *   /designs/studio          Creator Studio (creators only)
 *   /designs/favourites      the designs you saved
 *   /designs/creators        everyone who published something
 *   /designs/creator/:id     one creator and their work
 */

type View =
  | { page: "home" }
  | { page: "wall"; filter: WallFilter }
  | { page: "studio" }
  | { page: "favourites" }
  | { page: "creators" }
  | { page: "creator"; id: string }
  | { page: "design"; slug: string };

export function Designs() {
  return (
    <TryOnProvider>
      <Gallery />
    </TryOnProvider>
  );
}

function Gallery() {
  const { t } = useLingui();
  const client = useClient();
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = useCommunityPermissions();
  const { perms } = permissions;
  const access = useCreatorAccess(permissions);
  const { isLoggedIn } = useClientLifecycle();
  const signedIn = useAccountGate();
  const wearer = useWearer();

  const base = designsBase();
  const view = createMemo((): View => {
    const path = location.pathname;
    const rest = base && path.startsWith(base) ? path.slice(base.length) : path;
    const [first, second] = rest.split("/").filter(Boolean);
    if (first && isDesignSlug(first)) return { page: "design", slug: first };
    if (
      first === "looks" ||
      first === "decorations" ||
      first === "nameplates" ||
      first === "effects" ||
      first === "colours" ||
      first === "name" ||
      first === "community"
    )
      return { page: "wall", filter: first };
    if (first === "favourites") return { page: "favourites" };
    if (first === "studio") return { page: "studio" };
    if (first === "creators") return { page: "creators" };
    if (first === "creator" && second) return { page: "creator", id: second };
    return { page: "home" };
  });

  // a rank changed elsewhere shows on the way in
  onMount(() => permissions.refresh());

  const [typed, setTyped] = createSignal("");
  const [query, setQuery] = createSignal("");
  createEffect(() => {
    const value = typed().trim();
    const timer = setTimeout(() => setQuery(value), 300);
    onCleanup(() => clearTimeout(timer));
  });
  // a new page starts without the old search
  createEffect(
    on(
      () => location.pathname,
      () => setTyped(""),
      { defer: true },
    ),
  );

  const [open, setOpen] = createSignal<CommunityItem>();
  const [dialog, setDialog] = createSignal<"review" | "creators">();
  const [version, setVersion] = createSignal(0);

  const [queue] = createResource(
    () => can(perms(), "cosmetics.review") && version() + 1,
    () => communityApi.queue(client()).catch(() => undefined),
  );
  const waiting = () =>
    (queue()?.pending.length ?? 0) +
    (queue()?.revisions.length ?? 0) +
    (queue()?.reported.length ?? 0);

  const go = (path: string) => navigate(`${base}${path}` || "/");
  /** the way to Creator Studio, for creators only */
  const creating = () => !isDesignsSite() && access();
  const studio = () => (creating() ? () => go("/studio") : undefined);
  /** a suspended creator looks at their designs and changes nothing */
  const readOnly = () => !!perms()?.creator && perms()?.creator !== "Active";
  // the address alone opens nothing: without the rank it leads to Designs
  createEffect(() => {
    if (view().page !== "studio") return;
    const known = perms();
    // when the server could not say, the page says so; that is not "no rank"
    if (isDesignsSite() || (known && !maySeeStudio(known))) {
      navigate(base || "/", { replace: true });
    }
  });
  const active = (page: View["page"]) => view().page === page;
  const filter = (): WallFilter => {
    const current = view();
    return current.page === "wall" ? current.filter : "all";
  };

  // the same objects every time: the tabs are drawn from them, and a tab
  // drawn again would lose the keyboard's place when permissions arrive
  const chapter = {
    home: {
      id: "home",
      icon: "compass",
      get label() {
        return t`Gallery`;
      },
      get hint() {
        return t`Find a look you like`;
      },
      get on() {
        return active("home") || active("wall");
      },
      go: () => go(""),
    },
    creators: {
      id: "creators",
      icon: "paint-brush",
      get label() {
        return t`Creators`;
      },
      get hint() {
        return t`The people who make them`;
      },
      get on() {
        return active("creators") || active("creator");
      },
      go: () => go("/creators"),
    },
    favourites: {
      id: "favourites",
      icon: "heart",
      get label() {
        return t`Favourites`;
      },
      get hint() {
        return t`Designs you saved`;
      },
      get on() {
        return active("favourites");
      },
      go: () => go("/favourites"),
    },
    studio: {
      id: "studio",
      icon: "upload-simple",
      get label() {
        return t`Creator Studio`;
      },
      get hint() {
        return readOnly() ? t`The designs you made` : t`Upload your designs`;
      },
      get on() {
        return active("studio");
      },
      go: () => go("/studio"),
    },
  } satisfies Record<string, Chapter>;

  const chapters = createMemo((): Chapter[] => [
    chapter.home,
    chapter.creators,
    ...(isDesignsSite() ? [] : [chapter.favourites]),
    ...(creating() ? [chapter.studio] : []),
  ]);

  /** the title of a chapter that has no sky of its own */
  const hero = () =>
    view().page === "favourites"
      ? {
          quiet: true,
          title: <Trans>Your saved designs</Trans>,
          text: (
            <Trans>
              Tap the heart on any design to keep it here. Only you see this
              list.
            </Trans>
          ),
          art: isLoggedIn() ? <WornCard /> : undefined,
        }
      : undefined;

  // hidden with the other staff and creator tools for now
  const hasTools = () =>
    STAFF_TOOLS_ENABLED &&
    !isDesignsSite() &&
    (can(perms(), "cosmetics.review") ||
      can(perms(), "cosmetics.manage_creators"));

  return (
    <Base
      style={{
        ...designsTokens,
        "--dz-under": isDesignsSite() ? "72px" : "0px",
      }}
    >
      <Scroll data-designs-scroll>
        <Content>
          {/* no bar above: the way back, the title and the chapters are one stage */}
          <StagePanel
            site={isDesignsSite()}
            // on its own site the way back opens the app
            onLeave={() =>
              isDesignsSite()
                ? window.location.assign(appUrl())
                : navigate("/app")
            }
            chapters={chapters()}
            hero={hero()}
            // on Explore the search filters in place; elsewhere typing here
            // opens Explore with the results
            search={
              active("home") || active("wall")
                ? { value: typed(), onInput: setTyped }
                : {
                    value: "",
                    onInput: (value) => {
                      go("");
                      setTimeout(() => {
                        setTyped(value);
                        document
                          .querySelector<HTMLInputElement>(
                            "main input[type=search]",
                          )
                          ?.focus();
                      });
                    },
                  }
            }
          />

          {/* tools, each with its name, only for those who have them */}
          <Show when={hasTools()}>
            <CreatorTools>
              <Show when={can(perms(), "cosmetics.review")}>
                <ToolButton type="button" onClick={() => setDialog("review")}>
                  <Icon name="seal-check" size={16} />
                  <Trans>Review queue</Trans>
                  <Show when={waiting()}>
                    <b>{waiting()}</b>
                  </Show>
                </ToolButton>
              </Show>
              <Show when={can(perms(), "cosmetics.manage_creators")}>
                <ToolButton type="button" onClick={() => setDialog("creators")}>
                  <Icon name="users-three" size={16} />
                  <Trans>Manage creators</Trans>
                </ToolButton>
              </Show>
            </CreatorTools>
          </Show>

          <Switch>
            <Match when={view().page === "home" || view().page === "wall"}>
              <DesignsHome
                filter={filter()}
                onFilter={(next) => go(next === "all" ? "" : `/${next}`)}
                query={query()}
                onQuery={setTyped}
                version={version()}
                onOpen={setOpen}
                onDesign={(slug) => go(`/${slug}`)}
                onMaker={(id) => go(`/creator/${id}`)}
              />
            </Match>

            <Match
              when={
                view().page === "studio" &&
                !isDesignsSite() &&
                permissions.failed()
              }
            >
              <Notice
                role="alert"
                icon="warning-circle"
                title={<Trans>Creator Studio couldn't be opened</Trans>}
                action={{
                  label: <Trans>Try again</Trans>,
                  onClick: permissions.retry,
                  disabled: permissions.retrying(),
                }}
              >
                <Trans>
                  We couldn't check your creator rank. Try again in a moment.
                </Trans>
              </Notice>
            </Match>

            <Match
              when={view().page === "studio" && !isDesignsSite() && !perms()}
            >
              <Notice role="status" title={<Trans>Loading…</Trans>} />
            </Match>

            <Match
              when={
                view().page === "studio" && creating() && maySeeStudio(perms())
              }
            >
              <Scene>
                <SkyBand>
                  <Sky lit={1} />
                </SkyBand>
                <Head>
                  <h1>
                    <Trans>Creator Studio</Trans>
                  </h1>
                  <p>
                    <Show
                      when={!readOnly()}
                      fallback={<Trans>The designs you made, kept here.</Trans>}
                    >
                      <Trans>
                        Make decorations, nameplates and effects for everyone.
                        Designs go live with your name on them; effects go to a
                        reviewer first, and reviewers can take down anything
                        that breaks the rules.
                      </Trans>
                    </Show>
                  </p>
                </Head>
                <CreatorStudio
                  page
                  show
                  onClose={() => go("")}
                  perms={perms()!}
                  avatar={wearer.avatar()}
                  name={wearer.name()}
                />
              </Scene>
            </Match>

            <Match when={view().page === "favourites"}>
              <Favourites
                version={version()}
                onOpen={setOpen}
                onDesign={(slug) => go(`/${slug}`)}
                onBrowse={() => go("")}
                onSignIn={() => signedIn()}
              />
            </Match>

            <Match when={view().page === "creators"}>
              <CreatorsScene
                version={version()}
                onStudio={studio()}
                paused={readOnly()}
                onGallery={() => go("")}
                onCreator={(id) => go(`/creator/${id}`)}
              />
            </Match>

            <Match when={view().page === "creator" && view()}>
              {(current) => (
                <CreatorPage
                  id={(current() as { id: string }).id}
                  version={version()}
                  onOpen={setOpen}
                  onDesign={(slug) => go(`/${slug}`)}
                  onBack={() => go("/creators")}
                />
              )}
            </Match>

            <Match when={view().page === "design" && view()}>
              {(current) => (
                <DesignPage
                  slug={(current() as { slug: string }).slug}
                  site={isDesignsSite()}
                  base={base}
                  onRoom={(tab) => go(`/${tab}`)}
                  onCreator={(id) => go(`/creator/${id}`)}
                />
              )}
            </Match>
          </Switch>

          {/* you, wherever designs are on show */}
          <Show
            when={!isDesignsSite() && !active("studio") && !active("design")}
          >
            <Dock />
          </Show>
        </Content>
      </Scroll>

      <Show when={open()}>
        {(item) => (
          <DesignDialog
            item={item()}
            onClose={() => setOpen(undefined)}
            onChanged={() => setVersion((v) => v + 1)}
            onCreator={(id) => {
              setOpen(undefined);
              go(`/creator/${id}`);
            }}
          />
        )}
      </Show>

      <Show when={dialog() === "review" && perms()}>
        <ReviewQueue
          show
          onClose={() => {
            setDialog(undefined);
            setVersion((v) => v + 1);
          }}
          perms={perms()!}
          avatar={client().user?.animatedAvatarURL}
          name={client().user?.displayName ?? ""}
        />
      </Show>
      <Show when={dialog() === "creators" && perms()}>
        <CreatorsAdmin
          show
          onClose={() => setDialog(undefined)}
          perms={perms()!}
        />
      </Show>
    </Base>
  );
}

function Favourites(props: {
  version: number;
  onOpen: (item: CommunityItem) => void;
  onDesign: (slug: string) => void;
  onBrowse: () => void;
  onSignIn: () => void;
}) {
  const { isLoggedIn } = useClientLifecycle();
  const toTiles = useCommunityTiles();
  const community = useCommunity(() => ({
    favourites: true,
    version: props.version,
    off: !isLoggedIn(),
  }));
  const tiles = createMemo(() =>
    toTiles(community.items(), community.creators()).map((tile, i) => ({
      ...tile,
      big: i % 5 === 0,
    })),
  );
  return (
    <Switch>
      <Match when={!isLoggedIn()}>
        <Notice
          art={<Samples kind="saved" />}
          title={<Trans>Keep the designs you love</Trans>}
          action={{
            label: <Trans>Log in</Trans>,
            onClick: props.onSignIn,
            filled: true,
          }}
        >
          <Trans>Log in to save designs and find them on any device.</Trans>
        </Notice>
      </Match>
      <Match when={community.loading() && !tiles().length}>
        <WallHolders />
      </Match>
      <Match when={community.failed()}>
        <LoadError onRetry={community.retry} />
      </Match>
      <Match when={!tiles().length}>
        <Notice
          art={<Samples kind="saved" />}
          title={<Trans>No favourites yet</Trans>}
          action={{
            label: <Trans>Browse designs</Trans>,
            onClick: props.onBrowse,
            filled: true,
          }}
        >
          <Trans>Tap the heart on a design to save it here.</Trans>
        </Notice>
      </Match>
      <Match when={true}>
        <Wall
          tiles={tiles()}
          more={community.more()}
          loading={community.loading()}
          onMore={community.next}
          onOpen={props.onOpen}
          onDesign={props.onDesign}
        />
      </Match>
    </Switch>
  );
}

/** Large preview, details and Apply / Remove for one design */
function DesignDialog(props: {
  item: CommunityItem;
  onClose: () => void;
  onChanged: () => void;
  onCreator: (id: string) => void;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const { isLoggedIn } = useClientLifecycle();
  const { openModal } = useModals();
  const describeError = useError();
  const date = useDate();
  const wear = useWearDesign();
  const signedIn = useAccountGate();

  const [details] = createResource(
    () => props.item._id,
    (id) => communityApi.details(client(), id),
  );
  const item = () => details()?.item ?? props.item;
  const field = () =>
    item().kind === "Decoration" ? "decoration" : "nameplate";
  /** the design on the viewer's own profile, with what they wear already */
  const worn = (): UserStyle => ({
    ...userStyleOf(client().user),
    [field()]: `c:${item()._id}`,
    [`${field()}_file`]: item().file._id,
  });
  const wearing = () =>
    userStyleOf(client().user)?.[field()] === `c:${item()._id}`;
  const [favourite, setFavourite] = createSignal<boolean>();
  const isFavourite = () => favourite() ?? !!item().favourite;
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  /** With an account the report dialog, without one the public form */
  const report = () =>
    isLoggedIn()
      ? openModal({
          type: "report_content",
          client: client(),
          target: {
            kind: "CommunityItem",
            id: item()._id,
            label: item().name,
          },
        })
      : window.location.assign(
          publicReportUrl(
            "CommunityItem",
            `${designsUrl()}/${item()._id}`,
            i18n().locale,
          ),
        );

  async function run(action: () => Promise<unknown>) {
    if (!signedIn()) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      props.onChanged();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      show
      onClose={props.onClose}
      title={<bdi>{item().name}</bdi>}
      size="lg"
      error={error()}
    >
      <DetailBody>
        <Mirror style={worn()} />

        <Info>
          {/* a creator who is not public has no name and no page to open */}
          <Show when={details()?.creator}>
            {(creator) => (
              <Show
                when={hasOpenPage(creator())}
                fallback={<CreatorChip creator={creator()} size={22} verbose />}
              >
                <button
                  type="button"
                  class="creator"
                  onClick={() => props.onCreator(item().creator_id)}
                >
                  <CreatorChip creator={creator()} size={22} verbose />
                </button>
              </Show>
            )}
          </Show>
          <Show when={item().description}>
            <p dir="auto">{item().description}</p>
          </Show>
          <Show when={item().tags?.length}>
            <Tags>
              <For each={item().tags}>
                {(tag) => (
                  <span>
                    <bdi>#{tag}</bdi>
                  </span>
                )}
              </For>
            </Tags>
          </Show>
          <Facts>
            <span>
              <Icon name="users-three" size={14} />
              <Trans>Worn by {item().popularity}</Trans>
            </span>
            <Show when={item().published_at}>
              <span>
                <Icon name="clock" size={14} />
                <Trans>Published {date(item().published_at)}</Trans>
              </span>
            </Show>
            <span>
              <Icon
                name={
                  item().kind === "Decoration"
                    ? "user-circle"
                    : "identification-card"
                }
                size={14}
              />
              {item().kind === "Decoration"
                ? t`Avatar decoration`
                : t`Nameplate`}
            </span>
          </Facts>
          <Buttons>
            <Show when={!isDesignsSite()}>
              <Show
                when={wearing()}
                fallback={
                  <button
                    type="button"
                    data-primary
                    disabled={busy()}
                    onClick={() =>
                      void run(() => wear(field(), `c:${item()._id}`))
                    }
                  >
                    <Trans>Apply</Trans>
                  </button>
                }
              >
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() => void run(() => wear(field(), undefined))}
                >
                  <Trans>Remove</Trans>
                </button>
              </Show>
              <button
                type="button"
                aria-pressed={isFavourite()}
                title={
                  isFavourite()
                    ? t`Remove from favourites`
                    : t`Add to favourites`
                }
                onClick={() => {
                  const on = !isFavourite();
                  setFavourite(on);
                  void run(() =>
                    communityApi.favourite(client(), item()._id, on),
                  ).then(() => error() && setFavourite(!on));
                }}
              >
                <Icon name="heart" size={16} filled={isFavourite()} />
                <Show when={isFavourite()} fallback={<Trans>Save</Trans>}>
                  <Trans>Saved</Trans>
                </Show>
              </button>
            </Show>
            <Show when={item().creator_id !== client().user?.id}>
              <button
                type="button"
                data-quiet
                data-design-report
                onClick={report}
              >
                <Icon name="flag" size={14} />
                <Trans>Report</Trans>
              </button>
            </Show>
          </Buttons>
          <Show when={wearing()}>
            <small class="hint">
              <Icon name="check" size={13} />
              <Trans>
                You're wearing this. Everyone sees it on your profile.
              </Trans>
            </small>
          </Show>
        </Info>
      </DetailBody>
    </Dialog>
  );
}

/**
 * Designs wears the app's Midnight Pulse tokens (designsTokens on the
 * root), here and on its own site.
 */
const Base = styled("main", {
  base: {
    position: "relative",
    isolation: "isolate",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    minHeight: 0,
    color: "var(--z-fg-primary)",
    background: "var(--z-designs-page)",
    "& ::selection": {
      background: "color-mix(in srgb, var(--z-designs-pink) 35%, transparent)",
    },
  },
});

const Scroll = styled("div", {
  base: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflowY: "auto",
    overflowX: "clip",
    // the banners run the width of this box, in the app and on the site
    containerType: "inline-size",
  },
});

const Content = styled("div", {
  base: {
    // the bar's top mark scrolls with this box, in the app and on the site
    position: "relative",
    width: "100%",
    maxWidth: "1200px",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: "16px clamp(16px, 3vw, 40px) 24px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    _phone: { padding: "8px 16px 24px", gap: "16px" },
  },
});

const DetailBody = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "24px",
    alignItems: "start",
    "@media (max-width: 720px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Info = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    "& .creator": {
      alignSelf: "flex-start",
      padding: 0,
      border: "none",
      background: "none",
      font: "inherit",
      cursor: "pointer",
    },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
      textAlign: "start",
      whiteSpace: "pre-wrap",
    },
    "& .hint": {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      color: "var(--z-fg-muted)",
      "--z-icon-color": "var(--z-designs-status-online)",
    },
  },
});

const Tags = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    "& span": {
      height: "24px",
      lineHeight: "24px",
      paddingInline: "9px",
      borderRadius: "var(--z-shape-chip, 6px)",
      fontSize: "12px",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Facts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "14px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "& span": {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      "--z-icon-color": "currentColor",
    },
  },
});

const Buttons = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px",
    "& button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      height: "40px",
      paddingInline: "16px",
      border: "1px solid var(--z-designs-edge)",
      borderRadius: "var(--z-shape-button, 10px)",
      background: "var(--z-designs-button)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      fontWeight: 600,
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
      _hover: { background: "var(--z-designs-button-hover)" },
      _disabled: { opacity: 0.5, cursor: "not-allowed" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      _phone: { height: "44px" },
    },
    "& button[data-primary]": {
      border: "none",
      color: "var(--z-designs-on-pink)",
      background: "var(--z-designs-fill)",
      _hover: { background: "var(--z-designs-fill-hover)" },
      "&:active": { background: "var(--z-designs-fill-pressed)" },
    },
    "& button[aria-pressed='true']": {
      "--z-icon-color": "var(--z-designs-pink)",
    },
    "& button[data-quiet]": {
      border: "none",
      background: "transparent",
      color: "var(--z-fg-muted)",
      paddingInline: "8px",
    },
    "& button[data-danger='true']": { color: "var(--z-danger)" },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

/**
 * Home: a row of fresh community designs on the viewer's own avatar,
 * leading into the designs page. Hidden while there are none.
 */
export function DesignsStrip() {
  const client = useClient();
  const navigate = useNavigate();
  const [data] = createResource(async () =>
    merge([
      await communityApi
        .list(client(), "decorations", { limit: 6 })
        .catch(() => ({ items: [], creators: [] })),
    ]),
  );
  return (
    <Show when={data()?.items.length}>
      <StripSection>
        <StripHead>
          <h2>
            <Trans>New from creators</Trans>
          </h2>
          <button type="button" onClick={() => navigate(designsBase() || "/")}>
            <Trans>All designs</Trans>
          </button>
        </StripHead>
        <Strip>
          <For each={data()!.items}>
            {(item) => (
              <StripItem
                type="button"
                title={item.name}
                onClick={() => navigate(`${designsBase()}/decorations`)}
              >
                <Preview item={item} size={48} />
                <span>
                  <bdi>{item.name}</bdi>
                </span>
                <small>
                  <bdi>{creatorName(data()!.creators[item.creator_id])}</bdi>
                </small>
              </StripItem>
            )}
          </For>
        </Strip>
      </StripSection>
    </Show>
  );
}

/** same heading style as the other Home sections */
const StripSection = styled("section", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const StripHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "24px",
    "& h2": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
    "& button": {
      // 24 px target everywhere (WCAG 2.5.8), 44 px on phones (phone rules)
      minHeight: "24px",
      _phone: { minWidth: "44px", minHeight: "44px", marginBlock: "-10px" },
      padding: 0,
      border: "none",
      background: "none",
      font: "inherit",
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--z-accent-text, var(--z-accent))",
      cursor: "pointer",
      _hover: { textDecoration: "underline" },
    },
  },
});

const Strip = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
    gap: "10px",
  },
});

const StripItem = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    padding: "14px 8px 10px",
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "var(--z-shape-card, 14px)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    cursor: "pointer",
    _hover: {
      borderColor: "var(--z-designs-edge-hover)",
    },
    // decoration art is 1.5x the avatar: keep room for all of it
    "& > .z-deco": { margin: "12px" },
    "& > span:not(.z-deco), & > small": {
      maxWidth: "100%",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
    "& > span:not(.z-deco)": { fontSize: "13px", fontWeight: 650 },
    "& > small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});
