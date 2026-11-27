import {
  For,
  JSX,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useLocation, useNavigate } from "@revolt/routing";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { loadExamplesFor } from "./examples";
import { hrefHere, leavesHere } from "./here";
import {
  type SearchEntry,
  endpointSlug,
  inventory,
  loadParts,
  pageOfSection,
  partsForMarkdown,
} from "./inventory";
import { Markdown, NEXT } from "./Markdown";
import { headingsOf } from "./markdownTree";
import {
  type PageGroup,
  DEFAULT_PAGE,
  PAGES,
  loadSource,
  pageById,
} from "./pages";
import { loadReference } from "./reference";

/**
 * The Bot API documentation: /developers/docs/<page>#<anchor> inside the
 * app, /<page>#<anchor> on the standalone site (`site`), where it also
 * shows the sections of the open page beside the text.
 */
export function DocsPortal(props: {
  page?: string;
  site?: boolean;
  /** shown under the text: the site's legal links */
  footer?: JSX.Element;
}) {
  const { t, i18n } = useLingui();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = createSignal("");
  const [menuOpen, setMenuOpen] = createSignal(false);
  let main: HTMLDivElement | undefined;

  const page = () => pageById(props.page ?? DEFAULT_PAGE);

  // The open page and only what it shows: its Markdown in this language,
  // the inventory parts of its generated blocks, its examples. Plain
  // signals, not a resource: a resource would suspend the whole docs page
  // into the app's loading screen on every page change.
  const [content, setContent] = createSignal<{
    id: string;
    locale: string;
    source?: string;
  }>();
  // a failed load says so; Try again counts up and loads once more
  const [failed, setFailed] = createSignal<string>();
  const [attempt, setAttempt] = createSignal(0);
  createEffect(
    on([() => page()?.id, () => i18n().locale, attempt], ([id, locale]) => {
      const current = pageById(id);
      if (!current) return;
      let alive = true;
      onCleanup(() => (alive = false));
      setFailed(undefined);
      const ready = loadSource(current.id, locale).then(async (source) => {
        if (source === undefined) throw new Error(`no page ${current.id}`);
        await Promise.all([
          loadParts(partsForMarkdown(source)),
          loadExamplesFor(source),
          loadReference(locale),
        ]);
        return source;
      });
      ready.then(
        (source) => {
          if (alive) setContent({ id: current.id, locale, source });
        },
        () => {
          if (alive) setFailed(`${current.id}:${locale}`);
        },
      );
    }),
  );
  const shown = () => {
    const value = content();
    return value?.id === page()?.id ? value : undefined;
  };

  // Search needs every page of this language: fetched on first use only
  const [searchSources, setSearchSources] =
    createSignal<Record<string, string>>();
  let searchLocale: string | undefined;
  function prepareSearch() {
    const locale = i18n().locale;
    if (searchLocale === locale) return;
    searchLocale = locale;
    void Promise.all([
      loadParts(["index", "gateway"]),
      ...PAGES.filter((p) => p.hasSource).map(
        async (p) => [p.id, (await loadSource(p.id, locale)) ?? ""] as const,
      ),
    ]).then(
      ([, ...entries]) => {
        if (searchLocale === locale)
          setSearchSources(
            Object.fromEntries(entries as (readonly [string, string])[]),
          );
      },
      // offline: the next focus tries again
      () => (searchLocale = undefined),
    );
  }

  const titles = (): Record<string, string> => ({
    overview: t`Overview`,
    "getting-started": t`Start your bot`,
    applications: t`Applications and tokens`,
    authentication: t`Authentication`,
    gateway: t`Gateway`,
    events: t`Event reference`,
    commands: t`Slash commands`,
    interactions: t`Answering interactions`,
    components: t`Buttons, menus and forms`,
    "bots-in-dms": t`Bots in direct messages`,
    "http-interactions": t`Interactions over HTTP`,
    messages: t`Messages`,
    channels: t`Channels`,
    webhooks: t`Webhooks`,
    servers: t`Servers`,
    users: t`Users and members`,
    roles: t`Roles and permissions`,
    moderation: t`Moderation`,
    files: t`Files`,
    voice: t`Voice`,
    oauth2: t`OAuth2`,
    errors: t`Errors`,
    "rate-limits": t`Rate limits`,
    security: t`Keeping tokens safe`,
    production: t`Running in production`,
    "tutorial-full-bot": t`Build a complete bot`,
    "tutorial-hello": t`Hello World`,
    "tutorial-commands": t`Commands with options`,
    "tutorial-events": t`Events`,
    "tutorial-moderation": t`Moderation bot`,
    "tutorial-welcome": t`Welcome messages`,
    "tutorial-games": t`Games with buttons`,
    "rich-presence": t`Rich presence for games and apps`,
    "tutorial-multi-server": t`One bot, many servers`,
    "tutorial-upload": t`File upload`,
    "tutorial-voice": t`Voice bot`,
    "tutorial-deploy": t`Deployment`,
    "raw-http": t`Without a library`,
    sdk: t`SDKs`,
    coverage: t`Status and coverage`,
    changelog: t`API changelog`,
  });

  const groups = (): { id: PageGroup; label: string; icon: IconName }[] => [
    { id: "start", label: t`Start here`, icon: "rocket-launch" },
    { id: "concepts", label: t`Core concepts`, icon: "books" },
    {
      id: "interactions",
      label: t`Commands and interactions`,
      icon: "terminal",
    },
    { id: "resources", label: t`Working with the API`, icon: "code" },
    { id: "going-live", label: t`Going live`, icon: "shield-check" },
    { id: "tutorials", label: t`Tutorials`, icon: "graduation-cap" },
    { id: "reference", label: t`Reference`, icon: "notebook" },
  ];

  const groupOf = (id: PageGroup) => groups().find((g) => g.id === id);

  // Sections folded away by the reader, remembered on this device; the
  // section of the open page always shows its pages
  const FOLDED_KEY = "zrzur:docs-folded";
  const [folded, setFolded] = createSignal<string[]>(
    (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? "[]");
        return Array.isArray(saved) ? saved : [];
      } catch {
        return [];
      }
    })(),
  );
  const isOpen = (id: PageGroup) =>
    page()?.group === id || !folded().includes(id);
  const toggleGroup = (id: PageGroup) => {
    const next = isOpen(id)
      ? [...folded().filter((g) => g !== id), id]
      : folded().filter((g) => g !== id);
    setFolded(next);
    try {
      localStorage.setItem(FOLDED_KEY, JSON.stringify(next));
    } catch {
      // stays as it is for this visit
    }
  };

  // "/" jumps to the search, as on other documentation sites
  const onSlash = (event: KeyboardEvent) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey)
      return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest("input, textarea, [contenteditable='true']") ||
      document.querySelector("[role=dialog][aria-modal=true]")
    )
      return;
    event.preventDefault();
    document.getElementById("docs-search")?.focus();
  };
  document.addEventListener("keydown", onSlash);
  onCleanup(() => document.removeEventListener("keydown", onSlash));

  /** Pages, page sections, endpoints and events */
  const index = createMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = [];
    const sources = searchSources() ?? {};
    for (const p of PAGES) {
      const title = titles()[p.id] ?? p.id;
      entries.push({
        kind: "page",
        label: title,
        detail: p.id,
        href: `/developers/docs/${p.id}`,
      });
      for (const heading of sources[p.id] ? headingsOf(sources[p.id]) : [])
        entries.push({
          kind: "heading",
          label: heading.text,
          detail: title,
          href: `/developers/docs/${p.id}#${heading.id}`,
        });
    }
    for (const endpoint of inventory.index)
      entries.push({
        kind: "endpoint",
        label: endpoint.id,
        detail: endpoint.title,
        href: `/developers/docs/${pageOfSection(endpoint.section)}#${endpointSlug(endpoint)}`,
      });
    for (const event of inventory.gateway.events.filter(
      (item) => item.audience !== "users",
    ))
      entries.push({
        kind: "event",
        label: event.name,
        detail: event.docs,
        href: `/developers/docs/events#${event.name.toLowerCase()}`,
      });
    return entries;
  });

  const results = createMemo(() => {
    const words = query().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const asked = words.join(" ");
    // what was typed in full comes first, then what starts with it
    const rank = (entry: SearchEntry) => {
      const label = entry.label.toLowerCase();
      return label === asked ? 0 : label.startsWith(asked) ? 1 : 2;
    };
    return index()
      .filter((entry) => {
        const text = `${entry.label} ${entry.detail}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .map((entry, at) => ({ entry, at, rank: rank(entry) }))
      .sort((a, b) => a.rank - b.rank || a.at - b.at)
      .slice(0, 20)
      .map(({ entry }) => entry);
  });

  /** Open a documentation address (always written as in the app) */
  function go(href: string) {
    setMenuOpen(false);
    setQuery("");
    const address = hrefHere(href);
    // "My applications" lives in the app: from the site, a full page load
    if (leavesHere(address)) window.location.assign(address);
    else navigate(address);
  }

  /** A link to a documentation address: its real href, opened in place */
  const link = (href: string) => ({
    href: hrefHere(href),
    onClick: (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      go(href);
    },
  });

  /** Sections of the open page, and the pages before and after it */
  const sections = createMemo(() => {
    const source = shown()?.source;
    return source ? headingsOf(source) : [];
  });
  // the section being read, marked in "On this page" as the page scrolls
  const [reading, setReading] = createSignal<string>();
  createEffect(
    on(
      () => shown()?.id,
      (id) => {
        setReading(undefined);
        const scroller = main;
        if (!id || !scroller) return;
        // the section being read is the last one whose title has passed
        // the top quarter of the text, also after a long jump
        let frame = 0;
        const measure = () => {
          frame = 0;
          const top = scroller.getBoundingClientRect().top;
          const line = top + scroller.clientHeight / 4;
          let current: string | undefined;
          for (const heading of scroller.querySelectorAll<HTMLElement>(
            "article h2[id]",
          )) {
            if (heading.getBoundingClientRect().top > line) break;
            current = heading.id;
          }
          // at the very end, the last section, however short
          if (
            scroller.scrollTop + scroller.clientHeight >=
            scroller.scrollHeight - 2
          )
            current =
              [...scroller.querySelectorAll<HTMLElement>("article h2[id]")].at(
                -1,
              )?.id ?? current;
          setReading(current);
        };
        const onScroll = () => {
          if (!frame) frame = requestAnimationFrame(measure);
        };
        scroller.addEventListener("scroll", onScroll, { passive: true });
        frame = requestAnimationFrame(measure);
        onCleanup(() => {
          cancelAnimationFrame(frame);
          scroller.removeEventListener("scroll", onScroll);
        });
      },
    ),
  );

  const neighbours = createMemo(() => {
    const at = PAGES.findIndex((p) => p.id === page()?.id);
    return {
      previous: PAGES[at - 1],
      next: at < 0 ? undefined : PAGES[at + 1],
    };
  });

  // The site's server sent the page as plain HTML, lying over the app
  // while it loads: gone once the page (or its failure) is on screen
  createEffect(() => {
    if (shown() || failed() || !page())
      document.getElementById("docs-static")?.remove();
  });

  // the browser tab names the page on the standalone site
  createEffect(() => {
    if (!props.site) return;
    const title = titles()[page()?.id ?? ""];
    document.title = title
      ? `${title} · ${t`Zrzur Developers`}`
      : t`Zrzur Developers`;
  });

  // jump to the anchor, or to the top of a new page, once its content is
  // on screen: before that the anchor does not exist yet
  createEffect(
    on(
      [
        () => props.page,
        () => location.hash,
        () => shown()?.id,
        () => shown()?.locale,
      ],
      ([, hash, shownId]) => {
        if (!shownId) return;
        requestAnimationFrame(() => {
          const target = hash
            ? document.getElementById(decodeURIComponent(hash.slice(1)))
            : null;
          if (target) target.scrollIntoView({ block: "start" });
          else main?.scrollTo({ top: 0 });
        });
      },
    ),
  );

  const kindLabel = (kind: SearchEntry["kind"]) =>
    ({
      page: t`Page`,
      heading: t`Section`,
      endpoint: t`Endpoint`,
      event: t`Event`,
    })[kind];

  return (
    <Portal>
      <Sidebar
        data-open={menuOpen() ? "" : undefined}
        aria-label={t`Documentation`}
      >
        {/* back to the portal, apart from the pages */}
        <PortalLink {...link("/developers")}>
          <Icon name="squares-four" size={16} />
          <span class="label">
            <Trans>My applications</Trans>
          </span>
          <Icon name="arrow-right" size={14} class="go" />
        </PortalLink>
        <Search role="search">
          <Icon name="magnifying-glass" size={16} aria-hidden="true" />
          <input
            id="docs-search"
            aria-label={t`Search the documentation`}
            type="search"
            placeholder={t`Search the docs`}
            value={query()}
            autocomplete="off"
            aria-controls="docs-search-results"
            onFocus={prepareSearch}
            onInput={(event) => {
              prepareSearch();
              setQuery(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results()[0]) go(results()[0].href);
              if (event.key === "Escape") setQuery("");
            }}
          />
          <Show when={!query()}>
            <Kbd aria-hidden="true">/</Kbd>
          </Show>
        </Search>
        <Show
          when={query().trim()}
          fallback={
            <For each={groups()}>
              {(group) => (
                <NavGroup>
                  <h2>
                    <button
                      type="button"
                      aria-expanded={isOpen(group.id)}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <Icon name={group.icon} size={16} />
                      <span class="label">{group.label}</span>
                      <Icon name="caret-down" size={12} class="fold" />
                    </button>
                  </h2>
                  <ul hidden={!isOpen(group.id)}>
                    <For each={PAGES.filter((p) => p.group === group.id)}>
                      {(p) => (
                        <li>
                          <a
                            {...link(`/developers/docs/${p.id}`)}
                            aria-current={
                              page()?.id === p.id ? "page" : undefined
                            }
                          >
                            {titles()[p.id]}
                          </a>
                        </li>
                      )}
                    </For>
                  </ul>
                </NavGroup>
              )}
            </For>
          }
        >
          <Results id="docs-search-results" aria-live="polite">
            <Show when={results().length} fallback={<p>{t`Nothing found.`}</p>}>
              <For each={results()}>
                {(entry) => (
                  <li>
                    <a {...link(entry.href)}>
                      <span dir="auto">{entry.label}</span>
                      <small>
                        {kindLabel(entry.kind)} · {entry.detail}
                      </small>
                    </a>
                  </li>
                )}
              </For>
            </Show>
          </Results>
        </Show>
      </Sidebar>

      <Content ref={main}>
        <MenuButton
          type="button"
          aria-expanded={menuOpen()}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen() ? "x" : "list"} size={20} />
          <span>
            {menuOpen()
              ? t`Close contents`
              : (titles()[page()?.id ?? ""] ?? t`Contents`)}
          </span>
        </MenuButton>
        <Show
          when={page()}
          fallback={
            <Article>
              <h1>
                <Trans>Page not found</Trans>
              </h1>
              <p>
                <a {...link("/developers/docs/overview")}>
                  <Trans>Go to the overview</Trans>
                </a>
              </p>
            </Article>
          }
        >
          {(current) => (
            <Show
              when={shown()}
              fallback={
                <Show
                  when={failed() === `${current().id}:${i18n().locale}`}
                  fallback={
                    <Article aria-busy="true">
                      <Loading>{t`Loading…`}</Loading>
                    </Article>
                  }
                >
                  <Article role="alert">
                    <Loading>
                      {t`This page couldn't load. Check your connection.`}
                    </Loading>
                    <RetryButton
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
                    >
                      {t`Try again`}
                    </RetryButton>
                  </Article>
                </Show>
              }
            >
              <Show when={shown()?.source}>
                {(source) => (
                  <>
                    <Article>
                      {/* which section of the docs this page belongs to */}
                      <Show when={groupOf(current().group)}>
                        {(group) => (
                          <Eyebrow>
                            <Icon name={group().icon} size={14} />
                            {group().label}
                          </Eyebrow>
                        )}
                      </Show>
                      <Markdown source={source()} onNavigate={go} />
                      {/* only where the page shows generated reference */}
                      <Show when={partsForMarkdown(source()).length}>
                        <Footer>
                          <Trans>
                            Reference generated from backend{" "}
                            {inventory.generated.backend} and OpenAPI{" "}
                            {inventory.generated.openapi}. Descriptions that
                            come from the API stay in English.
                          </Trans>
                        </Footer>
                      </Show>
                    </Article>
                    {/* a page that names what to read next needs no pager */}
                    <Show when={!sections().some((h) => h.id === NEXT)}>
                      <Pager aria-label={t`More pages`}>
                        <Show when={neighbours().previous} fallback={<span />}>
                          {(p) => (
                            <a {...link(`/developers/docs/${p().id}`)}>
                              <Icon name="arrow-left" size={16} class="arrow" />
                              <span class="words">
                                <small>{t`Previous`}</small>
                                <span>{titles()[p().id]}</span>
                              </span>
                            </a>
                          )}
                        </Show>
                        <Show when={neighbours().next}>
                          {(p) => (
                            <a
                              {...link(`/developers/docs/${p().id}`)}
                              data-next=""
                            >
                              <span class="words">
                                <small>{t`Next`}</small>
                                <span>{titles()[p().id]}</span>
                              </span>
                              <Icon
                                name="arrow-right"
                                size={16}
                                class="arrow"
                              />
                            </a>
                          )}
                        </Show>
                      </Pager>
                    </Show>
                  </>
                )}
              </Show>
            </Show>
          )}
        </Show>
        {props.footer}
      </Content>
      {/* in the app too, as on the site: a long page is read by its
          sections (owner, 2026-11-27) */}
      <Show when={sections().length > 1}>
        <OnThisPage aria-label={t`On this page`}>
          <h2>{t`On this page`}</h2>
          <ul>
            <For each={sections()}>
              {(section) => (
                <li>
                  <a
                    {...link(`/developers/docs/${page()?.id}#${section.id}`)}
                    aria-current={
                      reading() === section.id ? "location" : undefined
                    }
                    dir="auto"
                  >
                    {section.text}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </OnThisPage>
      </Show>
    </Portal>
  );
}

const Portal = styled("div", {
  base: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    minWidth: 0,
    position: "relative",
  },
});

