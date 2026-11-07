import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { LanguageSwitch } from "@revolt/app/interface/discover/SiteFrame";
import { useLocation } from "@revolt/routing";
import { Header } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { DocsPortal } from "./developers/docs/DocsPortal";

/**
 * The developer documentation for visitors: no account and no chat client,
 * because a developer reads it before signing up. People who are signed in
 * read the same pages inside the app. A link can ask for a language with
 * `?hl=ar`, as everywhere else.
 */
export function DevelopersDocs() {
  const location = useLocation();
  const page = () => /\/developers\/docs\/([^/]+)/.exec(location.pathname)?.[1];

  return (
    <Base>
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
      <DocsPortal page={page()} />
    </Base>
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
  base: { marginInlineStart: "auto", flexShrink: 0 },
});
