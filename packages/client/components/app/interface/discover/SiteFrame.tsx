import { For, JSX, Show, createSignal, onCleanup, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { brandMarkSrc } from "@revolt/common/lib/brandMark";
import { SOURCE_CODE_URL } from "@revolt/common/lib/buildInfo";
import { Language } from "@revolt/i18n";
import { useState } from "@revolt/state";
import { Icon } from "@revolt/ui/icons/Icon";

import { SITE_LANGUAGES, WEBSITE_URL } from "./sites";

type SiteId = "discover" | "designs";

/**
 * The frame of the public sites (discover.zrzur.com, designs.zrzur.com):
 * the header and footer every Zrzur site shares, around the same pages
 * the app shows inside its own shell.
 */
export function SiteFrame(props: { site: SiteId; children: JSX.Element }) {
  const [moved, setMoved] = createSignal(false);
  let frame: HTMLDivElement | undefined;
  let mark: HTMLDivElement | undefined;
  // an observer, not a scroll listener: nothing runs while the page scrolls
  onMount(() => {
    if (!frame || !mark) return;
    const observer = new IntersectionObserver(
      (entries) => setMoved(!entries[entries.length - 1].isIntersecting),
      { root: frame },
    );
    observer.observe(mark);
    onCleanup(() => observer.disconnect());
  });
  return (
    <Frame ref={frame} data-moved={moved()}>
      <TopMark ref={mark} aria-hidden="true" />
      <SiteHeader site={props.site} />
      <Body>{props.children}</Body>
      <SiteFooter site={props.site} />
    </Frame>
  );
}

function Lockup(props: { site: SiteId }) {
  const state = useState();
  return (
    <LockupLink href="/">
      <img
        src={brandMarkSrc(state.theme.activeTheme.darkMode)}
        alt=""
        width={32}
        height={32}
      />
      <span>
        <Trans>Zrzur</Trans>
      </span>
      <em>
        <Show
          when={props.site === "discover"}
          fallback={<Trans>Designs</Trans>}
        >
          <Trans>Discover</Trans>
        </Show>
      </em>
    </LockupLink>
  );
}

export function SiteHeader(props: { site: SiteId }) {
  return (
    <Header>
      <Lockup site={props.site} />
      <Spacer />
      <LanguageSwitch />
    </Header>
  );
}

/** Language by its own name; the choice is remembered on this device */
export function LanguageSwitch() {
  const state = useState();
  const { i18n, t } = useLingui();
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  const current = () =>
    SITE_LANGUAGES.find((language) => language.id === i18n().locale) ??
    SITE_LANGUAGES[1];

  const close = (event: Event) => {
    if (root && !root.contains(event.target as Node)) setOpen(false);
  };
  document.addEventListener("pointerdown", close);
  onCleanup(() => document.removeEventListener("pointerdown", close));

  const choose = (id: string) => {
    state.locale.switch(id as Language);
    setOpen(false);
  };

  return (
    <LanguageRoot
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <LanguageButton
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={t`Language: ${current().name}`}
        onClick={() => setOpen(!open())}
      >
        <Icon name="globe" size={18} />
        <span>{current().name}</span>
        <Icon name="caret-down" size={14} />
      </LanguageButton>
      <Show when={open()}>
        <LanguageList role="listbox" aria-label={t`Language`}>
          <For each={SITE_LANGUAGES}>
            {(language) => (
              <li>
                <button
                  type="button"
                  role="option"
                  lang={language.id}
                  aria-selected={language.id === current().id}
                  onClick={() => choose(language.id)}
                >
                  {language.name}
                  <Show when={language.id === current().id}>
                    <Icon name="check" size={16} />
                  </Show>
                </button>
              </li>
            )}
          </For>
        </LanguageList>
      </Show>
    </LanguageRoot>
  );
}

export function SiteFooter(props: { site: SiteId }) {
  const { t } = useLingui();
  const links = () => [
    { href: `${WEBSITE_URL}/legal/terms`, label: t`Terms` },
    { href: `${WEBSITE_URL}/legal/privacy`, label: t`Privacy` },
    { href: `${WEBSITE_URL}/legal/impressum`, label: t`Impressum` },
    ...(props.site === "discover"
      ? [
          {
            href: `${WEBSITE_URL}/legal/discover-guidelines`,
            label: t`Discover rules`,
          },
        ]
      : []),
    { href: SOURCE_CODE_URL, label: t`Source code` },
  ];

  return (
    <Footer>
      <For each={links()}>
        {(link) => <a href={link.href}>{link.label}</a>}
      </For>
    </Footer>
  );
}

/** The whole site scrolls here (the app root is a fixed-height box) */
const Frame = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    background: "var(--z-bg-frame)",
    color: "var(--z-fg-primary)",
  },
});

