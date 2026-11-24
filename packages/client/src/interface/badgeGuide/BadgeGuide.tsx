import { For, Show, createEffect } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { brandMarkSrc } from "@revolt/common/lib/brandMark";
import { A } from "@revolt/routing";
import { useState } from "@revolt/state";
import { BrandName } from "@revolt/ui/components/design/BrandName";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import {
  BadgeHow,
  useBadgeText,
} from "@revolt/ui/components/features/profiles/badges/useBadgeText";

import { CRITERIA_CHANGED, useBadgeGuide } from "./useBadgeGuide";

/**
 * Zrzur badges (`/badges`): every badge given out today, its art, what it
 * means, how it is earned and the published criteria. Name, meaning and the
 * "how it is earned" line are the ones the app shows everywhere
 * (`useBadgeText`); this page adds the details below them. Open to everyone,
 * signed in or not; its own small chunk, loaded only here.
 */
export default function BadgeGuide() {
  const { t, i18n } = useLingui();
  const state = useState();
  const text = useBadgeText();
  const guide = useBadgeGuide();

  createEffect(() => {
    document.title = t`Zrzur badges`;
  });

  const how = (value: BadgeHow) =>
    ({
      automatic: t`Automatic`,
      application: t`By application`,
      team: t`Given by the team`,
      none: t`Not obtainable`,
    })[value];

  const changed = () =>
    new Intl.DateTimeFormat(i18n().locale, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(CRITERIA_CHANGED);

  return (
    <Page data-badge-guide>
      <Top>
        <Brand href="/" aria-label={t`Zrzur`}>
          <img
            src={brandMarkSrc(state.theme.activeTheme.darkMode)}
            alt=""
            width={32}
            height={32}
          />
          <BrandName />
        </Brand>
        <TopLink href="/">
          <Trans>Open Zrzur</Trans>
        </TopLink>
      </Top>

      <Column>
        <Head>
          <h1>
            <Trans>Zrzur badges</Trans>
          </h1>
          <p>
            <Trans>What each badge means and how it is earned.</Trans>
          </p>
        </Head>

        <Rules aria-labelledby="badge-guide-rules">
          <h2 id="badge-guide-rules">
            <Trans>Rules for every badge</Trans>
          </h2>
          <ul>
            <For each={guide().rules}>{(rule) => <li>{rule}</li>}</For>
          </ul>
          <p>
            <Trans>
              Where a badge is by application, you apply in Settings → Badges
              when applications are open.
            </Trans>
          </p>
        </Rules>

        <For each={guide().sections}>
          {(section) => (
            <Section aria-labelledby={`badge-guide-${section.id}`}>
              <h2 id={`badge-guide-${section.id}`}>{section.title}</h2>
              <List role="list">
                <For each={section.entries}>
                  {(entry) => (
                    <Entry role="listitem" data-guide-badge={entry.id}>
                      <Art>
                        <BadgeMark id={entry.id} size="xl" />
                      </Art>
                      <Body>
                        <NameLine>
                          <h3>{entry.name ?? text(entry.id).name}</h3>
                          <How data-how={text(entry.id).how}>
                            {how(text(entry.id).how)}
                          </How>
                        </NameLine>
                        <Show when={text(entry.id).description}>
                          <Meaning data-guide-meaning>
                            {text(entry.id).description}
                          </Meaning>
                        </Show>
                        <Criteria
                          aria-label={t`What it takes`}
                          data-guide-criteria
                        >
                          <li data-guide-earn>{text(entry.id).earn}</li>
                          <For each={entry.details}>
                            {(line) => <li>{line}</li>}
                          </For>
                        </Criteria>
                      </Body>
                    </Entry>
                  )}
                </For>
              </List>
            </Section>
          )}
        </For>

        <Foot>
          <p>
            <Trans>
              Retired badges are not listed here; people who have one keep it.
            </Trans>
          </p>
          <p>
            <Trans>Criteria last changed on {changed()}.</Trans>
          </p>
        </Foot>
      </Column>
    </Page>
  );
}

const PHONE = "@media (max-width: 600px)";

const Page = styled("main", {
  base: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
    width: "100%",
    overflowY: "auto",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-frame)",
    [PHONE]: { background: "var(--z-bg-nav)" },
  },
});

const Top = styled("header", {
  base: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "64px",
    paddingInline: "32px",
    [PHONE]: { height: "56px", paddingInline: "16px" },
  },
});

const focusRing = {
  outline: "2px solid var(--z-focus)",
  outlineOffset: "2px",
};

const Brand = styled(A, {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    textDecoration: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    _focusVisible: focusRing,
  },
});

const TopLink = styled(A, {
  base: {
    display: "flex",
    alignItems: "center",
    minHeight: "44px",
    paddingInline: "16px",
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--z-on-accent)",
    background: "var(--z-accent)",
    textDecoration: "none",
    borderRadius: "var(--z-radius-pill)",
    _hover: { background: "var(--z-accent-hover)" },
    _active: { background: "var(--z-accent-pressed)" },
    _focusVisible: focusRing,
  },
});

const Column = styled("div", {
  base: {
    width: "100%",
    maxWidth: "880px",
    marginInline: "auto",
    padding: "16px 32px 64px",
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    [PHONE]: { padding: "8px 16px 48px", gap: "24px" },
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& h1": {
      margin: 0,
      fontSize: "28px",
      lineHeight: "36px",
      fontWeight: 700,
      [PHONE]: { fontSize: "24px", lineHeight: "32px" },
    },
    "& p": {
      margin: 0,
      fontSize: "16px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const sectionTitle = {
  margin: 0,
  fontSize: "20px",
  lineHeight: "28px",
  fontWeight: 600,
};

const Rules = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "24px",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    borderRadius: "var(--z-box-radius)",
    [PHONE]: { padding: "16px" },
    "& h2": sectionTitle,
    "& ul": {
      margin: 0,
      paddingInlineStart: "20px",
      listStyle: "disc",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      fontSize: "15px",
      lineHeight: "24px",
      // Arabic marks above and below the letters need room (WebKit)
      "&:lang(ar)": { lineHeight: "28px" },
    },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
      "&:lang(ar)": { lineHeight: "24px" },
    },
  },
});

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    "& > h2": sectionTitle,
  },
});

const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
});

const Entry = styled("article", {
  base: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    gap: "16px",
    alignItems: "start",
    padding: "20px 24px",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    borderRadius: "var(--z-box-radius)",
    [PHONE]: { padding: "16px", gap: "12px" },
  },
});

const Art = styled("div", {
  base: {
    width: "48px",
    height: "48px",
    display: "grid",
    placeItems: "center",
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },
});

const NameLine = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px 12px",
    "& h3": {
      margin: 0,
      fontSize: "18px",
      lineHeight: "24px",
      fontWeight: 600,
    },
  },
});

const How = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "24px",
    paddingInline: "8px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    borderRadius: "var(--z-radius-pill)",
    color: "var(--z-fg-secondary)",
    background: "var(--z-bg-raised)",
    border: "var(--z-box-border)",
  },
});

const Meaning = styled("p", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "24px",
    "&:lang(ar)": { lineHeight: "28px" },
  },
});

const Criteria = styled("ul", {
  base: {
    margin: 0,
    paddingInlineStart: "20px",
    listStyle: "disc",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
    "&:lang(ar)": { lineHeight: "26px" },
  },
});

const Foot = styled("footer", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& p": {
      margin: 0,
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
  },
});
