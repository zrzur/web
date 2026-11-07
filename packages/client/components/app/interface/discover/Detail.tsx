import {
  For,
  JSX,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar } from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { Icon } from "@revolt/ui/icons/Icon";

import { usePermissionNames } from "../../../../src/interface/OAuth";

import { BotInvite, discoverApi } from "./api";
import { ListingArt } from "./Art";
import {
  CountLabel,
  Listing,
  MarkPill,
  Tag,
  listingMark,
  useFileUrl,
} from "./Cards";
import { categoryIcon, useDiscoverLabels } from "./categories";
import { commandsIn } from "./find";
import { paletteTokens } from "./palette";

/** Permissions that let a bot change the server or remove people */
const SENSITIVE = [2 ** 1, 2 ** 2, 2 ** 3, 2 ** 6, 2 ** 7, 2 ** 37];

/** Only ordinary web addresses become links */
const safeLink = (url?: string) =>
  url && /^https?:\/\//i.test(url) ? url : undefined;

/**
 * A listing's full page, over Discover (a sheet from the bottom on phones):
 * what it does, the commands it names, how it shows up in a chat and, in
 * plain words, what it may do on a server. Everything shown comes from the
 * listing and the bot's public invite; a section with nothing true to say is
 * left out.
 */
export function ListingDetail(props: {
  listing: Listing;
  onClose: () => void;
  onTag?: (tag: string) => void;
  /** The one way in: join / open / add */
  primary: JSX.Element;
  /** Quieter actions on the start side: report, copy link */
  secondary?: JSX.Element;
}) {
  const { t } = useLingui();
  const client = useClient();
  const fileUrl = useFileUrl();
  const labels = useDiscoverLabels();
  const permissionNames = usePermissionNames();
  let panel: HTMLDivElement | undefined;
  let previousFocus: HTMLElement | null = null;

  const isBot = () => props.listing.kind === "bots";

  // a plain signal: a resource would suspend the page behind the dialog
  const [invite, setInvite] = createSignal<BotInvite>();
  // not props: the answer can land after the dialog has closed
  let wanted: string | undefined;
  onCleanup(() => (wanted = undefined));
  createEffect(
    on(
      () => props.listing.id,
      (id) => {
        wanted = isBot() ? id : undefined;
        setInvite(undefined);
        if (!wanted) return;
        discoverApi
          .botInvite(client(), id)
          .then((answer) => wanted === id && setInvite(answer))
          .catch(() => undefined);
      },
    ),
  );

  const has = (bit: number) => {
    const permissions = invite()?.default_permissions;
    return permissions !== undefined && Math.floor(permissions / bit) % 2 === 1;
  };
  const permissionName = (bit: number) =>
    permissionNames.find(([entry]) => entry === bit)?.[1];
  const groups = () =>
    [
      {
        title: t`Server`,
        bits: [2 ** 1, 2 ** 0, 2 ** 2, 2 ** 3, 2 ** 24, 2 ** 20],
      },
      { title: t`Members`, bits: [2 ** 6, 2 ** 7, 2 ** 8, 2 ** 9, 2 ** 11] },
      {
        title: t`Messages`,
        bits: [2 ** 21, 2 ** 22, 2 ** 23, 2 ** 26, 2 ** 27, 2 ** 29, 2 ** 37],
      },
      { title: t`Voice`, bits: [2 ** 30, 2 ** 31] },
    ]
      .map((group) => ({ ...group, bits: group.bits.filter(has) }))
      .filter((group) => group.bits.length);

  const commands = () => commandsIn(props.listing.description);
  const moreToSay = () => (props.listing.description ?? "").includes("\n");
  /** What the bot's first message would read like: its own first line */
  const firstLine = () =>
    props.listing.description?.split(/\n/)[0]?.trim() || undefined;

  const onKey = (e: KeyboardEvent) => {
    // a dialog opened from this one (Report) owns the keys while it is open
    const dialogs = document.querySelectorAll(
      '[role="dialog"][aria-modal="true"]',
    );
    if (dialogs[dialogs.length - 1] !== panel) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
    }
    if (e.key !== "Tab" || !panel) return;
    const controls = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      e.preventDefault();
      panel.focus();
      return;
    }
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === panel)
    ) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey &&
      (document.activeElement === last || document.activeElement === panel)
    ) {
      e.preventDefault();
      first.focus();
    }
  };

  onMount(() => {
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.addEventListener("keydown", onKey);
    panel?.focus();
  });
  onCleanup(() => {
    document.removeEventListener("keydown", onKey);
    if (previousFocus?.isConnected) previousFocus.focus();
  });

  return (
    // in #floating with the app's dialogs, so one opened from here sits on top
    <Portal mount={document.getElementById("floating") ?? undefined}>
      {/* outside the page in the DOM: bring Discover's colours along */}
      <Scrim style={paletteTokens} onClick={props.onClose}>
        <Panel
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={props.listing.name}
          tabIndex={-1}
          // focus lands here on open; the panel itself needs no ring (the
          // app-wide focus outline would frame the whole dialog)
          style={{ outline: "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Close type="button" aria-label={t`Close`} onClick={props.onClose}>
            <Icon name="x" size={20} />
          </Close>

          <Scroll>
            <Hero>
              {/* its own banner, or its portrait in birds */}
              <ListingArt
                kind={props.listing.kind}
                id={props.listing.id}
                category={props.listing.category}
                count={props.listing.count}
                online={props.listing.online}
                banner={fileUrl(props.listing.banner)}
                eager
              />
            </Hero>
            <Head>
              <AvatarRing data-kind={props.listing.kind}>
                <Avatar
                  size={88}
                  src={fileUrl(props.listing.icon)}
                  fallback={props.listing.name}
                  shape={isBot() ? "circle" : "rounded-square"}
                />
              </AvatarRing>
              <Show when={listingMark(props.listing)}>
                <MarkPill listing={props.listing} />
              </Show>
            </Head>

            <Title>
              <h2>
                <bdi>{props.listing.name}</bdi>
              </h2>
              <Show when={props.listing.verified}>
                <Verified>
                  <BadgeMark
                    id={isBot() ? "bot_verified" : "server_verified"}
                    size="xs"
                  />
                  <Trans>Verified</Trans>
                </Verified>
              </Show>
            </Title>

            <Facts>
              <span>
                <Icon name={isBot() ? "robot" : "users"} size={16} />
                <CountLabel
                  kind={props.listing.kind}
                  count={props.listing.count}
                />
              </span>
              <Show when={props.listing.category}>
                <span>
                  <Icon
                    name={categoryIcon(
                      props.listing.kind,
                      props.listing.category,
                    )}
                    size={16}
                  />
                  {labels.category(props.listing.category)}
                </span>
              </Show>
              <Show when={props.listing.language}>
                <span>
                  <Icon name="globe" size={16} />
                  {labels.language(props.listing.language)}
                </span>
              </Show>
            </Facts>

            <Columns>
              <MainColumn>
                <Show when={isBot() && firstLine()}>
                  <Part>
                    <h3>
                      <Trans>In your chat</Trans>
                    </h3>
                    <ChatPreview aria-hidden="true">
                      <Avatar
                        size={40}
                        src={fileUrl(props.listing.icon)}
                        fallback={props.listing.name}
                        shape="circle"
                      />
                      <div>
                        <strong>
                          <bdi>{props.listing.name}</bdi>
                          <BotLabel />
                        </strong>
                        <p dir="auto">{firstLine()}</p>
                      </div>
                    </ChatPreview>
                  </Part>
                </Show>

                <Show when={commands().length}>
                  <Part>
                    <h3>
                      <Trans>Commands</Trans>
                    </h3>
                    <Commands>
                      <For each={commands()}>
                        {(command) => <code dir="auto">/{command}</code>}
                      </For>
                    </Commands>
                    <small>
                      <Trans>Named in the bot's description.</Trans>
                    </small>
                  </Part>
                </Show>

                <Show when={!isBot() || !firstLine() || moreToSay()}>
                  <Part>
                    <h3>
                      <Show
                        when={isBot()}
                        fallback={<Trans>About this server</Trans>}
                      >
                        <Trans>About this bot</Trans>
                      </Show>
                    </h3>
                    <p
                      dir={props.listing.description ? "auto" : undefined}
                      data-empty={!props.listing.description}
                    >
                      {props.listing.description || (
                        <Trans>No description yet.</Trans>
                      )}
                    </p>
                  </Part>
                </Show>

                <Show when={props.listing.tags.length}>
                  <Part>
                    <h3>
                      <Trans>Tags</Trans>
                    </h3>
                    <TagRow>
                      <For each={props.listing.tags}>
                        {(tag) => (
                          <Tag
                            dir="auto"
                            type="button"
                            disabled={!props.onTag}
                            onClick={() => props.onTag?.(tag)}
                          >
                            <b aria-hidden="true">#</b>

                            {tag}
                          </Tag>
                        )}
                      </For>
                    </TagRow>
                  </Part>
                </Show>
              </MainColumn>

              <Show when={invite()}>
                <SideColumn>
                  <Part>
                    <h3>
                      <Trans>On a server the bot gets:</Trans>
                    </h3>
                    <Show
                      when={groups().length}
                      fallback={
                        <p>
                          <Trans>
                            The bot will not be granted any permissions.
                          </Trans>
                        </p>
                      }
                    >
                      <For each={groups()}>
                        {(group) => (
                          <PermissionGroup>
                            <h4>{group.title}</h4>
                            <ul>
                              <For each={group.bits}>
                                {(bit) => (
                                  <li data-sensitive={SENSITIVE.includes(bit)}>
                                    <Icon
                                      name={
                                        SENSITIVE.includes(bit)
                                          ? "warning"
                                          : "check"
                                      }
                                      size={16}
                                    />
                                    {permissionName(bit)}
                                  </li>
                                )}
                              </For>
                            </ul>
                          </PermissionGroup>
                        )}
                      </For>
                      <Show when={SENSITIVE.some(has)}>
                        <small>
                          <Trans>
                            Lets the bot change the server or remove people.
                          </Trans>
                        </small>
                      </Show>
                    </Show>
                  </Part>

                  <Show
                    when={
                      safeLink(invite()?.privacy_policy_url) ||
                      safeLink(invite()?.terms_of_service_url)
                    }
                  >
                    <Links>
                      <Show when={safeLink(invite()?.privacy_policy_url)}>
                        <a
                          href={safeLink(invite()?.privacy_policy_url)}
                          target="_blank"
                          rel="noopener nofollow ugc"
                        >
                          <Trans>Privacy policy</Trans>
                          <Icon name="arrow-square-out" size={16} />
                        </a>
                      </Show>
                      <Show when={safeLink(invite()?.terms_of_service_url)}>
                        <a
                          href={safeLink(invite()?.terms_of_service_url)}
                          target="_blank"
                          rel="noopener nofollow ugc"
                        >
                          <Trans>Terms of Service</Trans>
                          <Icon name="arrow-square-out" size={16} />
                        </a>
                      </Show>
                    </Links>
                  </Show>
                </SideColumn>
              </Show>
            </Columns>
          </Scroll>

          <Actions>
            <Quiet>{props.secondary}</Quiet>
            <Main>{props.primary}</Main>
          </Actions>
        </Panel>
      </Scrim>
    </Portal>
  );
}

const Scrim = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "grid",
    placeItems: "center",
    padding: "24px",
    boxSizing: "border-box",
    overscrollBehavior: "contain",
    background: "var(--z-scrim)",

    // phones: a sheet that rises from the bottom edge
    "@media (max-width: 600px)": {
      placeItems: "end stretch",
      padding: "0",
    },
  },
});

