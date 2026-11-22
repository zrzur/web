import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css, cx } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Icon } from "@revolt/ui/icons/Icon";

import { chip, panel } from "./ProfileCard";
import { panelParts } from "./ProfileGames";
import type { ProfileInterest } from "./ProfileInterests";
import { SteamTile } from "./SteamTile";
import { cutLine } from "./cutLine";
import {
  type ProfileConnection,
  serviceImage,
  serviceUrl,
  splitBattleTag,
} from "./linkedServices";
import { useProfileSize } from "./profileSize";

const {
  Head,
  HeadText,
  Name,
  NameLink,
  Facts,
  List,
  Hours,
  More,
  keep,
  rowName,
} = panelParts;

/** Repositories before "Show all" (the person picks at most 6) */
const FIRST_REPOS = 3;

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
 * One linked account, built like the Games panel: a header (picture, name
 * that opens the service, a facts line ending in its source, View), then
 * rows. Everything comes from Zrzur's own copy, pictures through Zrzur's
 * media proxy: the viewer's browser never contacts the service. Links open
 * only that service's own pages, through the link warning.
 */
export function ProfileConnectionPanel(props: {
  connection: ProfileConnection;
}) {
  return (
    <div class={panel()} data-testid={`profile-${props.connection.service}`}>
      <Switch>
        <Match when={props.connection.service === "twitch"}>
          <TwitchPanel connection={props.connection} />
        </Match>
        <Match when={props.connection.service === "github"}>
          <GithubPanel connection={props.connection} />
        </Match>
        <Match when={props.connection.service === "battlenet"}>
          <BattlenetPanel connection={props.connection} />
        </Match>
      </Switch>
    </div>
  );
}

/** Header shared by Twitch and GitHub: picture, name, facts, View */
function ServiceHead(props: {
  connection: ProfileConnection;
  name: string;
  facts: string;
}) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const link = createMemo(() =>
    serviceUrl(props.connection.service, props.connection.profile_url),
  );
  const open = (url: URL) =>
    openModal({ type: "link_warning", url, display: url.toString() });
  const service = () => NAMES[props.connection.service];

  return (
    <Head>
      <SteamTile
        name={props.name}
        size={36}
        round
        src={serviceImage(
          client(),
          props.connection.service,
          props.connection.avatar_url,
        )}
      />
      <HeadText>
        <Show
          when={link()}
          fallback={
            <Name class={cutLine()} dir="auto">
              {props.name}
            </Name>
          }
        >
          {(url) => (
            <NameLink
              class={cutLine()}
              type="button"
              dir="auto"
              title={t`Open on ${service()}`}
              onClick={() => open(url())}
            >
              {props.name}
            </NameLink>
          )}
        </Show>
        <Facts>{props.facts}</Facts>
      </HeadText>
      <Show when={link()}>
        {(url) => (
          <button
            class={cx(chip({ press: true }), keep)}
            type="button"
            aria-label={t`View on ${service()}`}
            onClick={() => open(url())}
          >
            <span>
              <Trans>View</Trans>
            </span>
          </button>
        )}
      </Show>
    </Head>
  );
}

function TwitchPanel(props: { connection: ProfileConnection }) {
  const { t } = useLingui();
  const facts = () => {
    const kind =
      props.connection.kind === "partner"
        ? t`Partner`
        : props.connection.kind === "affiliate"
          ? t`Affiliate`
          : undefined;
    return [kind, t`From Twitch`].filter(Boolean).join(" · ");
  };

  return (
    <>
      <ServiceHead
        connection={props.connection}
        name={props.connection.display_name}
        facts={facts()}
      />
      <Show when={props.connection.bio}>
        <Bio dir="auto">{props.connection.bio}</Bio>
      </Show>
      <Show
        when={props.connection.live}
        fallback={
          <Show when={props.connection.game}>
            <List>
              <li>
                <span class={cx(cutLine(), rowName)}>
                  <Trans>Last stream</Trans>
                </span>
                <Hours dir="auto">{props.connection.game}</Hours>
              </li>
            </List>
          </Show>
        }
      >
        <LiveBox>
          <span>
            <Live>
              <Trans>Live now</Trans>
            </Live>
          </span>
          <Show when={props.connection.live_title}>
            <span class={cx(cutLine(), rowName)} dir="auto">
              {props.connection.live_title}
            </span>
          </Show>
          <Show when={props.connection.game}>
            <Facts dir="auto">{props.connection.game}</Facts>
          </Show>
        </LiveBox>
      </Show>
    </>
  );
}