const Sidebar = styled("nav", {
  base: {
    width: "256px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px 8px",
    // the last links scroll clear of the floating account card
    paddingBlockEnd: "calc(var(--z-account-bar-height, 60px) + 32px)",
    borderInlineEnd: "1px solid var(--z-border-subtle)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    mdDown: {
      display: "none",
      "&[data-open]": {
        display: "flex",
        position: "absolute",
        insetInline: 0,
        // below the Contents button, which closes it again
        insetBlock: "68px 0",
        width: "auto",
        zIndex: 2,
        background: "var(--z-bg-chat)",
      },
    },
  },
});

const Search = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginInline: "8px",
    paddingInline: "12px",
    minHeight: "36px",
    borderRadius: "var(--z-radius-md, 8px)",
    background: "var(--z-field-bg)",
    border: "1px solid var(--z-field-border)",
    color: "var(--z-fg-muted)",
    "&:focus-within": { outline: "2px solid var(--z-focus)" },
    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      fontSize: "14px",
      minHeight: "32px",
      _phone: { fontSize: "16px", minHeight: "44px" },
    },
    "& input::placeholder": { color: "var(--z-fg-muted)" },
  },
});

/** The way back to My applications, above the pages */
const PortalLink = styled("a", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginInline: "8px",
    minHeight: "38px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius-md, 8px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-box-bg)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    "--z-icon-color": "var(--z-fg-secondary)",
    "& .label": { flex: 1, minWidth: 0 },
    "& .go": { opacity: 0.6 },
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { minHeight: "44px" },
  },
});