const Panel = styled("div", {
  base: {
    width: "min(880px, 100%)",
    minWidth: 0,
    boxSizing: "border-box",
    maxHeight: "calc(100dvh - 48px)",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    borderRadius: "var(--z-shape-dialog)",
    border: "1px solid var(--dz-edge)",
    background: "var(--dz-page)",
    color: "var(--z-fg-primary)",
    boxShadow: "0 12px 32px rgb(0 0 0 / 0.45)",
    outline: "none",
    // focus moves here when it opens; the panel itself needs no ring
    animation: "authHintIn 0.18s ease",
    _motionReduce: { animation: "none" },
    "--ring": "var(--dz-page)",

    "@media (max-width: 600px)": {
      width: "100%",
      maxHeight: "94dvh",
      borderRadius: "var(--z-shape-sheet) var(--z-shape-sheet) 0 0",
      borderBottom: "none",
    },
  },
});

const Hero = styled("div", {
  base: {
    position: "relative",
    flexShrink: 0,
    height: "168px",
    background: "var(--dz-band)",
    _phone: { height: "136px" },
  },
});

const Close = styled("button", {
  base: {
    position: "absolute",
    zIndex: 2,
    top: "12px",
    insetInlineEnd: "12px",
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    border: "1px solid var(--dz-edge)",
    background: "var(--dz-glass)",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { color: "var(--z-fg-primary)" },
    "&:active": { background: "var(--z-nav-selected)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { width: "44px", height: "44px" },
  },
});

const Scroll = styled("div", {
  base: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
});

const Head = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
    paddingInline: "32px",
    marginTop: "-48px",
    _phone: { paddingInline: "16px", marginTop: "-40px" },
  },
});

