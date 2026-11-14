import {
  For,
  JSX,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { isolate } from "@revolt/common/lib/isolate";
import { styled } from "styled-system/jsx";

import {
  CATEGORIES,
  CardRoom,
  DiscoverKind,
  Hero,
  Listing,
  ListingCard,
  ListingDetail,
  PrimaryButton,
  ServerPage,
  discoverApi,
  findLocal,
  fromBot,
  fromServer,
  mergeResults,
  once,
  paletteTokens,
  useDiscoverLabels,
} from "@revolt/app/interface/discover";
import { useClient, useClientLifecycle } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { CONFIGURATION } from "@revolt/common";
import { useModals } from "@revolt/modal";
import type { PromoteTarget } from "@revolt/modal/modals/PromoteServer";
import { useLocation, useNavigate } from "@revolt/routing";

import { Segmented as SortChoice } from "@revolt/ui/components/design/Segmented";
import { Icon, IconName } from "@revolt/ui/icons/Icon";

import { useOpenInApp } from "@revolt/app/interface/discover/OpenInApp";
import {
  WEBSITE_URL,
  appUrl,
  developersUrl,
  publicReportUrl,
} from "@revolt/app/interface/discover/sites";
import { discoverBase, isDiscoverSite } from "../siteHost";

/**
 * Discover is served by the Zrzur API itself (`/discover/*`); it never
 * embeds or contacts upstream Stoat/Revolt Discover sites. The same page
 * runs inside the app (under /discover) and on its own as the standalone
 * Discover site (at the root of VITE_DISCOVER_URL), where browsing needs
 * no account.
 *
 *   /servers, /bots          browse: hero, paid places, picks, categories
 *   ?q= &category= &tag= &sort=new   results, shareable as a link
 *   /servers/:id, /bots/:id  details over the page
 *
 * Moderator tools (the review queue, feature / remove) are not part of
 * Discover; they get their own place.
 */

const PAGE_SIZE = 24;

/** The site's header: the light at the top runs behind it */
const SITE_HEADER = "72px";

type Sort = "popular" | "new";
type Filters = {
  /** every listing, no search or filter (from "See all") */
  all?: boolean;
  q?: string;
  category?: string;
  /** listing language: ar, en or de */
  language?: string;
  tag?: string;
  sort?: Sort;
};

/** Languages with their own Discover page (/ar, /en, /de) */
const PAGE_LANGUAGES = ["ar", "en", "de"];

export function Discover() {
  const client = useClient();
  const { isLoggedIn } = useClientLifecycle();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal, showError } = useModals();
  const { t, i18n } = useLingui();
  const labels = useDiscoverLabels();
  const inApp = useOpenInApp();

  const site = isDiscoverSite();
  const base = discoverBase();

  // Where we are, below the base path:
  //   /                     servers: browse
  //   /<topic>, /<ar|en|de> servers on one topic or in one language
  //   /<custom link or id>  a server's own page (also /servers/<id>)
  //   /bots, /bots/<id>     bots, with details over the page
  const segments = () => {
    const path = location.pathname;
    const rest = base && path.startsWith(base) ? path.slice(base.length) : path;
    return rest.split("/").filter(Boolean);
  };
  const first = () => segments()[0];
  const kind = (): DiscoverKind => (first() === "bots" ? "bots" : "servers");
  const topicPage = () =>
    CATEGORIES.servers.find((item) => item.id === first())?.id;
  const languagePage = () =>
    PAGE_LANGUAGES.find((language) => language === first());
  const serverSlug = () => {
    const [a, b] = segments();
    if (a === "servers") return b;
    if (a && a !== "bots" && !topicPage() && !languagePage()) return a;
    return undefined;
  };
  const detailId = () => (first() === "bots" ? segments()[1] : undefined);

  const params = createMemo(() => new URLSearchParams(location.search));
  const q = () => params().get("q")?.trim() ?? "";
  const category = () => {
    const value = params().get("category") ?? topicPage();
    return CATEGORIES[kind()].some((item) => item.id === value)
      ? value
      : undefined;
  };
  const language = () => params().get("language") ?? languagePage();
  const tag = () => params().get("tag")?.trim() || undefined;
  const sort = (): Sort => (params().get("sort") === "new" ? "new" : "popular");
  const all = () => params().get("view") === "all";

  /**
   * A Discover link, keeping the base path of the app or the site. Servers
   * on one topic or in one language have their own pages (/gaming, /ar)
   * for search engines and sharing.
   */
  const href = (k: DiscoverKind, filters: Filters = {}, id?: string) => {
    const search = new URLSearchParams();
    if (filters.all) search.set("view", "all");
    if (filters.q) search.set("q", filters.q);
    if (filters.tag) search.set("tag", filters.tag);
    if (filters.sort === "new") search.set("sort", "new");
    let path = k === "servers" ? "" : `/${k}`;
    if (k === "servers" && !id && filters.category && !filters.language)
      path = `/${filters.category}`;
    else if (k === "servers" && !id && filters.language && !filters.category)
      path = `/${filters.language}`;
    else {
      if (filters.category) search.set("category", filters.category);
      if (filters.language) search.set("language", filters.language);
    }
    if (id) path = k === "servers" ? `/${id}` : `${path}/${id}`;
    const query = search.toString();
    // at the root of the site a bare "?q=" would stay on the page it is on
    return `${`${base}${path}` || "/"}${query ? `?${query}` : ""}`;
  };
  const current = (): Filters => ({
    all: all() && !q() && !category() && !tag() && !language(),
    q: q() || undefined,
    category: category(),
    language: language(),
    tag: tag(),
    sort: sort(),
  });
  const filter = (next: Filters, replace = false) =>
    navigate(href(kind(), { ...current(), ...next }), { replace });

  // The search field follows the link and writes back after a pause
  const [typed, setTyped] = createSignal(q());
  createEffect(on(q, (value) => value !== typed().trim() && setTyped(value)));
  let searchInput: HTMLInputElement | undefined;
  let searchToggle: HTMLButtonElement | undefined;
  let scroller: HTMLElement | undefined;
  let topMark: HTMLDivElement | undefined;
  // once the top has scrolled away the bar stands on a solid strip. An
  // observer, not a scroll listener: nothing runs while the page scrolls.
  const [stuck, setStuck] = createSignal(false);
  // phones: the search opens from an icon
  const [searchOpen, setSearchOpen] = createSignal(!!q());
  onMount(() => {
    if (!topMark) return;
    const observer = new IntersectionObserver((entries) =>
      setStuck(!entries[entries.length - 1].isIntersecting),
    );
    observer.observe(topMark);
    onCleanup(() => observer.disconnect());
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onType = (value: string) => {
    forgetOrigin();
    setTyped(value);
    clearTimeout(timer);
    timer = setTimeout(
      () => filter({ q: value.trim() || undefined }, !!q() && !!value.trim()),
      120,
    );
  };
  onCleanup(() => clearTimeout(timer));

  /** Enter: search now, without the pause */
  const searchNow = () => {
    clearTimeout(timer);
    if (typed().trim()) filter({ q: typed().trim() });
  };

  // "/" anywhere on the page jumps into the search (listed in Ctrl+/)
  const onSlash = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      e.key !== "/" ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      target?.closest("input, textarea, [contenteditable='true']")
    )
      return;
    e.preventDefault();
    setSearchOpen(true);
    requestAnimationFrame(() => searchInput?.focus());
  };
  document.addEventListener("keydown", onSlash);
  onCleanup(() => document.removeEventListener("keydown", onSlash));

  // Escape leaves a server's page; dialogs and menus over it go first
  const onEscape = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      e.key !== "Escape" ||
      e.defaultPrevented ||
      !serverSlug() ||
      target?.closest("input, textarea, [contenteditable='true']") ||
      document.querySelector('[role="dialog"], [role="menu"]')
    )
      return;
    e.preventDefault();
    if (returnTo) navigate(-1);
    else navigate(base || "/");
  };
  document.addEventListener("keydown", onEscape);
  onCleanup(() => document.removeEventListener("keydown", onEscape));

  const browsing = () => !all() && !q() && !category() && !tag() && !language();
  /** Typing shows results at once, before the link catches up */
  const typing = () => !!typed().trim();
  const showResults = () => !browsing() || typing();

  // Data
  const [featured, setFeatured] = createSignal<Listing[]>([]);
  const [popular, setPopular] = createSignal<Listing[]>([]);
  const [fresh, setFresh] = createSignal<Listing[]>([]);
  const [results, setResults] = createSignal<Listing[]>([]);
  /** The search words the API last answered, with results above */
  const [answered, setAnswered] = createSignal<string>();
  const [extra, setExtra] = createSignal<Listing>();
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(false);
  const [busy, setBusy] = createSignal<string>();
  const [copied, setCopied] = createSignal<string>();
  const [promotedRow, setPromotedRow] = createSignal<{
    slots: number;
    open: number;
    items: Listing[];
  }>();

  const fetchListings = async (
    k: DiscoverKind,
    query: Parameters<typeof discoverApi.servers>[1],
  ) =>
    k === "servers"
      ? (await discoverApi.servers(client(), query)).map(fromServer)
      : (await discoverApi.bots(client(), query)).map(fromBot);

  // Each load gets a token so stale responses (old tab or filter) are dropped
  let token = 0;
  // two loads in a row can fail alike: say it once
  let saidFailed = false;

  async function load(reset = true) {
    const current = ++token;
    const k = kind();
    setLoading(true);
    setFailed(false);

    try {
      if (browsing()) {
        const [f, p, n, row] = await Promise.all([
          fetchListings(k, { featured: true, limit: 6 }),
          fetchListings(k, { sort: "popular", limit: PAGE_SIZE }),
          fetchListings(k, { sort: "new", limit: 8 }),
          // visitors have no billing state: the API answers for them
          !billingAvailable() && !site
            ? undefined
            : k === "servers"
              ? discoverApi
                  .promoted(client())
                  .then((row) => ({
                    ...row,
                    items: row.servers.map(fromServer),
                  }))
                  .catch(() => undefined)
              : discoverApi
                  .promotedBots(client())
                  .then((row) => ({ ...row, items: row.bots.map(fromBot) }))
                  .catch(() => undefined),
        ]);
        if (current !== token) return;
        saidFailed = false;
        setFeatured(f);
        setPopular(p);
        setFresh(n);
        setPromotedRow(
          // no places on sale (billing off): no row, in the app and on the site
          row && row.slots > 0
            ? { slots: row.slots, open: row.open, items: row.items }
            : undefined,
        );
        return;
      }

      const page = await fetchListings(k, {
        query: q() || undefined,
        category: category(),
        language: language(),
        tag: tag(),
        sort: sort(),
        limit: PAGE_SIZE,
        offset: reset ? 0 : results().length,
      });
      if (current !== token) return;
      saidFailed = false;
      setResults(reset ? page : [...results(), ...page]);
      setAnswered(q());
      setHasMore(page.length === PAGE_SIZE);
    } catch (error) {
      if (current !== token) return;
      setFailed(true);
      if (!saidFailed) showError(error);
      saidFailed = true;
    } finally {
      if (current === token) setLoading(false);
    }
  }

  // billing arrives after the page: load again once it is known, so the
  // paid top row shows on a fresh visit too. Also runs on leaving a server's
  // page that was opened directly; lists already here stay, as new cards
  // would drop the keyboard focus.
  let loaded: string | undefined;
  createEffect(
    on(
      [
        kind,
        all,
        q,
        category,
        language,
        tag,
        sort,
        billingAvailable,
        serverSlug,
      ],
      (values) => {
        if (serverSlug()) return;
        const key = JSON.stringify(values.slice(0, -1));
        if (key === loaded) return;
        loaded = key;
        load(true);
      },
    ),
  );

  /** Everything the page already knows, for answering on the keystroke */
  const pool = createMemo(() =>
    [...featured(), ...popular(), ...fresh(), ...results()].filter(
      (item) =>
        item.kind === kind() &&
        (!category() || item.category === category()) &&
        (!language() || item.language === language()) &&
        (!tag() || item.tags.includes(tag()!)),
    ),
  );

  /** Results on the screen: what the page can tell now, then the API's list */
  const shown = createMemo(() => {
    const words = typed().trim();
    if (!words) return results();
    const local = findLocal(pool(), words);
    return words === answered() ? mergeResults(results(), local) : local;
  });
  const waiting = () =>
    loading() || (typing() && typed().trim() !== answered());

  /** Load more: focus moves on to the first new card */
  const loadMore = async (button: HTMLElement) => {
    const from = shown().length;
    // read first: the button is disabled, and so loses focus, while it loads
    const focused = document.activeElement === button;
    await load(false);
    if (!focused) return;
    if (shown().length === from) return focusView();
    requestAnimationFrame(() =>
      scroller
        ?.querySelectorAll<HTMLElement>("[data-listing] > button")
        [from]?.focus(),
    );
  };

  /** The biggest paid place of all */
  const headline = createMemo(() =>
    [...popular(), ...featured()].find((item) => item.boost === "MegaBoost"),
  );

  /**
   * What the browse page shows. A listing appears once: one listed server
   * is a feature of its own, not the same card three times.
   */
  const page = createMemo(() => {
    const seen = new Set<string>();
    const paid = headline();
    if (paid) seen.add(paid.id);
    const topRow = once(promotedRow()?.items ?? [], seen);
    const picked = once(featured(), seen);
    return {
      paid,
      topRow,
      picked,
      /** Most members first, as the API ranks them */
      list: once([...popular(), ...featured(), ...fresh()], seen),
    };
  });

  // Detail view: from loaded lists, or fetched for deep links
  const detail = createMemo(
    () => {
      const id = detailId();
      if (!id) return undefined;
      return (
        [
          ...featured(),
          ...popular(),
          ...fresh(),
          ...results(),
          ...(promotedRow()?.items ?? []),
        ].find((item) => item.id === id) ??
        (extra()?.id === id ? extra() : undefined)
      );
    },
    undefined,
    { equals: (a, b) => a?.id === b?.id },
  );

  createEffect(
    on(detailId, async (id) => {
      if (!id || detail()) return;
      try {
        setExtra(
          kind() === "servers"
            ? fromServer(await discoverApi.server(client(), id))
            : fromBot(await discoverApi.bot(client(), id)),
        );
      } catch {
        navigate(href(kind(), current()), { replace: true });
      }
    }),
  );

  /** What really scrolls: this page in the app, the whole frame on the site */
  const scrollBox = () => {
    for (let el = scroller ?? null; el; el = el.parentElement)
      if (getComputedStyle(el).overflowY === "auto") return el;
    return undefined;
  };

  /** Each card's way in; one listing can sit in several sections */
  const openButtons = (id: string) =>
    Array.from(
      scroller?.querySelectorAll<HTMLElement>(
        `[data-listing="${CSS.escape(id)}"] > button`,
      ) ?? [],
    );

  // A server opens as a page in place of the lists: remember which card it
  // came from (nth is -1 for a pointer) to land on it again
  let returnTo:
    | { id: string; nth: number; top: number; from: string }
    | undefined;
  /** Going on from a server's page (search, tab, link) is not going back */
  const forgetOrigin = () => (returnTo = undefined);
  const here = () => location.pathname + location.search;

  /** When the focused control left with the old view, its heading takes over */
  const focusView = () =>
    requestAnimationFrame(() => {
      const focused = document.activeElement;
      if (focused && focused !== document.body) return;
      scroller?.querySelector<HTMLElement>("[data-view-heading]")?.focus();
    });

  createEffect(
    on(browsing, () => !serverSlug() && focusView(), { defer: true }),
  );

  createEffect(
    on(
      serverSlug,
      (slug, previous) => {
        if (slug) {
          const box = scrollBox();
          if (!previous && box) box.scrollTop = 0;
          return;
        }
        const back = returnTo;
        forgetOrigin();
        if (back?.from !== here()) return focusView();
        requestAnimationFrame(() => {
          const box = scrollBox();
          if (box) box.scrollTop = back.top;
          if (back.nth < 0) return;
          const cards = openButtons(back.id);
          const card = cards[back.nth] ?? cards[0];
          if (card) card.focus();
          else focusView();
        });
      },
      { defer: true },
    ),
  );

  const openDetail = (item: Listing) => {
    if (item.kind === "servers") {
      returnTo = {
        id: item.id,
        nth: openButtons(item.id).indexOf(
          document.activeElement as HTMLElement,
        ),
        top: scrollBox()?.scrollTop ?? 0,
        from: here(),
      };
    }
    if (item.promoted && isLoggedIn()) {
      discoverApi
        .event(client(), item.kind, item.id, "click")
        .catch(() => undefined);
    }
    navigate(
      item.kind === "servers"
        ? href("servers", {}, item.link ?? item.id)
        : href(item.kind, current(), item.id),
    );
  };
  const closeDetail = () => navigate(href(kind(), current()));

  // Top-row views count once per server per visit (the server also
  // counts each person once a day)
  const seen = new Set<string>();
  createEffect(() => {
    if (!isLoggedIn()) return;
    for (const item of promotedRow()?.items ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      discoverApi
        .event(client(), item.kind, item.id, "view")
        .catch(() => undefined);
    }
  });

  // your bots, for the "your bot here" place on the bots tab
  const [ownBots] = createResource(
    () =>
      kind() === "bots" && billingAvailable() && isLoggedIn()
        ? true
        : undefined,
    () =>
      client()
        .bots.fetchOwned()
        .catch(() => undefined),
  );

  /** A server or bot of yours that could take a free top-row place */
  const promotable = createMemo((): PromoteTarget | undefined => {
    if (site) return undefined;
    const taken = new Set(promotedRow()?.items.map((item) => item.id));
    if (kind() === "bots") {
      const bot = (ownBots() ?? []).find((bot) => !taken.has(bot.id));
      const user = bot ? client().users.get(bot.id) : undefined;
      return bot
        ? {
            kind: "bot",
            id: bot.id,
            name: user?.displayName ?? bot.id,
            icon: user?.animatedAvatarURL,
          }
        : undefined;
    }
    const servers = client()
      .servers.toList()
      .filter(
        (server) =>
          !taken.has(server.id) && server.havePermission("ManageServer"),
      );
    const server = servers.find((server) => server.owner?.self) ?? servers[0];
    return server
      ? {
          kind: "server",
          id: server.id,
          name: server.name,
          icon: server.iconURL,
        }
      : undefined;
  });

  /** A server you own that is not on Discover yet */
  const unlisted = createMemo(() =>
    site
      ? undefined
      : client()
          .servers.toList()
          .find((server) => server.owner?.self && !server.discoverable),
  );

  const pickTag = (value: string) => navigate(href(kind(), { tag: value }));
  /** A topic starts a fresh list, as a tag does; pressed again it comes off */
  const pickCategory = (value: string) => {
    clearTimeout(timer);
    setTyped("");
    navigate(
      href(kind(), { category: category() === value ? undefined : value }),
    );
  };
  const clearAll = () => navigate(href(kind()));

  // Actions
  const isMember = (id: string) => client().servers.has(id);

  async function joinServer(item: Listing) {
    const id = item.id;
    // the site has no chat: without an account here, the app takes over
    // and brings them back to this server after signing in
    if (site && !isLoggedIn()) {
      inApp.open(`/discover/${item.link ?? id}?join=1`, item.name);
      return;
    }
    if (isMember(id)) {
      if (site) window.location.assign(`${appUrl()}/server/${id}`);
      else navigate(`/server/${id}`);
      return;
    }

    setBusy(id);
    try {
      // Joining a discoverable server by its ID uses an unstored invite;
      // a server that takes requests records one instead
      const result = (await client().api.post(`/invites/${id as ""}`)) as {
        type?: string;
      };
      if (result?.type === "JoinRequest") {
        navigate(href("servers", {}, item.link ?? id));
        return;
      }
      if (site) window.location.assign(`${appUrl()}/server/${id}`);
      else navigate(`/server/${id}`);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(undefined);
    }
  }

  async function addBot(id: string) {
    if (site) {
      // choosing a server to add it to happens in the app
      window.location.assign(`${appUrl()}/bot/${id}`);
      return;
    }
    setBusy(id);
    try {
      const invite = await client().bots.fetchPublic(id);
      openModal({ type: "add_bot", invite });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(undefined);
    }
  }

  /** Link to a listing on the standalone site, or here on the site itself */
  const shareUrl = (item: Listing) => {
    if (site) return `${window.location.origin}/${item.kind}/${item.id}`;
    return CONFIGURATION.DISCOVER_URL
      ? `${CONFIGURATION.DISCOVER_URL}/${item.kind}/${item.id}`
      : undefined;
  };

  const copyLink = (item: Listing, url: string) =>
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(item.id);
        setTimeout(() => setCopied(undefined), 2000);
      })
      .catch(() => undefined);

  /** Quiet on the wall: the page's one filled button is on the listing itself */
  const cardAction = (item: Listing) => (
    <Show
      when={item.kind === "servers"}
      fallback={
        <PrimaryButton
          type="button"
          data-variant="secondary"
          disabled={busy() === item.id}
          onClick={() => addBot(item.id)}
        >
          <Trans>Add</Trans>
        </PrimaryButton>
      }
    >
      <PrimaryButton
        type="button"
        data-variant="secondary"
        disabled={busy() === item.id}
        onClick={() => joinServer(item)}
      >
        {/* short, for the narrowest card; "Open" alone reads as an adjective */}
        <Show when={isMember(item.id)} fallback={<Trans>Join</Trans>}>
          <Trans>Visit</Trans>
        </Show>
      </PrimaryButton>
    </Show>
  );

  const report = (item: Listing) =>
    !isLoggedIn()
      ? // no account: the public report form on the website (DSA Art. 16)
        window.location.assign(
          publicReportUrl(
            item.kind === "servers" ? "DiscoverServer" : "Bot",
            // the listing itself, never the search that found it
            shareUrl(item) ??
              `${window.location.origin}${href(item.kind, {}, item.link ?? item.id)}`,
            i18n().locale,
          ),
        )
      : openModal({
          type: "report_content",
          client: client(),
          target: {
            kind: item.kind === "servers" ? "DiscoverServer" : "DiscoverBot",
            id: item.id,
            label: item.name,
          },
        });

  const card = (item: Listing) => (
    <ListingCard
      listing={item}
      testId={item.boost === "MegaBoost" ? "discover-headline" : undefined}
      onOpen={() => openDetail(item)}
      action={cardAction(item)}
    />
  );

  /** A free top-row place is offered beside the paid ones */
  const freeSlot = () => !!(promotedRow()?.open && promotable());
  /** Paid places at the top of the page: the headline first, then the row */
  const paidPlaces = () => [
    ...(page().paid ? [page().paid!] : []),
    ...page().topRow,
  ];

  const paidRow = () => (
    <Rows data-top>
      {cards(paidPlaces)}
      <Show when={freeSlot()}>
        <PromoteSlot data-promote-slot>
          <Icon name="megaphone" size={24} />
          <strong>
            <Show
              when={kind() === "bots"}
              fallback={<Trans>Your server here</Trans>}
            >
              <Trans>Your bot here</Trans>
            </Show>
          </strong>
          <span>
            <Show
              when={kind() === "bots"}
              fallback={
                <Trans>
                  Promoted servers show up first for everyone who opens
                  Discover. Get seen and grow faster.
                </Trans>
              }
            >
              <Trans>
                Promoted bots show up first for everyone who looks for bots on
                Discover. Get added to more servers.
              </Trans>
            </Show>
          </span>
          <PromoteSlotButton
            type="button"
            onClick={() => {
              const target = promotable()!;
              const server =
                target.kind === "server"
                  ? client().servers.get(target.id)
                  : undefined;
              if (server) {
                openModal({ type: "promote_server", server });
              } else {
                openModal({ type: "promote_bot", target });
              }
            }}
          >
            <Trans>Promote {isolate(promotable()!.name)}</Trans>
          </PromoteSlotButton>
        </PromoteSlot>
      </Show>
    </Rows>
  );

  /** Cards of one wall, every one in a cell of the same size */
  const cards = (items: () => Listing[]) => (
    <For each={items()}>{(item) => card(item)}</For>
  );

  /** One lit bird per community on the page */
  const listed = () => popular().length + featured().length;

  const tabs = (): { id: DiscoverKind; icon: IconName; label: string }[] => [
    { id: "servers", icon: "users-three", label: t`Servers` },
    { id: "bots", icon: "robot", label: t`Bots` },
  ];

  const resultsTitle = () =>
    typed().trim() || q()
      ? t`Results for “${typed().trim() || q()}”`
      : tag()
        ? `#${tag()}`
        : category()
          ? labels.category(category())
          : kind() === "bots"
            ? t`All bots`
            : t`All servers`;

  const searchLabel = () =>
    kind() === "bots" ? t`Search bots` : t`Search servers`;

  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") searchNow();
    if (e.key !== "Escape") return;
    if (typed()) {
      e.preventDefault();
      onType("");
    } else if (searchOpen()) {
      e.preventDefault();
      setSearchOpen(false);
      searchToggle?.focus();
    }
  };

  /** The one bar: Servers and Bots, and the search at its end */
  const discoverBar = () => (
    <Bar data-stuck={stuck()} data-open={searchOpen()}>
      <Tabs role="tablist" aria-label={t`Discover`}>
        <For each={tabs()}>
          {(item) => (
            <a
              role="tab"
              href={href(item.id)}
              aria-selected={kind() === item.id}
              onClick={(event) => {
                event.preventDefault();
                navigate(href(item.id));
              }}
              onKeyDown={(event) => {
                // links only take Enter; a tab takes Space too
                if (event.key !== " ") return;
                event.preventDefault();
                forgetOrigin();
                navigate(href(item.id));
              }}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </a>
          )}
        </For>
      </Tabs>

      {/* phones: an icon first, the field when tapped */}
      <SearchToggle
        ref={searchToggle}
        type="button"
        aria-label={searchLabel()}
        aria-expanded={searchOpen()}
        onClick={() => {
          setSearchOpen(!searchOpen());
          if (searchOpen()) requestAnimationFrame(() => searchInput?.focus());
        }}
      >
        <Icon name={searchOpen() ? "x" : "magnifying-glass"} size={24} />
      </SearchToggle>

      <Find role="search">
        <Icon name="magnifying-glass" size={16} />
        <input
          ref={searchInput}
          type="search"
          value={typed()}
          placeholder={searchLabel()}
          aria-label={searchLabel()}
          maxLength={64}
          enterkeyhint="search"
          onInput={(e) => onType(e.currentTarget.value)}
          onKeyDown={onSearchKey}
        />
        <Show when={typed()} fallback={<kbd aria-hidden="true">/</kbd>}>
          <button
            type="button"
            aria-label={t`Clear search`}
            onClick={(event) => {
              event.preventDefault();
              onType("");
              searchInput?.focus();
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </Show>
      </Find>
    </Bar>
  );

  const ownersCard = () => (
    /* For owners: how to get listed, the same in the app and on the site */
    <Owners data-owners>
      <Icon name={kind() === "servers" ? "users-three" : "robot"} size={24} />
      <div>
        <strong>
          <Show
            when={kind() === "servers"}
            fallback={<Trans>Made a bot?</Trans>}
          >
            <Trans>Own a server?</Trans>
          </Show>
        </strong>
        <span>
          <Show
            when={kind() === "servers"}
            fallback={
              <Trans>
                Bot owners can submit theirs from the bot's settings.
              </Trans>
            }
          >
            <Trans>
              Server owners can submit theirs from Server settings → Discover.
            </Trans>
          </Show>
        </span>
      </div>
      <Show
        when={kind() === "servers" && unlisted()}
        fallback={
          <OwnersLink
            data-owners-action
            // the rules open beside the page; the portal is part of the app
            target={kind() === "servers" ? "_blank" : undefined}
            rel={kind() === "servers" ? "noopener" : undefined}
            href={
              kind() === "servers"
                ? `${WEBSITE_URL}/legal/discover-guidelines`
                : developersUrl()
            }
            onClick={(event) => {
              if (site || kind() === "servers") return;
              event.preventDefault();
              navigate("/developers");
            }}
          >
            <Show
              when={kind() === "servers"}
              fallback={<Trans>Developer Portal</Trans>}
            >
              <Trans>Discover rules</Trans>
            </Show>
            <Icon name="arrow-square-out" size={16} />
          </OwnersLink>
        }
      >
        {(server) => (
          <PrimaryButton
            type="button"
            data-owners-action
            data-size="large"
            onClick={() =>
              openModal({
                type: "settings",
                config: "server",
                context: server(),
              })
            }
          >
            {/* one run of text: the button spaces its children */}
            <span>
              <Trans>
                Add <bdi>{server().name}</bdi> to Discover
              </Trans>
            </span>
          </PrimaryButton>
        )}
      </Show>
    </Owners>
  );

  return (
    <Base
      style={{
        ...paletteTokens,
        "--dz-under": site ? SITE_HEADER : "0px",
      }}
    >
      <Scroll
        data-discover-scroll
        ref={(el) => {
          scroller = el;
          // every link in the page, the server page's own included
          el.addEventListener(
            "click",
            (event) => {
              if ((event.target as Element).closest("a")) forgetOrigin();
            },
            true,
          );
        }}
      >
        <Content>
          <TopMark ref={topMark} aria-hidden="true" />
          {/* one bar for every view: the field keeps its focus between them */}
          {discoverBar()}
          <Show
            when={!serverSlug()}
            fallback={
              <ServerPage
                slug={serverSlug()!}
                site={site}
                base={base}
                takeFocus={(returnTo?.nth ?? -1) >= 0}
              />
            }
          >
            {/* with a search or a filter the sky steps aside */}
            <Show when={!showResults()}>
              <Hero lit={listed()}>
                <h1 tabIndex={-1} data-view-heading>
                  <Show
                    when={kind() === "servers"}
                    fallback={
                      <Trans>
                        Find the right <em>bot</em>
                      </Trans>
                    }
                  >
                    <Trans>
                      Find your <em>community</em>
                    </Trans>
                  </Show>
                </h1>
                <p>
                  <Show
                    when={kind() === "servers"}
                    fallback={
                      <Trans>
                        Bots people built for their servers. See what each one
                        does and which permissions it asks for.
                      </Trans>
                    }
                  >
                    <Trans>
                      Communities their owners run and the Zrzur team checks.
                      Look around before you join.
                    </Trans>
                  </Show>
                </p>
              </Hero>
            </Show>

            <MainList>
              {/* the topics as big words: the current one lit */}
              <Words
                data-words
                aria-label={t`Categories`}
                // a word half out of the row comes in with the keyboard
                onFocusIn={(event) =>
                  (event.target as HTMLElement).scrollIntoView({
                    block: "nearest",
                    inline: "nearest",
                  })
                }
              >
                <a
                  href={href(kind())}
                  aria-current={
                    !category() && !tag() && !typing() ? "true" : undefined
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    clearAll();
                  }}
                >
                  <Trans>All</Trans>
                </a>
                <For each={CATEGORIES[kind()]}>
                  {(item) => (
                    <a
                      href={href(kind(), { category: item.id })}
                      aria-current={category() === item.id ? "true" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        pickCategory(item.id);
                      }}
                    >
                      {labels.category(item.id)}
                    </a>
                  )}
                </For>
                <Show when={tag()}>
                  <button
                    type="button"
                    dir="auto"
                    aria-current="true"
                    aria-label={t`Remove filter`}
                    onClick={() => filter({ tag: undefined })}
                  >
                    #{tag()}
                    <Icon name="x" size={16} />
                  </button>
                </Show>
              </Words>

              <Show
                when={!showResults()}
                fallback={
                  <>
                    <ResultsHead>
                      <div>
                        <h2 dir="auto" tabIndex={-1} data-view-heading>
                          {resultsTitle()}
                        </h2>
                        <ResultCount aria-live="polite">
                          <Show when={shown().length}>
                            <Plural
                              value={shown().length}
                              one="# result"
                              other="# results"
                            />
                          </Show>
                        </ResultCount>
                      </div>
                      <SortChoice
                        aria-label={t`Sort`}
                        value={sort()}
                        onChange={(value) => filter({ sort: value }, true)}
                        options={[
                          { value: "popular", label: t`Popular` },
                          { value: "new", label: t`New` },
                        ]}
                      />
                    </ResultsHead>

                    <Rows aria-busy={waiting()}>
                      {cards(shown)}
                      <Show when={waiting() && !shown().length}>
                        <Skeletons count={6} />
                      </Show>
                    </Rows>

                    <Show when={!waiting() && !failed() && !shown().length}>
                      <Empty data-empty>
                        <strong>
                          <Trans>Nothing matches your search.</Trans>
                        </strong>
                        <span>
                          <Trans>Try another word, tag or category.</Trans>
                        </span>
                        <PrimaryButton
                          type="button"
                          data-variant="secondary"
                          onClick={clearAll}
                        >
                          <Trans>Clear filters</Trans>
                        </PrimaryButton>
                      </Empty>
                      <Show when={popular().length}>
                        <Section
                          icon="lightning"
                          title={
                            kind() === "servers" ? (
                              <Trans>Popular communities</Trans>
                            ) : (
                              <Trans>Popular bots</Trans>
                            )
                          }
                        >
                          <Rows>{cards(() => popular().slice(0, 4))}</Rows>
                        </Section>
                      </Show>
                    </Show>

                    <Show when={hasMore()}>
                      <More>
                        <PrimaryButton
                          type="button"
                          data-variant="secondary"
                          data-size="large"
                          disabled={loading()}
                          onClick={(e) => loadMore(e.currentTarget)}
                        >
                          <Show
                            when={loading()}
                            fallback={<Trans>Load more</Trans>}
                          >
                            <Trans>Loading…</Trans>
                          </Show>
                        </PrimaryButton>
                      </More>
                    </Show>
                  </>
                }
              >
                {/* Paid places, and a free one offered to owners; only a
                      row that is on sale has the heading */}
                <Show when={paidPlaces().length || freeSlot()}>
                  <Show when={promotedRow()} fallback={paidRow()}>
                    <Section icon="megaphone" title={<Trans>Top row</Trans>}>
                      {paidRow()}
                    </Section>
                  </Show>
                </Show>

                {/* Featured, then everything */}
                <Show when={page().picked.length}>
                  <Section icon="seal-check" title={<Trans>Hand-picked</Trans>}>
                    <Rows>{cards(() => page().picked)}</Rows>
                  </Section>
                </Show>

                <Show when={page().list.length}>
                  <Section
                    icon="squares-four"
                    title={
                      kind() === "servers" ? (
                        <Trans>All servers</Trans>
                      ) : (
                        <Trans>All bots</Trans>
                      )
                    }
                    more={
                      page().list.length >= 12
                        ? () => navigate(href(kind(), { all: true }))
                        : undefined
                    }
                  >
                    <Rows>{cards(() => page().list)}</Rows>
                  </Section>
                </Show>

                <Show
                  when={
                    loading() && !page().list.length && !page().picked.length
                  }
                >
                  <Rows>
                    <Skeletons count={8} />
                  </Rows>
                </Show>

                <Show
                  when={
                    !loading() &&
                    !failed() &&
                    !popular().length &&
                    !featured().length
                  }
                >
                  <Empty data-empty>
                    <strong>
                      <Show
                        when={kind() === "servers"}
                        fallback={<Trans>No bots are listed yet.</Trans>}
                      >
                        <Trans>No servers are listed yet.</Trans>
                      </Show>
                    </strong>
                    <span>
                      <Show
                        when={kind() === "servers"}
                        fallback={
                          <Trans>
                            Bot owners can submit theirs from the bot's
                            settings.
                          </Trans>
                        }
                      >
                        <Trans>
                          Server owners can submit theirs from Server settings →
                          Discover.
                        </Trans>
                      </Show>
                    </span>
                  </Empty>
                </Show>
                {ownersCard()}
              </Show>
            </MainList>

            <Show when={failed()}>
              <Empty data-empty>
                <strong>
                  <Trans>Discover couldn't be loaded right now.</Trans>
                </strong>
                <PrimaryButton
                  type="button"
                  data-variant="secondary"
                  onClick={() => load(true)}
                >
                  <Trans>Try again</Trans>
                </PrimaryButton>
              </Empty>
            </Show>
          </Show>
        </Content>
      </Scroll>

      <Show when={detail()} keyed>
        {(item) => (
          <ListingDetail
            listing={item}
            onClose={closeDetail}
            onTag={pickTag}
            secondary={
              <>
                <Show when={shareUrl(item)}>
                  {(url) => (
                    <PrimaryButton
                      type="button"
                      data-variant="secondary"
                      onClick={() => copyLink(item, url())}
                    >
                      <Icon
                        name={copied() === item.id ? "check" : "link"}
                        size={16}
                      />
                      <Show
                        when={copied() === item.id}
                        fallback={<Trans>Copy link</Trans>}
                      >
                        <Trans>Copied</Trans>
                      </Show>
                    </PrimaryButton>
                  )}
                </Show>
                <PrimaryButton
                  type="button"
                  data-variant="secondary"
                  onClick={() => report(item)}
                >
                  <Icon name="flag" size={16} />
                  <Trans>Report</Trans>
                </PrimaryButton>
              </>
            }
            primary={
              <Show
                when={item.kind === "servers"}
                fallback={
                  <PrimaryButton
                    type="button"
                    disabled={busy() === item.id}
                    onClick={() => addBot(item.id)}
                  >
                    <Icon name="plus" size={16} />
                    <Trans>Add to server</Trans>
                  </PrimaryButton>
                }
              >
                <PrimaryButton
                  type="button"
                  disabled={busy() === item.id}
                  onClick={() => joinServer(item)}
                >
                  <Show
                    when={isMember(item.id)}
                    fallback={<Trans>Join server</Trans>}
                  >
                    <Trans>Open server</Trans>
                  </Show>
                </PrimaryButton>
              </Show>
            }
          />
        )}
      </Show>
      {inApp.dialog()}
    </Base>
  );
}

