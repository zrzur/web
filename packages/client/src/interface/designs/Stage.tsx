import {
  For,
  JSX,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { FeatherIcon } from "@revolt/ui/icons/FeatherIcon";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

/** the highlight colour (Neon Pink), the colour of the Designs pages */
const HL = "var(--z-designs-pink)";

export type Chapter = {
  id: string;
  icon: IconName;
  label: string;
  /** one line saying what is behind it */
  hint: string;
  on: boolean;
  go: () => void;
};

/**
 * The stage every Designs page opens on: one slim bar of its own (the way
 * back, the name, the chapters as text tabs with an underline, a search at
 * the end), then the title of the page. "/" jumps into the search.
 */
export function Stage(props: {
  onLeave: () => void;
  /** the standalone Designs site: no way back into the app */
  site?: boolean;
  /** your avatar (or sign-in), at the end of the bar */
  account?: JSX.Element;
  chapters: Chapter[];
  /** the search at the end of the bar */
  search?: {
    value: string;
    onInput: (value: string) => void;
  };
  /** the title of the page; left out on pages that bring their own */
  hero?: {
    title: JSX.Element;
    text: JSX.Element;
    /** on the end side, hidden on narrow screens */
    art?: JSX.Element;
    /** a working page: the title makes room for the work */
    quiet?: boolean;
  };
}) {
  const { t } = useLingui();
  // once the page scrolls the bar stays at the top, solid
  const [stuck, setStuck] = createSignal(false);
  // phones: the search opens from an icon
  const [open, setOpen] = createSignal(false);
  let bar: HTMLDivElement | undefined;
  let topMark: HTMLDivElement | undefined;
  // an observer: the app scrolls one box, the site another, and nothing runs
  // while the page scrolls
  onMount(() => {
    if (!topMark) return;
    const observer = new IntersectionObserver((entries) =>
      setStuck(!entries[entries.length - 1].isIntersecting),
    );
    observer.observe(topMark);
    onCleanup(() => observer.disconnect());
  });
  // "/" anywhere on the page jumps into the search
  const onKey = (e: KeyboardEvent) => {
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
    setOpen(true);
    requestAnimationFrame(() =>
      bar?.querySelector<HTMLInputElement>("input")?.focus(),
    );
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  return (
    <StageBase data-compact={!props.hero}>
      <div
        ref={topMark}
        aria-hidden="true"
        // out of the flow: a child of the page column would add its gap
        style={{ position: "absolute", width: "1px", height: "1px" }}
      />
      <Bar
        ref={bar}
        data-stuck={stuck()}
        data-open={open()}
        data-full={props.chapters.length > 3}
      >
        {/* inside the app only: on its own site Designs is the home */}
        <Show when={!props.site}>
          <Leave
            type="button"
            aria-label={t`Leave designs`}
            title={t`Leave designs`}
            onClick={props.onLeave}
          >
            <Icon name="arrow-left" size={18} />
            <span>
              <Trans>Home</Trans>
            </span>
          </Leave>
        </Show>
        {/* on its own site the header above already says where you are */}
        <Show when={!props.site}>
          <Brand data-brand>
            <FeatherIcon size={20} tone="plain" />
            <span>
              <Trans>Designs</Trans>
            </span>
          </Brand>
        </Show>

        <Tabs aria-label={t`Designs`}>
          <For each={props.chapters}>
            {(chapter) => (
              <button
                type="button"
                title={chapter.hint}
                aria-label={chapter.label}
                aria-current={chapter.on ? "page" : undefined}
                // a row that scrolls: keep the open tab in view
                ref={(el) =>
                  createEffect(() => {
                    if (chapter.on)
                      requestAnimationFrame(() => {
                        const row = el.parentElement;
                        if (row && row.scrollWidth > row.clientWidth)
                          el.scrollIntoView({
                            inline: "center",
                            block: "nearest",
                          });
                      });
                  })
                }
                onClick={() => chapter.go()}
              >
                <Icon name={chapter.icon} size={20} />
                <span>{chapter.label}</span>
              </button>
            )}
          </For>
        </Tabs>

        <Show when={props.search}>
          {(search) => (
            <>
              {/* phones: an icon first, the field when tapped */}
              <SearchToggle
                type="button"
                aria-label={t`Search designs`}
                aria-expanded={open()}
                onClick={() => {
                  setOpen(!open());
                  if (open())
                    requestAnimationFrame(() =>
                      bar?.querySelector<HTMLInputElement>("input")?.focus(),
                    );
                }}
              >
                <Icon name={open() ? "x" : "magnifying-glass"} size={20} />
              </SearchToggle>
              <Find>
                <Icon name="magnifying-glass" size={16} />
                <input
                  type="search"
                  value={search().value}
                  placeholder={t`Search designs`}
                  aria-label={t`Search designs`}
                  aria-keyshortcuts="/"
                  onInput={(e) => search().onInput(e.currentTarget.value)}
                />
                <Show
                  when={search().value}
                  fallback={<kbd aria-hidden="true">/</kbd>}
                >
                  <button
                    type="button"
                    aria-label={t`Clear search`}
                    onClick={() => search().onInput("")}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </Show>
              </Find>
            </>
          )}
        </Show>
        {props.account}
      </Bar>

      <Show when={props.hero}>
        {(hero) => (
          <Body data-art={!!hero().art} data-quiet={hero().quiet}>
            <Text>
              <h1>{hero().title}</h1>
              <p>{hero().text}</p>
            </Text>
            <Show when={hero().art}>
              <Art>{hero().art}</Art>
            </Show>
          </Body>
        )}
      </Show>
    </StageBase>
  );
}

/**
 * Tools for creators and reviewers, each with its name: a quiet labelled
 * row under the stage, shown only to those who have any
 */
export function CreatorTools(props: { children: JSX.Element }) {
  return (
    <ToolsBase>
      <span>
        <Trans>For creators</Trans>
      </span>
      {props.children}
    </ToolsBase>
  );
}

export const ToolButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    height: "36px",
    paddingInline: "14px",
    borderRadius: "var(--z-shape-button, 6px)",
    border: "1px solid var(--z-designs-edge)",
    background: "var(--z-designs-glass, var(--z-card-bg))",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 650,
    cursor: "pointer",
    "--z-icon-color": HL,
    transition: "border-color 120ms ease, background-color 120ms ease",
    _hover: {
      borderColor: `color-mix(in srgb, var(--z-designs-pink) 55%, transparent)`,
      background: "var(--z-designs-glass-hover)",
    },
    "&:active": { background: "var(--z-designs-surface-raised)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { height: "44px" },
    "& > b": {
      minWidth: "20px",
      height: "20px",
      paddingInline: "6px",
      boxSizing: "border-box",
      borderRadius: "var(--z-shape-pill, 9999px)",
      fontSize: "11px",
      lineHeight: "20px",
      textAlign: "center",
      color: "var(--z-designs-on-pink)",
      background: "var(--z-designs-fill)",
    },
  },
});