const AvatarRing = styled("div", {
  base: {
    padding: "6px",
    borderRadius: "28px",
    background: "var(--ring)",
    lineHeight: 0,
    "&[data-kind='bots']": { borderRadius: "999px" },
  },
});

const Title = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "4px 12px",
    minWidth: 0,
    padding: "12px 32px 0",
    _phone: { paddingInline: "16px" },

    "& h2": {
      margin: 0,
      minWidth: 0,
      fontSize: "28px",
      fontWeight: 700,
      lineHeight: "36px",
      overflowWrap: "anywhere",
    },
  },
});

const Verified = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const Facts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 16px",
    padding: "8px 32px 0",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--dz-mark)",
    _phone: { paddingInline: "16px" },

    "& span": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    },
  },
});

/** What it does on the start side, what it may do on the end side */
const Columns = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "32px",
    padding: "24px 32px 32px",
    "@media (max-width: 760px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "24px",
    },
    _phone: { padding: "20px 16px 24px" },
  },
});

const MainColumn = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
  },
});

const SideColumn = styled("aside", {
  base: {
    width: "280px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
    padding: "16px",
    alignSelf: "start",
    boxSizing: "border-box",
    borderRadius: "var(--z-shape-card)",
    border: "1px solid var(--dz-edge)",
    background: "var(--z-card-bg)",
    "@media (max-width: 760px)": { width: "auto", alignSelf: "stretch" },
  },
});

