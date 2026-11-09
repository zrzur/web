import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useLocation, useNavigate } from "@revolt/routing";
import { Icon } from "@revolt/ui/icons/Icon";

import { GettingStarted } from "./GettingStarted";
import {
  type SearchEntry,
  endpointSlug,
  inventory,
  pageOfSection,
} from "./inventory";
import { Markdown } from "./Markdown";
import { headingsOf } from "./markdownTree";
import {
  type PageGroup,
  DEFAULT_PAGE,
  PAGES,
  pageById,
  sourceFor,
} from "./pages";

/**
 * Bot API documentation inside the Developer Portal:
 * /developers/docs/<page>#<anchor>
 */
export function DocsPortal(props: { page?: string }) {
  const { t, i18n } = useLingui();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = createSignal("");
  const [menuOpen, setMenuOpen] = createSignal(false);
  let main: HTMLDivElement | undefined;

  const page = () => pageById(props.page ?? DEFAULT_PAGE);

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
    for (const p of PAGES) {
      const title = titles()[p.id] ?? p.id;
      entries.push({
        kind: "page",
        label: title,
        detail: p.id,
        href: `/developers/docs/${p.id}`,
      });
      for (const heading of p.source
        ? headingsOf(sourceFor(p, i18n().locale) ?? p.source)
        : [])
        entries.push({
          kind: "heading",
          label: heading.text,
          detail: title,
          href: `/developers/docs/${p.id}#${heading.id}`,
        });
    }
    for (const endpoint of inventory.endpoints)
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
    return index()
      .filter((entry) => {
        const text = `${entry.label} ${entry.detail}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .slice(0, 20);
  });

  function go(href: string) {
    setMenuOpen(false);
    setQuery("");
    navigate(href);
  }

  // jump to the anchor, or to the top of a new page
  createEffect(
    on([() => props.page, () => location.hash], ([, hash]) => {
      requestAnimationFrame(() => {
        const target = hash
          ? document.getElementById(decodeURIComponent(hash.slice(1)))
          : null;
        if (target) target.scrollIntoView({ block: "start" });
        else main?.scrollTo({ top: 0 });
      });
    }),
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
              <a
                href="/developers"
                onClick={(event) => {
                  event.preventDefault();
                  go("/developers");
                }}
              >
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
            onInput={(event) => setQuery(event.currentTarget.value)}
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
                            href={`/developers/docs/${p.id}`}
                            aria-current={
                              page()?.id === p.id ? "page" : undefined
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              go(`/developers/docs/${p.id}`);
                            }}
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
                    <a
                      href={entry.href}
                      onClick={(event) => {
                        event.preventDefault();
                        go(entry.href);
                      }}
                    >
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
                <a
                  href="/developers/docs/overview"
                  onClick={(event) => {
                    event.preventDefault();
                    go("/developers/docs/overview");
                  }}
                >
                  <Trans>Go to the overview</Trans>
                </a>
              </p>
            </Article>
          }
        >
          {(current) => (
            <Show
              when={current().source}
              fallback={
                <Article>
                  <GettingStarted onNavigate={go} />
                </Article>
              }
            >
              {(source) => (
                <Article>
                  <Markdown
                    source={sourceFor(current(), i18n().locale) ?? source()}
                    onNavigate={go}
                  />
                  <Footer>
                    <Trans>
                      Reference generated from backend{" "}
                      {inventory.generated.backend} and OpenAPI{" "}
                      {inventory.generated.openapi}. Descriptions that come from
                      the API stay in English.
                    </Trans>
                  </Footer>
                </Article>
              )}
            </Show>
          )}
        </Show>
      </Content>
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
    "& ul": {
      margin: "0 0 12px",
      paddingInlineStart: "24px",
      color: "var(--z-fg-secondary)",
    },
    "& ol": {
      margin: "0 0 12px",
      paddingInlineStart: "24px",
      color: "var(--z-fg-secondary)",
    },
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

const Footer = styled("p", {
  base: {
    marginBlockStart: "40px !important",
    fontSize: "12px",
    color: "var(--z-fg-muted) !important",
  },
});
