import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";

import { ProfileSection, chip } from "./ProfileCard";
import { SteamTile } from "./SteamTile";
import { type ProfileGames, steamProfileUrl } from "./linkedGames";

/** Games shown before "Show all" */
const FIRST_GAMES = 3;
/** Achievement icons in the strip */
const STRIP = 12;

/**
 * Games from the person's linked Steam account: name, how many games and
 * hours, the most played games and the latest achievements. Everything
 * comes from Zrzur's own copy, and pictures load through Zrzur's media
 * proxy; the viewer's browser never contacts Steam. A private account
 * shows one plain line, without its name or link.
 */
export function ProfileGamesSection(props: {
  games?: ProfileGames;
  full?: boolean;
}) {
  const { t, i18n } = useLingui();
  const { openModal } = useModals();
  const [open, setOpen] = createSignal(false);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  const list = createMemo(() => props.games?.games ?? []);
  const shown = createMemo(() =>
    open() ? list() : list().slice(0, FIRST_GAMES),
  );
  const strip = createMemo(() =>
    (props.games?.achievements ?? []).slice(0, STRIP),
  );
  const link = createMemo(() =>
    props.games ? steamProfileUrl(props.games.profile_url) : undefined,
  );

  const openLink = (url: URL) =>
    openModal({ type: "link_warning", url, display: url.toString() });

  return (
    <Show when={props.games}>
      {(games) => (
        <ProfileSection title={<Trans>Games</Trans>}>
          <Show
            when={!games().private}
            fallback={
              <Plain>
                <Trans>This Steam account is private.</Trans>
              </Plain>
            }
          >
            <Head>
              <SteamTile name={games().display_name} size={36} round />
              <HeadText>
                <Show
                  when={link()}
                  fallback={
                    <Name>
                      <bdi>{games().display_name}</bdi>
                    </Name>
                  }
                >
                  {(url) => (
                    <NameLink
                      type="button"
                      title={t`Open Steam profile`}
                      onClick={() => openLink(url())}
                    >
                      <bdi>{games().display_name}</bdi>
                    </NameLink>
                  )}
                </Show>
                <Facts>
                  <Show when={games().game_count !== undefined}>
                    {t`${number(games().game_count ?? 0)} games`}
                    {" · "}
                    {t`${number(games().total_hours ?? 0)} h`}
                    {" · "}
                  </Show>
                  <Trans>From Steam</Trans>
                </Facts>
              </HeadText>
              <button
                class={chip({ press: true })}
                type="button"
                onClick={() => openModal({ type: "steam_games", games: games() })}
              >
                <Trans>View</Trans>
              </button>
            </Head>

            <Show when={shown().length}>
              <List>
                <For each={shown()}>
                  {(game) => (
                    <li>
                      <SteamTile url={game.icon_url} name={game.name} size={28} />
                      <GameName>
                        <bdi lang="en">{game.name}</bdi>
                      </GameName>
                      <Hours>{t`${number(game.hours)} h`}</Hours>
                    </li>
                  )}
                </For>
              </List>
            </Show>
            <Show when={list().length > FIRST_GAMES}>
              <More type="button" onClick={() => setOpen(!open())}>
                <Show
                  when={open()}
                  fallback={<Trans>Show all {list().length}</Trans>}
                >
                  <Trans>Show less</Trans>
                </Show>
              </More>
            </Show>

            <Show when={strip().length}>
              <StripTitle>
                <Trans>Latest achievements</Trans>
              </StripTitle>
              <Strip>
                <For each={strip()}>
                  {(achievement) => (
                    <li title={`${achievement.name} · ${achievement.game}`}>
                      <SteamTile
                        url={achievement.icon_url}
                        name={achievement.name}
                        size={28}
                      />
                      <span class="sr" lang="en">
                        {achievement.name} · {achievement.game}
                      </span>
                    </li>
                  )}
                </For>
              </Strip>
            </Show>
            <Credit>
              <Trans>
                Steam is a trademark of Valve Corporation; Zrzur is not
                affiliated with Valve. Game pictures, achievement names and icons
                belong to their owners.
              </Trans>
            </Credit>
          </Show>
        </ProfileSection>
      )}
    </Show>
  );
}

const Plain = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
});

const HeadText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
  },
});

const Name = styled("strong", {
  base: {
    fontWeight: 600,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const NameLink = styled("button", {
  base: {
    all: "unset",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-link)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    borderRadius: "var(--z-radius-xs)",

    "&:hover": { textDecoration: "underline" },
    "&:focus-visible": { outline: "2px solid var(--z-focus)" },
  },
});

const Facts = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const List = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",

    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      minWidth: 0,
    },
  },
});

const GameName = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Hours = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    fontVariantNumeric: "tabular-nums",
  },
});

const More = styled("button", {
  base: {
    all: "unset",
    cursor: "pointer",
    alignSelf: "flex-start",
    minHeight: "24px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-link)",
    borderRadius: "var(--z-radius-xs)",

    "&:hover": { textDecoration: "underline" },
    "&:focus-visible": { outline: "2px solid var(--z-focus)" },
    "@media (pointer: coarse)": { minHeight: "44px" },
  },
});

const Credit = styled("p", {
  base: {
    margin: 0,
    fontSize: "11px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const StripTitle = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const Strip = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",

    "& li": { display: "flex" },
    "& .sr": {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
    },
  },
});
