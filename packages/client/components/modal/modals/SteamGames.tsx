import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Button, Dialog, DialogProps, FloatingSelect, MenuItem } from "@revolt/ui";
import { SteamTile } from "@revolt/ui/components/features/profiles/SteamTile";
import {
  formatDay,
  steamProfileUrl,
  steamStoreUrl,
} from "@revolt/ui/components/features/profiles/linkedGames";

import { useModals } from "..";
import { Modals } from "../types";

/** Filter value for every game */
const ALL = "all";

/**
 * Everything copied from a linked Steam account: the person, their most
 * played games with pictures, and their latest achievements with a game
 * filter. Pictures come through Zrzur's media proxy; every link to Steam
 * opens through the link warning.
 */
export function SteamGamesModal(
  props: DialogProps & Modals & { type: "steam_games" },
) {
  const { t, i18n } = useLingui();
  const { openModal } = useModals();
  const [game, setGame] = createSignal(ALL);

  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);
  const profile = () => steamProfileUrl(props.games.profile_url);
  const achievements = createMemo(() =>
    game() === ALL
      ? props.games.achievements
      : props.games.achievements.filter((a) => String(a.appid) === game()),
  );
  const withAchievements = createMemo(() =>
    props.games.games.filter((g) =>
      props.games.achievements.some((a) => a.appid === g.appid),
    ),
  );

  const openLink = (url: URL) =>
    openModal({ type: "link_warning", url, display: url.toString() });

  return (
    <Dialog
      size="lg"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Games from Steam</Trans>}
    >
      <Body>
        <Head>
          <SteamTile name={props.games.display_name} size={48} round />
          <HeadText>
            <Name>
              <bdi>{props.games.display_name}</bdi>
            </Name>
            <Facts>
              {t`${number(props.games.game_count ?? 0)} games`}
              {" · "}
              {t`${number(props.games.total_hours ?? 0)} hours played`}
              <Show when={props.games.achievements.length}>
                {" · "}
                {t`${number(props.games.achievements.length)} recent achievements`}
              </Show>
            </Facts>
          </HeadText>
          <Show when={profile()}>
            {(url) => (
              <Button variant="outlined" size="sm" onPress={() => openLink(url())}>
                <Trans>View on Steam</Trans>
              </Button>
            )}
          </Show>
        </Head>

        <Show when={props.games.games.length}>
          <Heading>
            <Trans>Most played</Trans>
          </Heading>
          <Grid>
            <For each={props.games.games}>
              {(item) => (
                <li>
                  <Card
                    type="button"
                    title={t`Open in the Steam store`}
                    onClick={() => {
                      const url = steamStoreUrl(item.store_url);
                      if (url) openLink(url);
                    }}
                  >
                    <SteamTile url={item.header_url} name={item.name} wide />
                    <CardText>
                      <CardName>
                        <bdi lang="en">{item.name}</bdi>
                      </CardName>
                      <Small>
                        {t`${number(item.hours)} h`}
                        <Show when={item.achievements_total}>
                          {" · "}
                          {t`${number(item.achievements_unlocked ?? 0)} of ${number(item.achievements_total ?? 0)} achievements`}
                        </Show>
                      </Small>
                    </CardText>
                  </Card>
                </li>
              )}
            </For>
          </Grid>
        </Show>

        <Show when={props.games.achievements.length}>
          <HeadingRow>
            <Heading>
              <Trans>Latest achievements</Trans>
            </Heading>
            <Show when={withAchievements().length > 1}>
              <Filter>
                <FloatingSelect
                  label={t`Game`}
                  value={game()}
                  onChange={(event) => setGame(event.currentTarget.value)}
                >
                  <MenuItem value={ALL}>{t`All games`}</MenuItem>
                  <For each={withAchievements()}>
                    {(item) => (
                      <MenuItem value={String(item.appid)}>{item.name}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </Filter>
            </Show>
          </HeadingRow>
          <Achievements>
            <For each={achievements()}>
              {(achievement) => (
                <li>
                  <SteamTile
                    url={achievement.icon_url}
                    name={achievement.name}
                    size={40}
                  />
                  <CardText>
                    <CardName>
                      <bdi lang="en">{achievement.name}</bdi>
                    </CardName>
                    <Show when={achievement.description}>
                      <Line>
                        <bdi lang="en">{achievement.description}</bdi>
                      </Line>
                    </Show>
                    <Small>
                      <bdi lang="en">{achievement.game}</bdi>
                      {" · "}
                      {formatDay(achievement.unlocked_on, i18n().locale)}
                    </Small>
                  </CardText>
                </li>
              )}
            </For>
          </Achievements>
        </Show>

        <Footer>
          <Trans>
            From Steam. Steam is a trademark of Valve Corporation; Zrzur is not
            affiliated with Valve. Game pictures, achievement names and icons
            belong to their owners.
          </Trans>
        </Footer>
      </Body>
    </Dialog>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
});

const HeadText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: "160px",
  },
});

const Name = styled("strong", {
  base: {
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Facts = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const HeadingRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
  },
});

const Heading = styled("h3", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "22px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const Filter = styled("div", {
  base: {
    width: "min(100%, 240px)",
  },
});

const Grid = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))",
    gap: "12px",
  },
});

const Card = styled("button", {
  base: {
    all: "unset",
    boxSizing: "border-box",
    width: "100%",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--z-radius-md)",
    background: "var(--z-bg-raised)",

    "&:hover": { background: "var(--z-hover)" },
    "&:focus-visible": { outline: "2px solid var(--z-focus)" },
  },
});

const CardText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: "8px 12px 12px",
    gap: "2px",
  },
});

const CardName = styled("span", {
  base: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Line = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Small = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
  },
});

const Achievements = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
    gap: "8px",

    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      minWidth: 0,
      paddingInlineStart: "12px",
      borderRadius: "var(--z-radius-md)",
      background: "var(--z-bg-raised)",
    },
  },
});

const Footer = styled("p", {
  base: {
    margin: 0,
    paddingBlockStart: "12px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
  },
});