/** The key that opens the search */
const Kbd = styled("kbd", {
  base: {
    display: "grid",
    placeItems: "center",
    minWidth: "20px",
    height: "20px",
    paddingInline: "5px",
    borderRadius: "5px",
    border: "1px solid var(--z-border-subtle)",
    color: "var(--z-fg-muted)",
    fontFamily: "inherit",
    fontSize: "12px",
    lineHeight: 1,
    _phone: { display: "none" },
  },
});

/** One section: its name folds it; its pages hang from a guide line */
const NavGroup = styled("div", {
  base: {
    "& h2": { margin: 0 },
    "& h2 button": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      minHeight: "32px",
      padding: "0 12px",
      border: "none",
      borderRadius: "var(--z-radius-sm, 6px)",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
      fontWeight: 700,
      textAlign: "start",
      cursor: "pointer",
      "--z-icon-color": "var(--z-accent)",
      "& .label": { flex: 1, minWidth: 0 },
      "& .fold": {
        "--z-icon-color": "var(--z-fg-muted)",
        transition: "transform var(--z-motion-fast, 120ms) ease",
      },
      "&[aria-expanded='false'] .fold": { transform: "rotate(-90deg)" },
      _rtl: {
        "&[aria-expanded='false'] .fold": { transform: "rotate(90deg)" },
      },
      _hover: { background: "var(--z-nav-hover)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-2px",
      },
      _phone: { minHeight: "44px" },
    },
    "& ul": {
      listStyle: "none",
      margin: "2px 0 0",
      // under the section's icon: one guide line for its pages
      marginInlineStart: "19px",
      padding: 0,
      paddingInlineStart: "8px",
      borderInlineStart: "1px solid var(--z-border-subtle)",
      display: "flex",
      flexDirection: "column",
      gap: "1px",
    },
    "& ul[hidden]": { display: "none" },
    "& a": {
      position: "relative",
      display: "flex",
      alignItems: "center",
      minHeight: "30px",
      padding: "0 10px",
      borderRadius: "var(--z-radius-sm, 6px)",
      color: "var(--z-fg-secondary)",
      textDecoration: "none",
      fontSize: "14px",
      _hover: {
        background: "var(--z-nav-hover)",
        color: "var(--z-fg-primary)",
      },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-2px",
      },
      // the open page: filled, with the accent on the guide line
      "&[aria-current=page]": {
        background: "var(--z-nav-selected)",
        color: "var(--z-fg-primary)",
        fontWeight: 600,
      },
      "&[aria-current=page]::before": {
        content: '""',
        position: "absolute",
        insetInlineStart: "-9px",
        insetBlock: "6px",
        width: "2px",
        borderRadius: "2px",
        background: "var(--z-accent)",
      },
      _phone: { minHeight: "44px" },
    },
  },
});

