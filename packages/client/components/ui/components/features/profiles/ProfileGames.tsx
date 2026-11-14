import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css, cx } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";

import { chip, panel } from "./ProfileCard";
import { SteamTile } from "./SteamTile";
import { cutLine } from "./cutLine";
import { type ProfileGames, steamProfileUrl } from "./linkedGames";
import { achievementsShown, useProfileSize } from "./profileSize";

/** Games shown before "Show all" */
const FIRST_GAMES = 3;

/**
 * Games from the person's linked Steam account, as one panel: who, how many
 * games and hours, View, the most played games with their pictures and
 * hours, and two rows of the latest achievements. Everything comes from
 * Zrzur's own copy, and pictures load through Zrzur's media proxy; the
 * viewer's browser never contacts Steam. A private account shows one plain
 * line, without its name or link.
 */
export function ProfileGamesPanel(props: { games: ProfileGames }) {
  const { t, i18n } = useLingui();
  const { openModal } = useModals();
  const size = useProfileSize();
  const [open, setOpen] = createSignal(false);
  // the latest achievements stay folded until asked for
  const [more, setMore] = createSignal(false);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  const list = createMemo(() => props.games.games ?? []);
  const shown = createMemo(() =>
    open() ? list() : list().slice(0, FIRST_GAMES),
  );
  const strip = createMemo(() =>
    (props.games.achievements ?? []).slice(0, achievementsShown(size())),
  );
  const link = createMemo(() => steamProfileUrl(props.games.profile_url));

  const openLink = (url: URL) =>
    openModal({ type: "link_warning", url, display: url.toString() });

  return (
    <div class={panel()} data-testid="profile-games">
      <Show
        when={!props.games.private}
        fallback={
          <Plain>
            <Trans>This Steam account is private.</Trans>
          </Plain>
        }
      >
        <Head>
          <SteamTile name={props.games.display_name} size={36} round />
          <HeadText>
            <Show
              when={link()}
              fallback={
                <Name class={cutLine()} dir="auto">
                  {props.games.display_name}
                </Name>
              }
            >
              {(url) => (
                <NameLink
                  class={cutLine()}
                  type="button"
                  dir="auto"
                  title={t`Open Steam profile`}
                  onClick={() => openLink(url())}
                >
                  {props.games.display_name}
                </NameLink>
              )}
            </Show>
            <Facts>
              <Show when={props.games.game_count !== undefined}>
                {t`${number(props.games.game_count ?? 0)} games`}
                {" · "}
                {t`${number(props.games.total_hours ?? 0)} h`}
                {" · "}
              </Show>
              <Trans>From Steam</Trans>
            </Facts>
          </HeadText>
          <button
            class={cx(chip({ press: true }), keep)}
            type="button"
            onClick={() =>
              openModal({ type: "steam_games", games: props.games })
            }
          >
            <span>
              <Trans>View</Trans>
            </span>
          </button>
        </Head>

        <Show
          when={shown().length}
          fallback={
            <Show when={!strip().length}>
              <Plain>
                <Trans>No games to show.</Trans>
              </Plain>
            </Show>
          }
        >
          <List>
            <For each={shown()}>
              {(game) => (
                <li>
                  <SteamTile url={game.icon_url} name={game.name} size={24} />
                  <span class={cx(cutLine(), gameName)} dir="auto" lang="en">
                    {game.name}
                  </span>
                  <Hours>{t`${number(game.hours)} h`}</Hours>
                </li>
              )}
            </For>
          </List>
        </Show>
        <Show when={list().length > FIRST_GAMES || strip().length}>
          <Toggles>
            <Show when={list().length > FIRST_GAMES}>
              <More
                type="button"
                data-games-all
                aria-expanded={open()}
                onClick={() => setOpen(!open())}
              >
                <Show
                  when={open()}
                  fallback={<Trans>Show all {list().length}</Trans>}
                >
                  <Trans>Show less</Trans>
                </Show>
              </More>
            </Show>
            <Show when={strip().length}>
              <More
                type="button"
                data-games-more
                aria-expanded={more()}
                onClick={() => setMore(!more())}
              >
                <Show when={more()} fallback={<Trans>Show more</Trans>}>
                  <Trans>Show less</Trans>
                </Show>
              </More>
            </Show>
          </Toggles>
        </Show>

        <Show when={more() && strip().length}>
          <Sub>
            <SubTitle>
              <Trans>Latest achievements</Trans>
            </SubTitle>
            <Strip>
              <For each={strip()}>
                {(achievement) => (
                  <li title={`${achievement.name} · ${achievement.game}`}>
                    <SteamTile
                      url={achievement.icon_url}
                      name={achievement.name}
                      fill
                    />
                    <span class="sr" lang="en">
                      {achievement.name} · {achievement.game}
                    </span>
                  </li>
                )}
              </For>
            </Strip>
          </Sub>
        </Show>
        <Credit>
          <Trans>
            Steam is a trademark of Valve Corporation; Zrzur is not affiliated
            with Valve. Game pictures, achievement names and icons belong to
            their owners.
          </Trans>
        </Credit>
      </Show>
    </div>
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
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
  },
});

const Name = styled("strong", {
  base: {
    maxWidth: "100%",
    fontWeight: 600,
    fontSize: "15px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
  },
});

const NameLink = styled("button", {
  base: {
    maxWidth: "100%",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "15px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
    borderRadius: "var(--z-radius-xs, 4px)",
    // a 24 px target on the 20 px line (WCAG 2.5.8)
    minHeight: "24px",
    marginBlock: "-2px",

    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    // phones: a 44 px target that keeps the line where it was
    _phone: { minHeight: "44px", marginBlock: "-12px" },
  },
});

const Facts = styled("span", {
  base: {
    maxWidth: "100%",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    // a longer language takes a second line; nothing is cut
    overflowWrap: "anywhere",
  },
});

const List = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",

    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      minWidth: 0,
      minHeight: "24px",
    },
  },
});

/** View keeps its width; the name beside it gives way */
const keep = css({ flexShrink: 0 });

const gameName = css({
  flex: 1,
  fontSize: "13px",
  lineHeight: "20px",
  color: "var(--profile-ink, var(--z-fg-primary))",
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

/** Show all N and Show more, side by side under the games */
const Toggles = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 16px",
    minWidth: 0,
  },
});

const More = styled("button", {
  base: {
    alignSelf: "flex-start",
    minHeight: "24px",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--profile-ink, var(--z-fg-primary))",
    cursor: "pointer",
    borderRadius: "var(--z-radius-xs, 4px)",

    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px", marginBlock: "-10px" },
  },
});

/** Achievements, under a line of their own inside the panel */
const Sub = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingBlockStart: "var(--profile-gap, 12px)",
    borderBlockStart: "1px solid var(--profile-line, var(--z-border-subtle))",
  },
});

const SubTitle = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});

const Strip = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    // tiles of about 40 px: seven in a row on the card, eight on the full
    // profile, whatever the border and padding leave
    gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
    gap: "var(--profile-tile-gap, 4px)",

    "& li": { position: "relative", display: "flex", aspectRatio: "1" },
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

const Credit = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});
