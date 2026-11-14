import { For, Show, createMemo } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";

import { ProfileSection, chip } from "./ProfileCard";
import { type ProfileGames, steamProfileUrl } from "./linkedGames";

/** Games shown on the card; the full profile shows all that were copied */
const CARD_GAMES = 3;

/**
 * Games from the person's linked Steam account: name, how many games and
 * hours, and the most played ones with their achievements. Everything comes
 * from Zrzur's own copy; the viewer's browser never contacts Steam. A
 * private account shows one plain line, without its name or link.
 */
export function ProfileGamesSection(props: {
  games?: ProfileGames;
  full?: boolean;
}) {
  const { t, i18n } = useLingui();
  const { openModal } = useModals();
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  const shown = createMemo(() =>
    (props.games?.games ?? []).slice(0, props.full ? undefined : CARD_GAMES),
  );
  const link = createMemo(() =>
    props.games ? steamProfileUrl(props.games.profile_url) : undefined,
  );

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
              <Show
                when={link()}
                fallback={
                  <Name>
                    <bdi>{games().display_name}</bdi>
                  </Name>
                }
              >
                {(url) => (
                  <button
                    class={chip({ press: true })}
                    type="button"
                    title={url().toString()}
                    onClick={() =>
                      openModal({
                        type: "link_warning",
                        url: url(),
                        display: url().toString(),
                      })
                    }
                  >
                    <Name>
                      <bdi>{games().display_name}</bdi>
                    </Name>
                  </button>
                )}
              </Show>
              <Source>
                <Trans>From Steam</Trans>
              </Source>
            </Head>
            <Show when={games().game_count !== undefined}>
              <Totals>
                {t`${number(games().game_count ?? 0)} games`}
                {" · "}
                {t`${number(games().total_hours ?? 0)} hours played`}
              </Totals>
            </Show>
            <Show when={shown().length}>
              <List>
                <For each={shown()}>
                  {(game) => (
                    <li>
                      <GameName>
                        <bdi>{game.name}</bdi>
                      </GameName>
                      <GameFacts>
                        <span>{t`${number(game.hours)} h`}</span>
                        <Show when={game.achievements_total}>
                          <span>
                            {t`${number(game.achievements_unlocked ?? 0)} of ${number(game.achievements_total ?? 0)} achievements`}
                          </span>
                        </Show>
                      </GameFacts>
                    </li>
                  )}
                </For>
              </List>
            </Show>
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
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
  },
});

const Name = styled("strong", {
  base: {
    fontWeight: 600,
    color: "var(--profile-ink, var(--z-fg-primary))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "200px",
  },
});

const Source = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const Totals = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
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
      flexDirection: "column",
      gap: "2px",
      minWidth: 0,
    },
  },
});

const GameName = styled("span", {
  base: {
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const GameFacts = styled("span", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});
