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
import { Icon } from "@revolt/ui/icons/Icon";

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
import { Markdown } from "./Markdown";
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
    "http-interactions": t`Interactions over HTTP`,
    messages: t`Messages`,
    channels: t`Channels and webhooks`,
    servers: t`Servers`,
    users: t`Users and members`,
    roles: t`Roles and permissions`,
    moderation: t`Moderation`,
    files: t`Files`,
    voice: t`Voice calls`,
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
    "tutorial-multi-server": t`Many servers`,
    "tutorial-upload": t`File upload`,
    "tutorial-voice": t`Voice bot`,
    "tutorial-deploy": t`Deployment`,
    "raw-http": t`Without a library`,
    sdk: t`SDKs`,
    coverage: t`Status and coverage`,
    changelog: t`API changelog`,
  });

  const groups = (): { id: PageGroup; label: string }[] => [
    { id: "start", label: t`Start here` },
    { id: "guides", label: t`Guides and reference` },
    { id: "tutorials", label: t`Tutorials` },
    { id: "resources", label: t`Resources` },
  ];

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
        <NavGroup>
          <ul>
            <li>
              <a {...link("/developers")}>
                <Trans>My applications</Trans>
              </a>
            </li>
          </ul>
        </NavGroup>
        <Search role="search">
          <Icon name="magnifying-glass" size={16} aria-hidden="true" />
          <input
            id="docs-search"
            aria-label={t`Search the documentation`}
            type="search"
            placeholder={t`Search pages, endpoints, events`}
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
        </Search>
        <Show
          when={query().trim()}
          fallback={
            <For each={groups()}>
              {(group) => (
                <NavGroup>
                  <h2>{group.label}</h2>
                  <ul>
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
                      <Markdown source={source()} onNavigate={go} />
                      <Footer>
                        <Trans>
                          Reference generated from backend{" "}
                          {inventory.generated.backend} and OpenAPI{" "}
                          {inventory.generated.openapi}. Descriptions that come
                          from the API stay in English.
                        </Trans>
                      </Footer>
                    </Article>
                    <Pager aria-label={t`More pages`}>
                      <Show when={neighbours().previous} fallback={<span />}>
                        {(p) => (
                          <a {...link(`/developers/docs/${p().id}`)}>
                            <small>{t`Previous`}</small>
                            <span>{titles()[p().id]}</span>
                          </a>
                        )}
                      </Show>
                      <Show when={neighbours().next}>
                        {(p) => (
                          <a
                            {...link(`/developers/docs/${p().id}`)}
                            data-next=""
                          >
                            <small>{t`Next`}</small>
                            <span>{titles()[p().id]}</span>
                          </a>
                        )}
                      </Show>
                    </Pager>
                  </>
                )}
              </Show>
            </Show>
          )}
        </Show>
        {props.footer}
      </Content>
      <Show when={props.site && sections().length > 1}>
        <OnThisPage aria-label={t`On this page`}>
          <h2>{t`On this page`}</h2>
          <ul>
            <For each={sections()}>
              {(section) => (
                <li>
                  <a
                    {...link(`/developers/docs/${page()?.id}#${section.id}`)}
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
    gap: "16px",
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

const NavGroup = styled("div", {
  base: {
    "& h2": {
      margin: 0,
      padding: "0 12px 4px",
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-muted)",
    },
    "& ul": {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
    "& a": {
      display: "flex",
      alignItems: "center",
      minHeight: "32px",
      padding: "0 12px",
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
      "&[aria-current=page]": {
        background: "var(--z-nav-selected)",
        color: "var(--z-fg-primary)",
        fontWeight: 600,
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
    maxWidth: "880px",
    marginInline: "auto",
    color: "var(--z-fg-primary)",
    lineHeight: 1.6,
    fontSize: "15px",
    "& h1": {
      fontSize: "28px",
      fontWeight: 700,
      margin: "0 0 16px",
      lineHeight: 1.25,
    },
    "& h2": {
      fontSize: "20px",
      fontWeight: 650,
      margin: "32px 0 12px",
      scrollMarginTop: "16px",
    },
    "& h3": { fontSize: "16px", fontWeight: 650, margin: "24px 0 8px" },
    "& p": { margin: "0 0 12px", color: "var(--z-fg-secondary)" },
    // the app's reset takes list markers away; steps and lists need them
    "& ul": {
      margin: "0 0 12px",
      paddingInlineStart: "24px",
      color: "var(--z-fg-secondary)",
      listStyle: "disc",
    },
    "& ol": {
      margin: "0 0 12px",
      paddingInlineStart: "24px",
      color: "var(--z-fg-secondary)",
      listStyle: "decimal",
    },
    "& li::marker": { color: "var(--z-fg-muted)" },
    "& li": { marginBlockEnd: "4px" },
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
    "& figure": { marginBlockEnd: "16px" },
    "& aside": { marginBlockEnd: "16px" },
    "& > div": { marginBlockEnd: "16px" },
    "& hr": {
      border: "none",
      borderBlockStart: "1px solid var(--z-border-subtle)",
      margin: "24px 0",
    },
  },
});

/** The pages before and after this one */
const Pager = styled("nav", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    maxWidth: "880px",
    marginInline: "auto",
    marginBlockStart: "32px",
    "& a": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minHeight: "64px",
      justifyContent: "center",
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
    "& a[data-next]": { textAlign: "end", gridColumn: 2 },
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