function GithubPanel(props: { connection: ProfileConnection }) {
  const { t, i18n } = useLingui();
  const { openModal } = useModals();
  const size = useProfileSize();
  const [open, setOpen] = createSignal(false);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  const list = () => props.connection.repos ?? [];
  const shown = createMemo(() =>
    open() || size() === "full" ? list() : list().slice(0, FIRST_REPOS),
  );
  const facts = () =>
    [
      props.connection.followers !== undefined
        ? t`${number(props.connection.followers)} followers`
        : undefined,
      props.connection.public_repos !== undefined
        ? t`${number(props.connection.public_repos)} repositories`
        : undefined,
      t`From GitHub`,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <ServiceHead
        connection={props.connection}
        name={props.connection.display_name}
        facts={facts()}
      />
      <Show when={props.connection.bio}>
        <Bio dir="auto">{props.connection.bio}</Bio>
      </Show>
      <Show when={shown().length}>
        <List>
          <For each={shown()}>
            {(repo) => {
              const url = serviceUrl("github", repo.url);
              return (
                <li title={repo.description}>
                  <RepoIcon aria-hidden="true">
                    <Icon name="code" size={14} />
                  </RepoIcon>
                  <Show
                    when={url}
                    fallback={
                      <span class={cx(cutLine(), rowName, mono)} dir="ltr">
                        {repo.name}
                      </span>
                    }
                  >
                    {(target) => (
                      <RepoLink
                        class={cx(cutLine(), rowName, mono)}
                        type="button"
                        dir="ltr"
                        onClick={() =>
                          openModal({
                            type: "link_warning",
                            url: target(),
                            display: target().toString(),
                          })
                        }
                      >
                        {repo.name}
                      </RepoLink>
                    )}
                  </Show>
                  <Hours>
                    <Show when={repo.language}>
                      <bdi>{repo.language}</bdi>
                      {" · "}
                    </Show>
                    {t`${number(repo.stars)} stars`}
                  </Hours>
                </li>
              );
            }}
          </For>
        </List>
      </Show>
      <Show when={size() !== "full" && list().length > FIRST_REPOS}>
        <More
          type="button"
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
    </>
  );
}

function BattlenetPanel(props: { connection: ProfileConnection }) {
  const { t } = useLingui();
  const [copied, setCopied] = createSignal(false);
  const tag = () => splitBattleTag(props.connection.display_name);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.connection.display_name);
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Head>
      <Badge aria-hidden="true">
        <Icon name="identification-badge" size={20} />
      </Badge>
      <HeadText>
        <Name class={cutLine()} dir="ltr">
          {tag().name}
          <TagNumber>{tag().number}</TagNumber>
        </Name>
        <Facts>{t`From Battle.net`}</Facts>
      </HeadText>
      <CopyWrap>
        <CopyButton
          class={keep}
          type="button"
          aria-label={copied() ? t`Copied` : t`Copy BattleTag`}
          title={copied() ? t`Copied` : t`Copy BattleTag`}
          onClick={copy}
        >
          <Icon name={copied() ? "check" : "copy"} size={16} />
        </CopyButton>
        <Show when={copied()}>
          <Tip role="status">
            <Trans>Copied</Trans>
          </Tip>
        </Show>
      </CopyWrap>
    </Head>
  );
}

const Bio = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    lineClamp: 2,
    overflowWrap: "anywhere",
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

const LiveBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    padding: "12px",
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
  },
});

const mono = css({ fontFamily: "var(--fonts-monospace)" });

const RepoIcon = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "24px",
    height: "24px",
    borderRadius: "var(--z-radius-sm)",
    background: "var(--profile-chip, var(--z-float-tile, var(--z-bg-raised)))",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const RepoLink = styled("button", {
  base: {
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    fontFamily: "var(--fonts-monospace)",
    textAlign: "start",
    cursor: "pointer",
    borderRadius: "var(--z-radius-xs, 4px)",
    minHeight: "24px",
    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Badge = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "36px",
    height: "36px",
    borderRadius: "var(--z-radius-sm)",
    background: "var(--profile-chip, var(--z-float-tile, var(--z-bg-raised)))",
    color: "var(--profile-ink, var(--z-fg-primary))",
  },
});

const TagNumber = styled("span", {
  base: {
    fontWeight: 500,
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const CopyWrap = styled("span", {
  base: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
  },
});

const CopyButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    padding: 0,
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
    background: "var(--profile-chip, var(--z-bg-input))",
    color: "var(--profile-ink, var(--z-fg-primary))",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--profile-chip-hover, var(--z-nav-hover))" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { width: "44px", height: "44px" },
  },
});

const Tip = styled("span", {
  base: {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    insetInlineEnd: 0,
    paddingBlock: "4px",
    paddingInline: "8px",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "var(--z-bg-floating)",
    color: "var(--z-fg-primary)",
    fontSize: "12px",
    lineHeight: "16px",
    whiteSpace: "nowrap",
    boxShadow: "0 12px 32px rgb(0 0 0 / .45)",
    pointerEvents: "none",
  },
});