function Section(props: {
  icon: IconName;
  title: JSX.Element;
  /** "See all" at the end of the heading */
  more?: () => void;
  children: JSX.Element;
}) {
  return (
    <SectionBase>
      <SectionHead>
        <h2>
          <Icon name={props.icon} size={20} />
          {props.title}
        </h2>
        <Show when={props.more}>
          <SeeAll type="button" onClick={() => props.more!()}>
            <Trans>See all</Trans>
            <Icon name="caret-right" size={16} />
          </SeeAll>
        </Show>
      </SectionHead>
      {props.children}
    </SectionBase>
  );
}

function Skeletons(props: { count: number }) {
  return (
    <For each={Array.from({ length: props.count })}>
      {() => <Skeleton data-skeleton aria-hidden="true" />}
    </For>
  );
}

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
    background: "var(--dz-page)",
    "& ::selection": {
      background: "color-mix(in srgb, var(--z-accent) 35%, transparent)",
    },
  },
});

/**
 * The one bar that stays, as on Designs: flat on the page, on a solid strip
 * edge to edge once the top has scrolled away. Phones: it stays in the page.
 */
const Bar = styled("header", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    minHeight: "64px",
    position: "sticky",
    top: 0,
    zIndex: 5,
    "&[data-stuck='true']::before": {
      content: "''",
      position: "absolute",
      zIndex: -1,
      insetBlock: 0,
      // no wider than the screen: a huge strip costs scroll frames on the site
      insetInline: "calc(50% - 50vw)",
      background: "var(--dz-page)",
      borderBottom: "1px solid var(--z-border-subtle)",
    },
    "@media (max-width: 899px)": {
      flexWrap: "wrap",
      gap: "0 4px",
      minHeight: "44px",
      position: "relative",
    },
  },
});