const Results = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& p": { padding: "0 12px", color: "var(--z-fg-muted)" },
    "& a": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      padding: "8px 12px",
      borderRadius: "var(--z-radius-sm, 6px)",
      color: "var(--z-fg-primary)",
      textDecoration: "none",
      fontSize: "14px",
      overflowWrap: "anywhere",
      _hover: { background: "var(--z-nav-hover)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-2px",
      },
    },
    "& small": { color: "var(--z-fg-muted)", fontSize: "12px" },
  },
});

const Content = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: "24px 32px 48px",
    mdDown: { padding: "16px 16px 48px" },
  },
});

const MenuButton = styled("button", {
  base: {
    display: "none",
    mdDown: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      minHeight: "44px",
      width: "100%",
      padding: "0 12px",
      marginBlockEnd: "16px",
      borderRadius: "var(--z-radius-md, 8px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-card-bg)",
      color: "var(--z-fg-primary)",
      fontSize: "15px",
      cursor: "pointer",
    },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Article = styled("article", {
  base: {
    maxWidth: "800px",
    marginInline: "auto",
    paddingBlockStart: "8px",
    color: "var(--z-fg-primary)",
    lineHeight: 1.7,
    fontSize: "16px",
    _phone: { fontSize: "15px", paddingBlockStart: 0 },
    "& h1": {
      fontSize: "28px",
      fontWeight: 700,
      margin: "0 0 12px",
      lineHeight: 1.25,
      letterSpacing: "-0.01em",
    },
    // the first lines under the title say what the page is for
    "& h1 + p": {
      fontSize: "18px",
      lineHeight: 1.6,
      marginBlockEnd: "20px",
      _phone: { fontSize: "16px" },
    },
    "& h2": {
      fontSize: "22px",
      fontWeight: 650,
      lineHeight: 1.3,
      margin: "48px 0 12px",
      scrollMarginTop: "16px",
      _phone: { fontSize: "20px", marginBlockStart: "40px" },
    },
    "& h3": {
      fontSize: "18px",
      fontWeight: 650,
      lineHeight: 1.35,
      margin: "32px 0 8px",
      scrollMarginTop: "16px",
    },
    // the "#" of a section shows where the pointer or the keys are
    "& .anchor": {
      marginInlineStart: "8px",
      paddingInline: "4px",
      color: "var(--z-fg-muted) !important",
      textDecoration: "none !important",
      fontWeight: 400,
      opacity: 0,
      transition: "opacity var(--z-motion-fast, 120ms) ease",
      _focusVisible: { opacity: 1 },
      _hover: { color: "var(--z-accent) !important" },
    },
    "& h2:hover .anchor": { opacity: 1 },
    "& h3:hover .anchor": { opacity: 1 },
    "& p": { margin: "0 0 16px", color: "var(--z-fg-secondary)" },
    "& strong": { color: "var(--z-fg-primary)", fontWeight: 600 },
    // the app's reset takes list markers away; lists need them
    "& ul": {
      margin: "0 0 16px",
      paddingInlineStart: "24px",
      color: "var(--z-fg-secondary)",
      listStyle: "disc",
    },
    "& li::marker": { color: "var(--z-fg-muted)" },
    "& li": { marginBlockEnd: "6px" },
    // numbered lists are steps: a numbered dot each, joined by a line
    "& ol": {
      margin: "0 0 16px",
      padding: 0,
      listStyle: "none",
      counterReset: "step",
      color: "var(--z-fg-secondary)",
    },
    "& ol > li": {
      position: "relative",
      counterIncrement: "step",
      paddingInlineStart: "40px",
      paddingBlockEnd: "10px",
      marginBlockEnd: 0,
      minHeight: "28px",
    },
    "& ol > li::before": {
      content: "counter(step)",
      position: "absolute",
      insetInlineStart: 0,
      top: "1px",
      width: "26px",
      height: "26px",
      display: "grid",
      placeItems: "center",
      borderRadius: "50%",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-box-bg)",
      color: "var(--z-fg-primary)",
      fontSize: "13px",
      fontWeight: 600,
      lineHeight: 1,
      fontVariantNumeric: "tabular-nums",
    },
    "& ol > li:not(:last-child)::after": {
      content: '""',
      position: "absolute",
      insetInlineStart: "12.5px",
      top: "31px",
      bottom: "1px",
      width: "1px",
      background: "var(--z-border-subtle)",
    },
    "& a": {
      color: "var(--z-link)",
      textDecoration: "underline",
      textUnderlineOffset: "2px",
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        borderRadius: "2px",
      },
    },
    // code is always written left to right, in an Arabic page too: the
    // generated reference has it in many places, so it is said once here
    "& code, & pre, & kbd, & samp": {
      direction: "ltr",
      unicodeBidi: "isolate",
    },
    "& :not(pre) > code": {
      fontFamily: "var(--fonts-monospace, monospace)",
      fontSize: "0.9em",
      padding: "1px 6px",
      borderRadius: "var(--z-radius-sm, 4px)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      overflowWrap: "anywhere",
    },
    "& figure": { marginBlockEnd: "20px" },
    "& aside": { marginBlockEnd: "20px" },
    "& > div": { marginBlockEnd: "20px" },
    "& hr": {
      border: "none",
      borderBlockStart: "1px solid var(--z-border-subtle)",
      margin: "24px 0",
    },
  },
});