const Part = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",

    "& h3": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
    "& > p": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
      whiteSpace: "pre-line",
      overflowWrap: "anywhere",
    },
    "& > p[data-empty='true']": { color: "var(--z-fg-muted)" },
    "& > small": {
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Commands = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    "& code": {
      display: "inline-flex",
      alignItems: "center",
      height: "32px",
      paddingInline: "12px",
      borderRadius: "var(--z-shape-chip)",
      border: "1px solid var(--dz-edge)",
      background: "var(--z-card-bg)",
      color: "var(--dz-mark)",
      fontFamily:
        "var(--fonts-mono, 'IBM Plex Mono'), 'IBM Plex Sans Arabic', monospace",
      fontSize: "14px",
    },
  },
});

/** A message as the bot would post it: its own name, picture and first line */
const ChatPreview = styled("div", {
  base: {
    display: "flex",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-shape-card)",
    border: "1px solid var(--dz-edge)",
    background: "var(--z-card-bg)",

    "& > div": { flex: 1, minWidth: 0 },
    "& strong": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
    },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-primary)",
      overflowWrap: "anywhere",
    },
  },
});

const PermissionGroup = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& h4": {
      margin: 0,
      fontSize: "12px",
      lineHeight: "16px",
      fontWeight: 600,
      color: "var(--z-fg-muted)",
    },
    "& ul": {
      margin: 0,
      padding: 0,
      listStyle: "none",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
      "--z-icon-color": "var(--z-live)",
    },
    "& li[data-sensitive='true']": {
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-warning)",
    },
  },
});

const Links = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    paddingTop: "12px",
    borderTop: "1px solid var(--z-border-subtle)",
    "& a": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      minHeight: "24px",
      fontSize: "14px",
      color: "var(--dz-mark)",
      textDecoration: "none",
      "--z-icon-color": "currentColor",
      _hover: { textDecoration: "underline" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      _phone: { minHeight: "44px" },
    },
  },
});

const TagRow = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const Actions = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "12px 32px",
    borderTop: "1px solid var(--dz-edge)",
    background: "var(--dz-page)",

    "@media (max-width: 600px)": {
      flexDirection: "column-reverse",
      alignItems: "stretch",
      padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
    },
  },
});

const Quiet = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
    "&:empty": { display: "none" },
    "@media (max-width: 600px)": {
      "& > *": { flex: 1 },
    },
  },
});

const Main = styled("div", {
  base: {
    display: "flex",
    marginInlineStart: "auto",
    "@media (max-width: 600px)": {
      marginInlineStart: 0,
      "& > *": { flex: 1 },
    },
  },
});
