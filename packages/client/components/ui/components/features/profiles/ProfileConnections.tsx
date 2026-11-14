import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";

import { ProfileSection, chip } from "./ProfileCard";
import {
  type ProfileConnection,
  type LinkedRepo,
  serviceUrl,
} from "./linkedServices";

/** Repositories on the card; the full profile shows all the person picked */
const CARD_REPOS = 3;

/** The service's name: a proper name, the same in every language */
const NAMES: Record<string, string> = {
  twitch: "Twitch",
  github: "GitHub",
  battlenet: "Battle.net",
};

/**
 * Linked Twitch, GitHub and Battle.net accounts. Everything comes from
 * Zrzur's own copy; the viewer's browser never contacts the services. Links
 * open only that service's own pages, through the link warning.
 */
export function ProfileConnectionsSection(props: {
  connections: ProfileConnection[];
  full?: boolean;
}) {
  return (
    <Show when={props.connections.length}>
      <ProfileSection title={<Trans>Connections</Trans>}>
        <Rows>
          <For each={props.connections}>
            {(connection) => (
              <ConnectionRow connection={connection} full={props.full} />
            )}
          </For>
        </Rows>
      </ProfileSection>
    </Show>
  );
}

function ConnectionRow(props: { connection: ProfileConnection; full?: boolean }) {
  const { t, i18n } = useLingui();
  const { openModal } = useModals();
  const [copied, setCopied] = createSignal(false);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  const link = createMemo(() =>
    serviceUrl(props.connection.service, props.connection.profile_url),
  );
  const repos = createMemo(() =>
    (props.connection.repos ?? []).slice(
      0,
      props.full ? undefined : CARD_REPOS,
    ),
  );

  const open = (url: URL) =>
    openModal({ type: "link_warning", url, display: url.toString() });

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.connection.display_name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li>
      <Service>{NAMES[props.connection.service] ?? props.connection.service}</Service>
      <Main>
        <Head>
          <Show
            when={link()}
            fallback={
              <Name dir="ltr">
                <bdi>{props.connection.display_name}</bdi>
              </Name>
            }
          >
            {(url) => (
              <button
                class={chip({ press: true })}
                type="button"
                title={url().toString()}
                onClick={() => open(url())}
              >
                <Name>
                  <bdi>{props.connection.display_name}</bdi>
                </Name>
              </button>
            )}
          </Show>
          <Show when={props.connection.service === "battlenet"}>
            <button
              class={chip({ press: true })}
              type="button"
              aria-label={t`Copy BattleTag`}
              onClick={copy}
            >
              <span aria-live="polite">
                <Show when={copied()} fallback={<Trans>Copy</Trans>}>
                  <Trans>Copied</Trans>
                </Show>
              </span>
            </button>
          </Show>
          <Show when={props.connection.live}>
            <Live>
              <Trans>Live now</Trans>
            </Live>
          </Show>
        </Head>
        <Show when={props.connection.live && props.connection.live_title}>
          <Facts>
            <bdi>{props.connection.live_title}</bdi>
          </Facts>
        </Show>
        <Show when={repos().length}>
          <Repos>
            <For each={repos()}>
              {(repo) => <RepoRow repo={repo} number={number} open={open} />}
            </For>
          </Repos>
        </Show>
      </Main>
    </li>
  );
}

function RepoRow(props: {
  repo: LinkedRepo;
  number: (value: number) => string;
  open: (url: URL) => void;
}) {
  const { t } = useLingui();
  const url = createMemo(() => serviceUrl("github", props.repo.url));
  return (
    <li>
      <Show
        when={url()}
        fallback={<RepoName dir="ltr">{props.repo.name}</RepoName>}
      >
        {(target) => (
          <RepoLink
            type="button"
            dir="ltr"
            title={target().toString()}
            onClick={() => props.open(target())}
          >
            {props.repo.name}
          </RepoLink>
        )}
      </Show>
      <Show when={props.repo.description}>
        <Facts>
          <bdi>{props.repo.description}</bdi>
        </Facts>
      </Show>
      <Facts>
        <Show when={props.repo.language}>
          <bdi>{props.repo.language}</bdi>
          {" · "}
        </Show>
        {t`${props.number(props.repo.stars)} stars`}
      </Facts>
    </li>
  );
}

const Rows = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",

    "& > li": {
      display: "flex",
      gap: "12px",
      padding: "12px",
      borderRadius: "var(--z-radius-sm, 6px)",
      background: "var(--profile-chip, var(--z-bg-input))",
      minWidth: 0,
    },
    "@container (max-width: 420px)": {
      "& > li": { flexDirection: "column", gap: "4px" },
    },
  },
});

const Service = styled("span", {
  base: {
    flex: "0 0 76px",
    fontSize: "12px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const Main = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    flex: 1,
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
    maxWidth: "220px",
  },
});

const Live = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    paddingInline: "8px",
    borderRadius: "var(--z-radius-pill)",
    border: "1px solid currentColor",
    color: "var(--z-live)",
    fontSize: "12px",
    lineHeight: "18px",
    fontWeight: 500,

    "&::before": {
      content: "''",
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "currentColor",
    },
  },
});

const Facts = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    overflowWrap: "anywhere",
  },
});

const Repos = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",

    "& > li": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: 0,
      paddingTop: "8px",
      borderTop: "1px solid var(--profile-line, var(--z-border-subtle))",
    },
  },
});

const RepoName = styled("span", {
  base: {
    fontFamily: "var(--fonts-monospace)",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
    textAlign: "start",
  },
});

const RepoLink = styled("button", {
  base: {
    all: "unset",
    cursor: "pointer",
    fontFamily: "var(--fonts-monospace)",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-link, var(--z-accent))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: "24px",

    "&:focus-visible": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
      borderRadius: "var(--z-radius-xs)",
    },
  },
});