/** The section of the docs a page is in, above its title */
const Eyebrow = styled("p", {
  base: {
    display: "flex !important",
    alignItems: "center",
    gap: "6px",
    margin: "0 0 8px !important",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-accent-text, var(--z-accent)) !important",
    "--z-icon-color": "currentColor",
  },
});

/** The pages before and after this one */
const Pager = styled("nav", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    maxWidth: "800px",
    marginInline: "auto",
    marginBlockStart: "48px",
    paddingBlockStart: "24px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    _phone: { gridTemplateColumns: "1fr" },
    "& .words": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
    "& .arrow": {
      flexShrink: 0,
      "--z-icon-color": "var(--z-fg-muted)",
    },
    "& a:hover .arrow": { "--z-icon-color": "var(--z-accent)" },
    "& a": {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      minHeight: "64px",
      padding: "12px 16px",
      borderRadius: "var(--z-radius-md, 10px)",
      border: "1px solid var(--z-border-subtle)",
      textDecoration: "none",
      color: "var(--z-fg-primary)",
      fontWeight: 600,
      minWidth: 0,
      overflowWrap: "anywhere",
      _hover: {
        borderColor: "var(--z-border-strong)",
        background: "var(--z-nav-hover)",
      },
    },
    "& a[data-next]": {
      textAlign: "end",
      gridColumn: 2,
      _phone: { gridColumn: 1 },
    },
    "& small": {
      fontSize: "12px",
      fontWeight: 400,
      color: "var(--z-fg-muted)",
    },
  },
});

