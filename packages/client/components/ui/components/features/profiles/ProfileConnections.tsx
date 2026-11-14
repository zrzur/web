import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";

import { chip, panel } from "./ProfileCard";
import type { ProfileInterest } from "./ProfileInterests";
import {
  type LinkedRepo,
  type ProfileConnection,
  serviceUrl,
} from "./linkedServices";
import { useProfileSize } from "./profileSize";

/** Repositories on the card; the full profile shows all the person picked */
const CARD_REPOS = 3;

/** The service's name: a proper name, the same in every language */
const NAMES: Record<string, string> = {
  twitch: "Twitch",
  github: "GitHub",
  battlenet: "Battle.net",
};

/**
 * Linked Twitch, GitHub and Battle.net accounts as Interests tabs, one per
 * service, after Games. The tab names the service; the panel never repeats it.
 */
export function connectionInterests(
  connections: ProfileConnection[],
): ProfileInterest[] {
  return connections.map((connection) => ({
    id: connection.service,
    label: NAMES[connection.service] ?? connection.service,
    panel: () => <ProfileConnectionPanel connection={connection} />,
  }));
}

/**
 * One linked account. Everything comes from Zrzur's own copy; the viewer's
 * browser never contacts the service. Links open only that service's own
 * pages, through the link warning.
 */
export function ProfileConnectionPanel(props: { connection: ProfileConnection }) {
  const { t, i18n } = useLingui();
  const { openModal } = useModals();
  const size = useProfileSize();
  const [copied, setCopied] = createSignal(false);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  const link = createMemo(() =>
    serviceUrl(props.connection.service, props.connection.profile_url),
  );
  const repos = createMemo(() =>
    (props.connection.repos ?? []).slice(
      0,
      size() === "full" ? undefined : CARD_REPOS,
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
    <div class={panel()} data-testid={`profile-${props.connection.service}`}>
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
      <Show when={props.connection.service === "battlenet"}>
        <Facts>
          <Trans>BattleTag from Battle.net</Trans>
        </Facts>
      </Show>
      <Show when={repos().length}>
        <Repos>
          <For each={repos()}>
            {(repo) => <RepoRow repo={repo} number={number} open={open} />}
          </For>
        </Repos>
      </Show>
    </div>
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

/** "Happening now": the live colour, outlined, never a filled action */
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
