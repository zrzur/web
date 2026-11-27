import { For, Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import type { API } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { Avatar } from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { Icon } from "@revolt/ui/icons/Icon";

import { usePermissionNames } from "../../../../src/interface/OAuth";

import { ListingAbout } from "./About";
import { BotInvite, discoverApi } from "./api";
import { ListingArt } from "./Art";
import { Listing, MarkPill, listingMark, useFileUrl } from "./Cards";
import { useDiscoverLabels } from "./categories";
import { listedCommands } from "./find";
import {
  Aside,
  BannerArea,
  Columns,
  Facts,
  IconFrame,
  Identity,
  Main,
  Muted,
  Page,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
  SidePart,
  SkeletonLine,
  Tags,
} from "./ServerPage";

/** Permissions that let a bot change the server or remove people */
const SENSITIVE = [2 ** 1, 2 ** 2, 2 ** 3, 2 ** 6, 2 ** 7, 2 ** 37];

/** Only ordinary web addresses become links */
const safeLink = (url?: string) =>
  url && /^https?:\/\//i.test(url) ? url : undefined;

/**
 * A listed bot's own page, in place of the lists, laid out like a server's:
 * what it does and the commands it has on the left; one frame on the side
 * with the way in, the facts, what it may do on a server, and Report.
 * Everything shown comes from the listing and the bot's public invite; a
 * part with nothing true to say is left out.
 */
export function BotPage(props: {
  /** undefined while a direct link is still loading */
  listing?: Listing;
  /** the public site (no chat around it, no tab bar on phones) */
  site: boolean;
  /** a Discover link with these filters (tags, category) */
  href: (filters: { tag?: string; category?: string }) => string;
  /** adding or opening the conversation is under way */
  busy?: boolean;
  onAdd: () => void;
  /** a conversation with the bot, when bots can be written to */
  onMessage?: () => void;
  onReport: () => void;
  /** opened by keyboard from a card, which is gone now: the heading takes over */
  takeFocus?: boolean;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const fileUrl = useFileUrl();
  const labels = useDiscoverLabels();
  const permissionNames = usePermissionNames();
  /** Big numbers, in the digits the rest of the app uses */
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale || "en", {
      numberingSystem: "latn",
    }).format(value);

  // a plain signal: a resource would suspend the lists behind the page
  const [invite, setInvite] = createSignal<BotInvite>();
  // undefined until read, or when this server cannot list them
  const [registered, setRegistered] = createSignal<API.ApplicationCommand[]>();
  // not props: the answer can land after the page has closed
  let wanted: string | undefined;
  onCleanup(() => (wanted = undefined));
  createEffect(
    on(
      () => props.listing?.id,
      (id) => {
        wanted = id;
        setInvite(undefined);
        setRegistered(undefined);
        if (!id) return;
        discoverApi
          .botInvite(client(), id)
          .then((answer) => wanted === id && setInvite(answer))
          .catch(() => undefined);
        discoverApi
          .botCommands(client(), id)
          .then((answer) => wanted === id && setRegistered(answer))
          .catch(() => undefined);
      },
    ),
  );

  // the tab title names the page while it is open
  const previousTitle = document.title;
  onCleanup(() => (document.title = previousTitle));
  createEffect(() => {
    const item = props.listing;
    if (item) document.title = t`${item.name} — Zrzur Discover`;
  });

  let heading: HTMLHeadingElement | undefined;
  createEffect(
    on(
      () => !!props.listing,
      (loaded) => {
        if (!loaded || !props.takeFocus) return;
        requestAnimationFrame(() => {
          if (document.activeElement === document.body) heading?.focus();
        });
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

  const commands = () =>
    listedCommands(registered(), props.listing?.description, i18n().locale);
  const privacy = () => safeLink(invite()?.privacy_policy_url);
  const terms = () => safeLink(invite()?.terms_of_service_url);

  return (
    <Page data-page data-app={!props.site}>
      <Show
        when={props.listing}
        fallback={
          <>
            <BannerArea data-loading />
            <Columns>
              <Main>
                <SkeletonLine data-size="title" />
                <SkeletonLine />
                <SkeletonLine />
              </Main>
            </Columns>
          </>
        }
      >
        {(item) => (
          <>
            <BannerArea>
              {/* its own banner, or its portrait in birds */}
              <ListingArt
                kind="bots"
                id={item().id}
                category={item().category}
                count={item().count}
                online={item().online}
                banner={fileUrl(item().banner)}
                eager
              />
            </BannerArea>

            <Columns>
              <Main data-main>
                <Identity>
                  <IconFrame data-round="true">
                    <Avatar
                      size={104}
                      src={fileUrl(item().icon)}
                      fallback={item().name}
                      shape="circle"
                    />
                  </IconFrame>
                  <h1 ref={heading} tabIndex={-1}>
                    <bdi>{item().name}</bdi>
                    <BotLabel
                      verified={item().verified}
                      official={item().official}
                    />
                  </h1>
                </Identity>

                <Show when={listingMark(item())}>
                  <MarkPill listing={item()} />
                </Show>

                <section>
                  <h2>
                    <Trans>About this bot</Trans>
                  </h2>
                  <Show
                    when={item().description?.trim()}
                    fallback={
                      <Muted>
                        <Trans>No description yet.</Trans>
                      </Muted>
                    }
                  >
                    <ListingAbout text={item().description!} />
                  </Show>
                </section>

                <Show when={commands().items.length}>
                  <section data-similar>
                    <h2>
                      <Trans>Commands</Trans>
                    </h2>
                    <Show
                      when={commands().source === "registered"}
                      fallback={
                        <>
                          <Commands>
                            <For each={commands().items}>
                              {(command) => (
                                <code dir="auto">/{command.name}</code>
                              )}
                            </For>
                          </Commands>
                          <Note>
                            <Trans>Named in the bot's description.</Trans>
                          </Note>
                        </>
                      }
                    >
                      <CommandList data-testid="bot-commands">
                        <For
                          each={
                            commands().items as {
                              name: string;
                              description: string;
                            }[]
                          }
                        >
                          {(command) => (
                            <li>
                              <code dir="auto">/{command.name}</code>
                              <span dir="auto">{command.description}</span>
                            </li>
                          )}
                        </For>
                      </CommandList>
                    </Show>
                  </section>
                </Show>
              </Main>

              {/* one frame: the way in, the facts, permissions, report */}
              <Aside>
                <SidePart data-action>
                  <PrimaryButton
                    type="button"
                    data-join
                    data-busy={props.busy}
                    disabled={props.busy}
                    onClick={props.onAdd}
                  >
                    <span>
                      <Trans>Add to server</Trans>
                    </span>
                  </PrimaryButton>
                  <Show when={props.onMessage}>
                    <SecondaryButton
                      type="button"
                      data-testid="discover-message-bot"
                      disabled={props.busy}
                      onClick={() => props.onMessage?.()}
                    >
                      <Icon name="chat-circle" size={16} />
                      <Trans>Message</Trans>
                    </SecondaryButton>
                  </Show>
                </SidePart>

                <SidePart data-facts>
                  <h2>
                    <Trans>Bot details</Trans>
                  </h2>
                  <Facts>
                    <div>
                      <dt>
                        <Trans>Servers</Trans>
                      </dt>
                      <dd>{number(item().count)}</dd>
                    </div>
                    <Show when={item().category}>
                      <div>
                        <dt>
                          <Trans>Category</Trans>
                        </dt>
                        <dd>
                          <a href={props.href({ category: item().category })}>
                            {labels.category(item().category)}
                          </a>
                        </dd>
                      </div>
                    </Show>
                    <Show when={item().language}>
                      <div>
                        <dt>
                          <Trans>Language</Trans>
                        </dt>
                        <dd>{labels.language(item().language)}</dd>
                      </div>
                    </Show>
                  </Facts>
                  <Show when={item().tags.length}>
                    <Tags data-tags aria-label={t`Tags`}>
                      <For each={item().tags}>
                        {(tag) => (
                          <a dir="auto" href={props.href({ tag })}>
                            <b aria-hidden="true">#</b>
                            {tag}
                          </a>
                        )}
                      </For>
                    </Tags>
                  </Show>
                </SidePart>

                <Show when={invite()}>
                  <SidePart data-gets>
                    <h2>
                      <Trans>Permissions</Trans>
                    </h2>
                    <Show
                      when={groups().length}
                      fallback={
                        <Note>
                          <Trans>None</Trans>
                        </Note>
                      }
                    >
                      <For each={groups()}>
                        {(group) => (
                          <PermissionGroup>
                            <h3>{group.title}</h3>
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
                        <Note>
                          <Trans>
                            Lets the bot change the server or remove people.
                          </Trans>
                        </Note>
                      </Show>
                    </Show>
                    <Show when={privacy() || terms()}>
                      <Links>
                        <Show when={privacy()}>
                          <a
                            href={privacy()}
                            target="_blank"
                            rel="noopener nofollow ugc"
                          >
                            <Trans>Privacy policy</Trans>
                            <Icon name="arrow-square-out" size={16} />
                          </a>
                        </Show>
                        <Show when={terms()}>
                          <a
                            href={terms()}
                            target="_blank"
                            rel="noopener nofollow ugc"
                          >
                            <Trans>Terms of Service</Trans>
                            <Icon name="arrow-square-out" size={16} />
                          </a>
                        </Show>
                      </Links>
                    </Show>
                  </SidePart>
                </Show>

                <SidePart>
                  <QuietButton
                    type="button"
                    data-report
                    onClick={props.onReport}
                  >
                    <Icon name="flag" size={16} />
                    <Trans>Report bot</Trans>
                  </QuietButton>
                </SidePart>
              </Aside>
            </Columns>
          </>
        )}
      </Show>
    </Page>
  );
}

/** A quiet line under a part */
const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

/** Registered commands: the name, then what it does */
const CommandList = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "baseline",
      flexWrap: "wrap",
      gap: "4px 12px",
      minWidth: 0,
    },
    "& code": {
      fontFamily:
        "var(--fonts-mono, 'IBM Plex Mono'), 'IBM Plex Sans Arabic', monospace",
      fontSize: "14px",
      color: "var(--dz-mark)",
      unicodeBidi: "isolate",
    },
    "& span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
      minWidth: 0,
      overflowWrap: "anywhere",
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

const PermissionGroup = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& h3": {
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
