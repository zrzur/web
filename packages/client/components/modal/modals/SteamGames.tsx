import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { cx } from "styled-system/css";
import { styled } from "styled-system/jsx";

import {
  Button,
  Dialog,
  DialogProps,
  FloatingSelect,
  MenuItem,
} from "@revolt/ui";
import { SteamTile } from "@revolt/ui/components/features/profiles/SteamTile";
import { cutLine } from "@revolt/ui/components/features/profiles/cutLine";
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
      size="xl"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Games from Steam</Trans>}
    >
      <Body>
        <Head>
          <SteamTile name={props.games.display_name} size={48} round />
          <HeadText>
            <Name class={cutLine()} dir="auto">
              {props.games.display_name}
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
              <Button
                variant="outlined"
                size="sm"
                onPress={() => openLink(url())}
              >
                <Trans>View on Steam</Trans>
              </Button>
            )}
          </Show>
        </Head>

        <Show when={props.games.games.length}>
          <Group>
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
                        <CardName class={cutLine()} dir="auto" lang="en">
                          {item.name}
                        </CardName>
                        <Show when={item.achievements_total}>
                          <Bar aria-hidden="true">
                            <i
                              style={{
                                width: `${Math.min(100, Math.round(((item.achievements_unlocked ?? 0) / (item.achievements_total ?? 1)) * 100))}%`,
                              }}
                            />
                          </Bar>
                        </Show>
                        <Facts2>
                          <span>
                            <Show when={item.achievements_total}>
                              {t`${number(item.achievements_unlocked ?? 0)} of ${number(item.achievements_total ?? 0)} achievements`}
                            </Show>
                          </span>
                          <span>{t`${number(item.hours)} h`}</span>
                        </Facts2>
                      </CardText>
                    </Card>
                  </li>
                )}
              </For>
            </Grid>
          </Group>
        </Show>

        <Show when={props.games.achievements.length}>
          <Group>
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
                        <MenuItem value={String(item.appid)}>
                          {item.name}
                        </MenuItem>
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
                    <RowText>
                      <CardName class={cutLine()} dir="auto" lang="en">
                        {achievement.name}
                      </CardName>
                      <Show when={achievement.description}>
                        <Line class={cx(cutLine())} dir="auto" lang="en">
                          {achievement.description}
                        </Line>
                      </Show>
                      <Small>
                        <bdi lang="en">{achievement.game}</bdi>
                        {" · "}
                        {formatDay(achievement.unlocked_on, i18n().locale)}
                      </Small>
                    </RowText>
                  </li>
                )}
              </For>
            </Achievements>
          </Group>
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
    gap: "24px",
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
    maxWidth: "100%",
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const Facts = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

/** A heading 12 px above what it names; groups sit 24 px apart */
const Group = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
});

const HeadingRow = styled("div", {
  base: {
    display: "flex",
    // the filter has a label above it: the heading sits on the field's line
    alignItems: "flex-end",
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
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 192px), 1fr))",
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
    border: "1px solid var(--z-float-divider, var(--z-border-subtle))",
    background: "var(--z-dialog-card, var(--z-bg-raised))",
    transition: "background-color 0.12s ease",

    "&:hover": { background: "var(--z-float-hover, var(--z-nav-hover))" },
    "&:active": { background: "var(--z-float-hover, var(--z-nav-selected))" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/** How far through a game's achievements the person is */
const Bar = styled("span", {
  base: {
    display: "block",
    height: "4px",
    marginBlock: "4px",
    borderRadius: "var(--z-radius-pill)",
    background: "var(--z-float-divider, var(--z-border-subtle))",
    overflow: "hidden",
    "& i": {
      display: "block",
      height: "100%",
      borderRadius: "inherit",
      background: "var(--z-live)",
    },
  },
});

/** Achievements at the start, hours at the end, on one line */
const Facts2 = styled("span", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
    fontVariantNumeric: "tabular-nums",
    "& > :last-child": { flexShrink: 0 },
  },
});

const RowText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
    "& > *": { maxWidth: "100%" },
  },
});

const CardText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: "12px",
    gap: "4px",
  },
});

const CardName = styled("span", {
  base: {
    display: "block",
    fontSize: "15px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const Line = styled("span", {
  base: {
    display: "block",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
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
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
    gap: "8px",

    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      minWidth: 0,
      padding: "12px",
      borderRadius: "var(--z-radius-md)",
      border: "1px solid var(--z-float-divider, var(--z-border-subtle))",
      background: "var(--z-dialog-card, var(--z-bg-raised))",
    },
  },
});

const Footer = styled("p", {
  base: {
    margin: 0,
    paddingBlockStart: "16px",
    borderBlockStart:
      "1px solid var(--z-float-divider, var(--z-border-subtle))",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-secondary)",
  },
});