/** Plain text tabs; the open one is marked by a short underline */
const Tabs = styled("nav", {
  base: {
    display: "flex",
    alignItems: "stretch",
    alignSelf: "stretch",
    gap: "4px",
    minWidth: 0,
    marginInlineEnd: "auto",
    "& a": {
      position: "relative",
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      minHeight: "44px",
      paddingInline: "12px",
      color: "var(--z-fg-muted)",
      fontSize: "15px",
      fontWeight: 600,
      textDecoration: "none",
      whiteSpace: "nowrap",
      "--z-icon-color": "currentColor",
      transition: "color 120ms ease",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-4px",
        borderRadius: "var(--z-shape-button)",
      },
      "&::after": {
        content: "''",
        position: "absolute",
        insetInline: "12px",
        bottom: 0,
        height: "3px",
        borderRadius: "var(--z-radius-xs) var(--z-radius-xs) 0 0",
        background: "transparent",
      },
    },
    "& a[aria-selected='true']": {
      color: "var(--z-fg-primary)",
      "&::after": { background: "var(--z-accent-fill)" },
    },
    "@media (max-width: 899px)": { order: 1 },
  },
});

/** Phones: the search icon in the bar */
const SearchToggle = styled("button", {
  base: {
    display: "none",
    "@media (max-width: 899px)": {
      order: 2,
      display: "grid",
      placeItems: "center",
      width: "44px",
      height: "44px",
      borderRadius: "var(--z-shape-button)",
      border: "none",
      background: "none",
      color: "var(--z-fg-primary)",
      cursor: "pointer",
      "--z-icon-color": "currentColor",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/** The small search at the end of the bar */
const Find = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 1 320px",
    minWidth: "160px",
    height: "40px",
    paddingInline: "12px",
    boxSizing: "border-box",
    borderRadius: "var(--z-shape-field, 10px)",
    // sits on the sky: a veil of the text colour, so the page shows through
    border:
      "1px solid color-mix(in srgb, var(--z-fg-primary) 12%, transparent)",
    background: "color-mix(in srgb, var(--z-fg-primary) 5%, transparent)",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    transition: "border-color 120ms cubic-bezier(0.2, 0, 0, 1)",
    _hover: {
      borderColor: "color-mix(in srgb, var(--z-fg-primary) 20%, transparent)",
      background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
    },
    _focusWithin: {
      borderColor: "var(--z-focus)",
      boxShadow: "0 0 0 2px var(--z-focus)",
    },
    "& input::placeholder": { color: "var(--dz-placeholder)", opacity: 1 },
    "& input::-webkit-search-cancel-button": { display: "none" },
    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
    },
    // the key that jumps here
    "& kbd": {
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      width: "20px",
      height: "20px",
      borderRadius: "var(--z-radius-xs)",
      border: "1px solid var(--dz-edge)",
      fontFamily: "inherit",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
      _phone: { display: "none" },
    },
    "& button": {
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      width: "24px",
      height: "24px",
      padding: 0,
      borderRadius: "var(--z-shape-chip)",
      border: "none",
      background: "none",
      color: "var(--z-fg-secondary)",
      cursor: "pointer",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "1px",
      },
      _phone: { width: "44px", height: "44px", marginInlineEnd: "-12px" },
    },
    "@media (max-width: 899px)": {
      display: "none",
      "[data-open='true'] > &": { display: "flex" },
      order: 4,
      flexBasis: "100%",
      marginBlock: "0 8px",
      minWidth: "120px",
      width: "auto",
      height: "44px",
      "& input": { fontSize: "16px" },
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
    // the sky runs the width of this box, in the app and on the site
    containerType: "inline-size",
  },
});

