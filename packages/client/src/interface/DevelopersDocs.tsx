import { Show, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Titlebar } from "@revolt/app/interface/desktop/Titlebar";
import {
  LanguageSwitch,
  SiteFooter,
} from "@revolt/app/interface/discover/SiteFrame";
import { developersUrl } from "@revolt/app/interface/discover/sites";
import { CONFIGURATION } from "@revolt/common";
import { brandMarkSrc } from "@revolt/common/lib/brandMark";
import { useLocation } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Header } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { docsBase, isDocsSite } from "../siteKind";

import { DocsPortal } from "./developers/docs/DocsPortal";
import { pageOfPath, siteAddress } from "./developers/docs/links";

/**
 * The developer documentation, for everyone: it never waits for the chat
 * client or the gateway, so a direct link or a reload shows the page at
 * once, signed in or not (its route sits outside the app interface, see
 * app.tsx and sites.tsx). A link can ask for a language with `?hl=ar`, as
 * everywhere else.
 *
 * It is a website of its own where VITE_DOCS_URL names one
 * (developers.zrzur.com): there the pages live at the root, and the same
 * addresses inside the web app forward to it. Without that address, and in
 * the desktop app, the pages show here.
 */
export function DevelopersDocs() {
  const location = useLocation();
  const site = isDocsSite();
  const page = () => pageOfPath(location.pathname, docsBase());

  // an old link into the web app: the same page on the documentation site
  const forward = !site && !window.native && CONFIGURATION.DOCS_URL;
  onMount(() => {
    if (forward) window.location.replace(siteAddress(forward, location));
  });

  return (
    <Show when={!forward}>
      <Base>
        <Show
          when={site}
          fallback={
            <>
              {/* window controls in the desktop app; nothing on the web */}
              <Titlebar bare />
              <Header placement="primary">
                <Brand>
                  <Icon name="code" size={22} />
                  <Title>
                    <Trans>Developer documentation</Trans>
                  </Title>
                </Brand>
                <Languages>
                  <LanguageSwitch />
                </Languages>
              </Header>
            </>
          }
        >
          <SiteHeader />
        </Show>
        <DocsPortal
          page={page()}
          site={site}
          footer={site ? <SiteFooter site="docs" /> : undefined}
        />
      </Base>
    </Show>
  );
}

/** The site's own header: who this is, the way to the portal, the language */
function SiteHeader() {
  const state = useState();
  const { t } = useLingui();
  return (
    <SiteBar>
      <Lockup href="/" aria-label={t`Zrzur Developers`}>
        <img
          src={brandMarkSrc(state.theme.activeTheme.darkMode)}
          alt=""
          width={28}
          height={28}
        />
        <span>
          <Trans>Zrzur</Trans>
        </span>
        <em>
          <Trans>Developers</Trans>
        </em>
      </Lockup>
      <Languages>
        <PortalLink href={developersUrl()}>
          <Trans>Developer Portal</Trans>
          <Icon name="arrow-square-out" size={14} class="out" />
        </PortalLink>
        <LanguageSwitch />
      </Languages>
    </SiteBar>
  );
}

const Base = styled("main", {
  base: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "var(--z-bg-app)",
    color: "var(--z-fg-primary)",
  },
});

const Brand = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 },
});

const Title = styled("span", {
  base: {
    fontSize: "15px",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Languages = styled("div", {
  base: {
    marginInlineStart: "auto",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
});

const SiteBar = styled("header", {
  base: {
    height: "64px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "16px",
    // the lockup starts where the contents' words start (8 + 12)
    paddingInline: "20px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    _phone: { height: "56px", paddingInline: "16px", gap: "8px" },
  },
});

const Lockup = styled("a", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "44px",
    minWidth: 0,
    color: "var(--z-fg-primary)",
    textDecoration: "none",
    fontSize: "18px",
    fontWeight: 700,
    borderRadius: "10px",
    "& em": {
      fontStyle: "normal",
      fontWeight: 400,
      color: "var(--z-fg-secondary)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "4px",
    },
  },
});

const PortalLink = styled("a", {
  base: {
    height: "36px",
    paddingInline: "12px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "10px",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    textDecoration: "none",
    whiteSpace: "nowrap",
    "&:hover": {
      background: "var(--z-nav-hover)",
      color: "var(--z-fg-primary)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    // the arrow points out of the page, also when the page reads right to left
    "& .out": { _rtl: { transform: "scaleX(-1)" } },
    // on a phone the same link is the first line of the contents
    _phone: { display: "none" },
  },
});