// no box of its own: the bar and the hero sit in the page itself, so the
// bar can stay at the top for the whole page
const StageBase = styled("section", {
  base: { display: "contents" },
});

/**
 * The bar: start to end, the way back, the name, the tabs and the search.
 * Phones: the tabs get their own row that scrolls sideways.
 */
const Bar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    minHeight: "64px",
    // a phone with a fourth chapter: the feather stands for the word, so the
    // search stays on this line
    _phone: { "&[data-full='true'] [data-brand] > span": { display: "none" } },
    // flat on the page; once scrolled it stays at the top on a solid strip
    // that runs edge to edge
    position: "sticky",
    top: 0,
    zIndex: 5,
    transition: "background-color 150ms ease, box-shadow 150ms ease",
    // stuck: a solid strip in the page colour, edge to edge, as on Discover
    "&[data-stuck='true']": {
      "&::before": {
        content: "''",
        position: "absolute",
        zIndex: -1,
        insetBlock: 0,
        insetInline: "calc(50% - 50vw)",
        background: "var(--z-designs-page)",
        borderBottom: "1px solid var(--z-designs-edge)",
      },
    },
    "@media (max-width: 899px)": {
      flexWrap: "wrap",
      gap: "0 4px",
      minHeight: "44px",
      position: "relative",
    },
  },
});