/** Sizes as on Designs, so the two pages share one grid */
const Content = styled("div", {
  base: {
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

    // keyboard focus stops clear of the sticky rows. On what scrolls under
    // them, not as scroll-padding: the bar's own controls would pull the page.
    "& > :not(header) :is(a, button, input, [tabindex])": {
      scrollMarginBlock: "136px 16px",
    },
  },
});

/** When this leaves the screen, the bar is at the top */
const TopMark = styled("div", {
  base: {
    position: "absolute",
    top: "24px",
    width: "1px",
    height: "1px",
    pointerEvents: "none",
  },
});

const MainList = styled("div", {
  base: {
    minWidth: 0,
    // a young list still has a page to scroll, so the bar can stick
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& > section:last-child": { marginTop: "auto" },
  },
});

/** The topics as big words, the kinds of Designs: the current one lit */
const Words = styled("nav", {
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
    scrollPaddingInline: "16px",
    scrollbarWidth: "none",
    background: "var(--dz-page)",
    "&::-webkit-scrollbar": { display: "none" },
    "& > a, & > button": {
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
      textDecoration: "none",
      whiteSpace: "nowrap",
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      transition: "color 120ms cubic-bezier(0.2, 0, 0, 1)",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-2px",
        borderRadius: "var(--z-shape-chip)",
      },
      // a short word ("All") still gets a 44 px target
      _phone: {
        fontSize: "18px",
        lineHeight: "26px",
        minWidth: "44px",
        justifyContent: "center",
      },
    },
    "& > [aria-current]": { color: "var(--z-fg-primary)" },
    // a mouse has no sideways scroll: every word on the page, in as many rows
    // as it takes, which scroll away with it
    "@media (min-width: 601px)": {
      position: "static",
      flexWrap: "wrap",
      overflowX: "visible",
    },
    _phone: {
      top: 0,
      marginInline: "-16px",
      paddingInline: "16px",
      gap: "16px",
    },
  },
});