/** Sections of the open page, on wide screens of the standalone site */
const OnThisPage = styled("nav", {
  base: {
    display: "none",
    "@media (min-width: 1280px)": {
      display: "block",
      width: "224px",
      flexShrink: 0,
      paddingBlock: "32px",
      paddingInlineEnd: "16px",
      overflowY: "auto",
    },
    "& h2": {
      margin: "0 0 8px",
      paddingInlineStart: "12px",
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-muted)",
    },
    "& ul": {
      listStyle: "none",
      margin: 0,
      padding: 0,
      borderInlineStart: "1px solid var(--z-border-subtle)",
    },
    "& a": {
      display: "block",
      padding: "4px 12px",
      fontSize: "13px",
      lineHeight: 1.45,
      color: "var(--z-fg-secondary)",
      textDecoration: "none",
      overflowWrap: "anywhere",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-2px",
      },
      // the section being read: the accent line beside it
      "&[aria-current]": {
        color: "var(--z-fg-primary)",
        fontWeight: 600,
        boxShadow: "inset 2px 0 0 var(--z-accent)",
        _rtl: { boxShadow: "inset -2px 0 0 var(--z-accent)" },
      },
    },
  },
});

const Loading = styled("p", {
  base: { color: "var(--z-fg-muted)" },
});

const RetryButton = styled("button", {
  base: {
    minHeight: "36px",
    paddingInline: "16px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-strong)",
    background: "var(--z-card-bg)",
    color: "var(--z-fg-primary)",
    fontWeight: 600,
    cursor: "pointer",
    _hover: { background: "var(--z-btn-surface-hover)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { minHeight: "44px" },
  },
});

const Footer = styled("p", {
  base: {
    marginBlockStart: "40px !important",
    fontSize: "12px",
    color: "var(--z-fg-muted) !important",
  },
});