/** plain text tabs; the open one is marked by a short highlight underline */
const Tabs = styled("nav", {
  base: {
    display: "flex",
    alignItems: "stretch",
    alignSelf: "stretch",
    gap: "4px",
    minWidth: 0,
    marginInlineEnd: "auto",
    // never under the search: the row scrolls rather than overlaps
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
    "& button": {
      position: "relative",
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      minHeight: "44px",
      paddingInline: "12px",
      "--z-icon-color": "currentColor",
      border: "none",
      background: "transparent",
      color: "var(--z-fg-muted)",
      font: "inherit",
      fontSize: "15px",
      fontWeight: 650,
      whiteSpace: "nowrap",
      cursor: "pointer",
      transition: "color 120ms ease",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-4px",
        borderRadius: "8px",
      },
      "&::after": {
        content: "''",
        position: "absolute",
        insetInline: "12px",
        bottom: "0",
        height: "3px",
        borderRadius: "3px 3px 0 0",
        background: "transparent",
        transition: "background-color 150ms ease",
      },
    },
    "& button[aria-current='page']": {
      color: "var(--z-fg-primary)",
      "&::after": { background: HL },
    },
    // narrow: icons on the same row as the name, so nothing stacks up
    "@media (max-width: 899px)": {
      order: 1,
      flexShrink: 0,
      marginInline: "0 auto",
      paddingInline: "0",
      borderInlineStart: "none",
      "& button": { minWidth: "44px", paddingInline: "8px" },
      "& button > span": { display: "none" },
      "& button::after": { insetInline: "8px" },
    },
  },
});

/** phones: the search icon in the bar */
const SearchToggle = styled("button", {
  base: {
    display: "none",
    "@media (max-width: 899px)": {
      order: 2,
      display: "grid",
      placeItems: "center",
      width: "44px",
      height: "44px",
      borderRadius: "var(--z-shape-button, 6px)",
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

/** the small search at the end of the bar */
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
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "& input::placeholder": {
      color: "var(--z-designs-placeholder)",
      opacity: 1,
    },
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
      borderRadius: "4px",
      border: "1px solid var(--z-designs-edge)",
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
      borderRadius: "6px",
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

const Leave = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "32px",
    paddingInline: "8px",
    borderRadius: "var(--z-shape-button, 6px)",
    border: "none",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 650,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    "&:active": { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { height: "44px", minWidth: "44px", marginInlineStart: 0 },
    "@media (max-width: 899px)": { "& > span": { display: "none" } },
  },
});

const Brand = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
    fontSize: "16px",
    whiteSpace: "nowrap",
    "--z-icon-color": "var(--z-fg-primary)",
  },
});

const Body = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "end",
    gap: "40px",
    paddingBlock: "8px",
    "&[data-quiet='true']": {
      paddingBlock: 0,
      "& h1": { fontSize: "28px", lineHeight: "36px" },
      "& p": { fontSize: "14px", lineHeight: "20px" },
    },
    "&[data-art='true']": {
      gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 280px)",
    },
    "@media (max-width: 899px)": {
      "&[data-art='true']": { gridTemplateColumns: "minmax(0, 1fr)" },
    },
  },
});

const Text = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    minWidth: 0,
    "& h1": {
      margin: 0,
      fontSize: "clamp(28px, 4vw, 40px)",
      lineHeight: "1.2",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& > p": {
      margin: 0,
      maxWidth: "640px",
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Art = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    "@media (max-width: 899px)": { display: "none" },
  },
});

const ToolsBase = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginTop: "-8px",
    // phones: one row that scrolls on its own
    _phone: {
      flexWrap: "nowrap",
      overflowX: "auto",
      scrollbarWidth: "none",
      marginInline: "-16px",
      paddingInline: "16px",
      "&::-webkit-scrollbar": { display: "none" },
      "& > *": { flexShrink: 0 },
    },
    "& > span": {
      marginInlineEnd: "4px",
      fontSize: "12px",
      fontWeight: 600,
      color: "var(--z-fg-muted)",
    },
  },
});