const SectionBase = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBlockStart: "16px",
  },
});

const SectionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",

    "& h2": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      margin: 0,
      minWidth: 0,
      fontSize: "18px",
      fontWeight: 700,
      lineHeight: "26px",
      "--z-icon-color": "var(--dz-mark)",
    },
  },
});

const SeeAll = styled("button", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "var(--z-control-sm)",
    paddingInline: "8px",
    borderRadius: "var(--z-shape-button)",
    border: "none",
    background: "transparent",
    color: "var(--dz-mark)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { textDecoration: "underline" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { height: "44px" },
  },
});

/** Free top-row place: an invitation with a dashed edge */
const PromoteSlot = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    minWidth: 0,
    minHeight: "var(--card-h)",
    padding: "24px",
    boxSizing: "border-box",
    borderRadius: "var(--z-shape-card)",
    border: "1px dashed color-mix(in srgb, var(--z-accent) 55%, transparent)",
    background: "var(--dz-glass-fill)",
    "--z-icon-color": "var(--dz-mark)",
    "& > svg": { marginBottom: "8px" },
    "& strong": { fontSize: "16px", color: "var(--z-fg-primary)" },
    "& > span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const PromoteSlotButton = styled("button", {
  base: {
    marginTop: "auto",
    height: "var(--z-control-lg)",
    paddingInline: "16px",
    border: "none",
    borderRadius: "var(--z-shape-button)",
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--z-on-premium)",
    background: "var(--z-premium)",
    boxShadow: "var(--z-btn-lift)",
    cursor: "pointer",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transition: "filter 120ms ease, transform 80ms ease",
    _hover: { filter: "brightness(1.06)" },
    "&:active": { transform: "translateY(0.5px) scale(0.985)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { height: "44px" },
  },
});