/** Once this has left the frame, the page has moved */
const TopMark = styled("div", {
  base: {
    position: "absolute",
    top: "8px",
    width: "1px",
    height: "1px",
    pointerEvents: "none",
  },
});

/** Pages inside grow with their content instead of scrolling themselves */
const Body = styled("div", {
  base: {
    flex: "1 0 auto",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    "& > main, & [data-discover-scroll], & [data-designs-scroll]": {
      flex: "1 0 auto",
      height: "auto",
      overflow: "visible",
    },
  },
});

const Header = styled("header", {
  base: {
    position: "relative",
    zIndex: 20,
    height: "72px",
    flexShrink: 0,
    paddingInline: "40px",
    display: "flex",
    alignItems: "center",
    gap: "40px",
    background: "transparent",
    transition: "background-color 120ms ease",
    "[data-moved='true'] > &": { background: "var(--z-bg-frame)" },
    "@media (max-width: 760px)": { paddingInline: "16px", gap: "8px" },
  },
});

const LockupLink = styled("a", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "44px",
    gap: "10px",
    flexShrink: 0,
    color: "var(--z-fg-primary)",
    textDecoration: "none",
    fontSize: "22px",
    fontWeight: 700,
    borderRadius: "10px",
    "& em": {
      fontStyle: "normal",
      fontWeight: 400,
      color: "var(--z-fg-secondary)",
    },
    "@media (max-width: 760px)": { fontSize: "18px", gap: "8px" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "4px",
    },
  },
});

const Spacer = styled("div", { base: { flex: 1 } });

const control = {
  height: "36px",
  paddingInline: "12px",
  borderRadius: "10px",
  border: "1px solid var(--z-border-subtle)",
  background: "transparent",
  color: "var(--z-fg-primary)",
  font: "inherit",
  fontSize: "14px",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
  "&:hover": { background: "var(--z-nav-hover)" },
  "&:focus-visible": {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "2px",
  },
  "@media (max-width: 760px)": { height: "44px" },
} as const;

const LanguageRoot = styled("div", { base: { position: "relative" } });

const LanguageButton = styled("button", {
  base: {
    ...control,
    "@media (max-width: 760px)": {
      height: "44px",
      minWidth: "44px",
      justifyContent: "center",
      "& > span": { display: "none" },
    },
  },
});

const LanguageList = styled("ul", {
  base: {
    position: "absolute",
    top: "calc(100% + 8px)",
    insetInlineEnd: 0,
    zIndex: 30,
    minWidth: "176px",
    margin: 0,
    padding: "6px",
    listStyle: "none",
    borderRadius: "10px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-floating)",
    boxShadow: "0 12px 32px rgb(0 0 0 / 0.45)",
    "& button": {
      width: "100%",
      minHeight: "44px",
      paddingInline: "12px",
      border: 0,
      borderRadius: "6px",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "15px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      cursor: "pointer",
      "&:hover": { background: "var(--z-nav-hover)" },
      "&:focus-visible": { outline: "2px solid var(--z-focus)" },
      "&[aria-selected='true']": { fontWeight: 600 },
    },
  },
});

/** One quiet line: the legal links must stay one click from every page */
const Footer = styled("footer", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px 24px",
    padding: "24px 16px",
    "& a": {
      minHeight: "24px",
      display: "inline-flex",
      alignItems: "center",
      fontSize: "13px",
      color: "var(--z-fg-muted)",
      textDecoration: "none",
      _hover: { color: "var(--z-fg-primary)" },
      "&:focus-visible": { outline: "2px solid var(--z-focus)" },
      _phone: { minHeight: "44px" },
    },
  },
});