/**
 * The wall: one size of card. Columns go by the window, not the frame, so the
 * app and the site match at any width. The last row of a short list keeps its
 * gap rather than stretch a card.
 */
const Rows = styled(CardRoom, {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    "@media (min-width: 900px) and (max-width: 1099px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
    "@media (min-width: 601px) and (max-width: 899px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    gridAutoRows: "1fr",
    gap: "8px",
    _phone: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const ResultsHead = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBlock: "8px",
    // phones: a 44 px tap target on the shared control
    _phone: { "& [role='radio']": { height: "44px" } },

    "& > div:first-child": { minWidth: 0 },
    "& h2": {
      margin: 0,
      minWidth: 0,
      fontSize: "22px",
      fontWeight: 700,
      lineHeight: "30px",
      overflowWrap: "anywhere",
    },
  },
});

/** The count, read out as it changes */
const ResultCount = styled("div", {
  base: {
    minHeight: "20px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const Skeleton = styled("div", {
  base: {
    height: "var(--card-h)",
    borderRadius: "var(--z-shape-card)",
    border: "1px solid var(--dz-edge)",
    // the shape of a card: its banner, then a quiet body
    background:
      "linear-gradient(var(--dz-glass-hover) 100px, var(--z-card-bg) 100px)",
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "48px 16px",
    textAlign: "center",
    borderRadius: "var(--z-shape-card)",
    border: "1px dashed var(--z-border-strong, var(--dz-edge))",
    background: "transparent",

    "& strong": {
      fontSize: "16px",
      color: "var(--z-fg-primary)",
    },
    "& span": {
      fontSize: "14px",
      lineHeight: "20px",
      maxWidth: "420px",
      color: "var(--z-fg-secondary)",
    },
    "& button": { marginTop: "8px" },
  },
});

const More = styled("div", {
  base: { display: "flex", justifyContent: "center" },
});

/** How owners get listed: a quiet invitation at the foot of every page */
const Owners = styled("section", {
  base: {
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "20px 24px",
    "@media (max-width: 699px)": {
      flexDirection: "column",
      alignItems: "stretch",
      padding: "16px",
    },
    borderRadius: "var(--z-shape-card)",
    border: "1px solid color-mix(in srgb, var(--z-accent) 40%, transparent)",
    background: "color-mix(in srgb, var(--z-accent) 12%, var(--dz-page))",
    "--z-icon-color": "var(--dz-on-art)",

    // the flock in the brand colour: dots that thin out towards the words
    _before: {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      backgroundImage:
        "radial-gradient(circle, var(--z-accent) 1.25px, transparent 1.75px)",
      backgroundSize: "12px 12px",
      maskImage: "linear-gradient(to left, black, transparent 72%)",
      opacity: 0.75,
      _rtl: {
        maskImage: "linear-gradient(to right, black, transparent 72%)",
      },
    },
    "& > *": { position: "relative" },

    "& > svg": { flexShrink: 0 },
    "& > div": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
    "& > button, & > a": { flexShrink: 0 },
    "& strong": {
      alignSelf: "flex-start",
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
      color: "var(--dz-on-art)",
    },
    "& span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--dz-on-art)",
    },
  },
});

const OwnersLink = styled("a", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    height: "var(--z-control-lg)",
    paddingInline: "16px",
    borderRadius: "var(--z-shape-button)",
    border: "1px solid transparent",
    background: "var(--z-btn-primary-bg)",
    color: "var(--z-btn-primary-fg, var(--z-on-accent))",
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-btn-primary-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { height: "44px" },
  },
});
