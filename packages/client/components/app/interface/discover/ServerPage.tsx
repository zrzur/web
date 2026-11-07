import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient, useClientLifecycle } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useLocation, useNavigate } from "@revolt/routing";
import { Avatar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { discoverApi } from "./api";
import { ListingArt } from "./Art";
import { CountLabel, Listing, MarkPill, fromServer, useFileUrl } from "./Cards";
import { categoryIcon, useDiscoverLabels } from "./categories";
import { isPaidListing } from "./marks";
import { useOpenInApp } from "./OpenInApp";
import { WEBSITE_URL, appUrl, discoverUrl, publicReportUrl } from "./sites";

type JoinState = "idle" | "busy" | "requested" | "closed";

/**
 * A listed server's own page: discover.zrzur.com/<custom link or id> on
 * the public site, /discover/<link or id> in the app. Everything a visitor
 * needs to decide, and one way in. Joining keeps the server's access mode:
 * open servers let people in, "by request" records a request, locked ones
 * refuse.
 */
export function ServerPage(props: {
  slug: string;
  /** the public site (no chat around it) */
  site: boolean;
  /** "" on the site, "/discover" in the app */
  base: string;
  /** opened by keyboard from a card, which is gone now: the heading takes over */
  takeFocus?: boolean;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const { isLoggedIn } = useClientLifecycle();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal, showError } = useModals();
  const labels = useDiscoverLabels();
  const fileUrl = useFileUrl();
  const inApp = useOpenInApp();
  /** Big numbers, in the digits the rest of the app uses */
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale || "en", {
      numberingSystem: "latn",
    }).format(value);

  const [server, { refetch }] = createResource(
    () => props.slug,
    async (slug) => {
      try {
        return fromServer(await discoverApi.server(client(), slug));
      } catch (error) {
        // a server that left Discover (or never was on it) is not an error
        if (String(error).includes("NotFound")) return null;
        throw error;
      }
    },
  );

  const [similar] = createResource(
    () => (server()?.category ? server()! : undefined),
    async (current: Listing) =>
      (
        await discoverApi.servers(client(), {
          category: current.category,
          limit: 8,
        })
      )
        .map(fromServer)
        // a paid place could not say so inside these links: left out
        .filter((item) => item.id !== current.id && !isPaidListing(item))
        .slice(0, 3),
  );

  /** The address people share: the custom link when there is one */
  const pageSlug = (item: Listing) => item.link ?? item.id;
  const pageUrl = (item: Listing) =>
    props.site
      ? `${window.location.origin}/${pageSlug(item)}`
      : `${discoverUrl()}/${pageSlug(item)}`;

  // old or ID links move to the custom link, keeping ?join
  createEffect(() => {
    const item = server();
    if (item && props.slug !== pageSlug(item))
      navigate(`${props.base}/${pageSlug(item)}${location.search}`, {
        replace: true,
      });
  });

  // Title for the tab, and for people who share it
  // the tab title names the page while it is open
  const previousTitle = document.title;
  onCleanup(() => (document.title = previousTitle));
  createEffect(() => {
    const item = server();
    if (item) document.title = t`${item.name} — Zrzur Discover`;
  });

  const [join, setJoin] = createSignal<JoinState>("idle");
  const [copied, setCopied] = createSignal(false);
  const isMember = () => !!server() && client().servers.has(server()!.id);

  const openServer = (id: string) =>
    props.site
      ? window.location.assign(`${appUrl()}/server/${id}`)
      : navigate(`/server/${id}`);

  async function joinServer(item: Listing) {
    if (isMember()) return openServer(item.id);
    // the site has no chat: the app takes over and brings them back here
    if (props.site && !isLoggedIn())
      return inApp.open(`/discover/${pageSlug(item)}?join=1`, item.name);

    setJoin("busy");
    try {
      const result = (await client().api.post(`/invites/${item.id as ""}`)) as {
        type: string;
      };
      if (result?.type === "JoinRequest") return setJoin("requested");
      setJoin("idle");
      openServer(item.id);
    } catch (error) {
      const text = JSON.stringify(error);
      if (/Locked|InvitesPaused|NotFound|Banned|InvalidOperation/.test(text))
        setJoin("closed");
      else {
        setJoin("idle");
        showError(error);
      }
    }
  }

  // arriving from the public site with ?join=1: the Join button is ready
  let joinButton: HTMLButtonElement | undefined;
  onMount(() => {
    if (new URLSearchParams(location.search).get("join") === "1")
      queueMicrotask(() => joinButton?.focus());
  });

  let heading: HTMLHeadingElement | undefined;
  createEffect(
    on(
      () => !!server(),
      (loaded) => {
        if (!loaded || !props.takeFocus) return;
        requestAnimationFrame(() => {
          if (document.activeElement === document.body) heading?.focus();
        });
      },
    ),
  );

  const copyLink = (item: Listing) =>
    navigator.clipboard
      ?.writeText(pageUrl(item))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);

  const report = (item: Listing) =>
    isLoggedIn()
      ? openModal({
          type: "report_content",
          client: client(),
          target: { kind: "DiscoverServer", id: item.id, label: item.name },
        })
      : // no account: the public report form on the website (DSA Art. 16)
        window.location.assign(
          publicReportUrl("DiscoverServer", pageUrl(item), i18n().locale),
        );

  return (
    <Page data-page>
      <Switch>
        <Match when={server.loading && !server()}>
          <BannerArea data-loading />
          <Columns>
            <Main>
              <SkeletonLine data-size="title" />
              <SkeletonLine />
              <SkeletonLine />
            </Main>
          </Columns>
        </Match>

        <Match when={server.error}>
          <Message>
            <Icon name="warning-circle" size={32} />
            <strong>
              <Trans>This page couldn't be loaded right now.</Trans>
            </strong>
            <SecondaryButton type="button" onClick={() => refetch()}>
              <Trans>Try again</Trans>
            </SecondaryButton>
          </Message>
        </Match>

        <Match when={server() === null}>
          <Message>
            <Icon name="compass" size={32} />
            <strong>
              <Trans>This server isn't on Discover.</Trans>
            </strong>
            <span>
              <Trans>
                Its owner may have taken it off, or the link is mistyped.
              </Trans>
            </span>
            <SecondaryLink href={props.base || "/"}>
              <Trans>Browse Discover</Trans>
            </SecondaryLink>
          </Message>
        </Match>

        <Match when={server()}>
          {(item) => (
            <>
              <BannerArea>
                {/* its own banner, or its portrait in birds */}
                <ListingArt
                  kind="servers"
                  id={item().id}
                  category={item().category}
                  count={item().count}
                  online={item().online}
                  banner={fileUrl(item().banner)}
                  eager
                />
                <Crumbs aria-label={t`Breadcrumb`}>
                  <a href={props.base || "/"}>
                    <Trans>Discover</Trans>
                  </a>
                  <Show when={item().category}>
                    <Icon name="caret-right" size={14} data-mirror />
                    <a href={`${props.base}/${item().category}`}>
                      {labels.category(item().category)}
                    </a>
                  </Show>
                  <Icon name="caret-right" size={14} data-mirror />
                  <span aria-current="page" dir="auto">
                    {item().name}
                  </span>
                </Crumbs>
              </BannerArea>

              <Columns>
                <Main>
                  <Identity>
                    <IconFrame>
                      <Avatar
                        size={104}
                        src={fileUrl(item().icon)}
                        fallback={item().name}
                        shape="rounded-square"
                      />
                    </IconFrame>
                    <h1 ref={heading} tabIndex={-1}>
                      <bdi>{item().name}</bdi>
                    </h1>
                  </Identity>

                  <Show when={isPaidListing(item())}>
                    <MarkPill listing={item()} />
                  </Show>

                  {/* the numbers that say whether anyone is home */}
                  <Pulse>
                    <Show when={item().online != null}>
                      <div data-live>
                        <dt>
                          <span aria-hidden="true" />
                          <Trans>Online now</Trans>
                        </dt>
                        <dd>{number(item().online!)}</dd>
                      </div>
                    </Show>
                    <div>
                      <dt>
                        <Trans>Members</Trans>
                      </dt>
                      <dd>{number(item().count)}</dd>
                    </div>
                    <Show when={item().language}>
                      <div>
                        <dt>
                          <Trans>Language</Trans>
                        </dt>
                        <dd>{labels.language(item().language)}</dd>
                      </div>
                    </Show>
                    <Show when={item().category}>
                      <div>
                        <dt>
                          <Trans>Category</Trans>
                        </dt>
                        <dd>
                          <a href={`${props.base}/${item().category}`}>
                            <Icon
                              name={categoryIcon("servers", item().category)}
                              size={16}
                            />
                            {labels.category(item().category)}
                          </a>
                        </dd>
                      </div>
                    </Show>
                  </Pulse>

                  <section>
                    <h2>
                      <Trans>About this server</Trans>
                    </h2>
                    <Show
                      when={item().description}
                      fallback={
                        <Muted>
                          <Trans>No description yet.</Trans>
                        </Muted>
                      }
                    >
                      <Description dir="auto">{item().description}</Description>
                    </Show>
                  </section>

                  <Show when={item().tags.length}>
                    <Tags aria-label={t`Tags`}>
                      <For each={item().tags}>
                        {(tag) => (
                          <a
                            dir="auto"
                            href={`${props.base}/servers?tag=${encodeURIComponent(tag)}`}
                          >
                            <b aria-hidden="true">#</b>
                            {tag}
                          </a>
                        )}
                      </For>
                    </Tags>
                  </Show>

                  <Panel>
                    <h2>
                      <Trans>Before you join</Trans>
                    </h2>
                    <p>
                      <Trans>
                        If the server asks you to accept its rules, you do so
                        before you can write. Discover lists only servers whose
                        owners asked to be here, and the Zrzur team checks each
                        one first.
                      </Trans>
                    </p>
                    <a href={`${WEBSITE_URL}/legal/discover-guidelines`}>
                      <Trans>Discover rules</Trans>
                    </a>
                  </Panel>

                  <Show when={similar()?.length}>
                    <section>
                      <h2>
                        <Trans>Similar communities</Trans>
                      </h2>
                      <Similar>
                        <For each={similar()}>
                          {(other) => (
                            <a href={`${props.base}/${pageSlug(other)}`}>
                              <i>
                                <ListingArt
                                  kind="servers"
                                  id={other.id}
                                  category={other.category}
                                  count={other.count}
                                  online={other.online}
                                  banner={fileUrl(other.banner)}
                                />
                              </i>
                              <Avatar
                                size={44}
                                src={fileUrl(other.icon)}
                                fallback={other.name}
                                shape="rounded-square"
                              />
                              <span>
                                <strong dir="auto">{other.name}</strong>
                                <small>
                                  <CountLabel
                                    kind="servers"
                                    count={other.count}
                                  />
                                </small>
                              </span>
                            </a>
                          )}
                        </For>
                      </Similar>
                    </section>
                  </Show>
                </Main>

                <Aside>
                  <JoinCard aria-live="polite">
                    <Switch
                      fallback={
                        <State data-tone="open">
                          <span>
                            <Icon name="check" size={20} />
                          </span>
                          <div>
                            <strong>
                              <Trans>Open to everyone</Trans>
                            </strong>
                            <small>
                              <Trans>You join right away.</Trans>
                            </small>
                          </div>
                        </State>
                      }
                    >
                      <Match when={isMember()}>
                        <State data-tone="open">
                          <span>
                            <Icon name="check" size={20} />
                          </span>
                          <div>
                            <strong>
                              <Trans>You're a member</Trans>
                            </strong>
                          </div>
                        </State>
                      </Match>
                      <Match when={join() === "requested"}>
                        <State data-tone="wait">
                          <span>
                            <Icon name="clock" size={20} />
                          </span>
                          <div>
                            <strong>
                              <Trans>Request sent</Trans>
                            </strong>
                            <small>
                              <Trans>
                                You'll join as soon as a moderator approves it.
                              </Trans>
                            </small>
                          </div>
                        </State>
                      </Match>
                      <Match when={join() === "closed"}>
                        <State data-tone="closed">
                          <span>
                            <Icon name="lock-simple" size={20} />
                          </span>
                          <div>
                            <strong>
                              <Trans>Joining is closed right now</Trans>
                            </strong>
                            <small>
                              <Trans>
                                Try again later, or look at similar communities.
                              </Trans>
                            </small>
                          </div>
                        </State>
                      </Match>
                    </Switch>

                    <Show
                      when={join() !== "requested" && join() !== "closed"}
                      fallback={
                        <PrimaryButton type="button" disabled>
                          <Show
                            when={join() === "requested"}
                            fallback={<Trans>Joining is closed</Trans>}
                          >
                            <Trans>Waiting for approval</Trans>
                          </Show>
                        </PrimaryButton>
                      }
                    >
                      <PrimaryButton
                        ref={joinButton}
                        type="button"
                        data-join
                        data-busy={join() === "busy"}
                        disabled={join() === "busy"}
                        onClick={() => joinServer(item())}
                      >
                        <Show
                          when={isMember()}
                          fallback={
                            <span>
                              <Trans>Join {item().name}</Trans>
                            </span>
                          }
                        >
                          <Trans>Go to server</Trans>
                        </Show>
                      </PrimaryButton>
                    </Show>

                    <Show when={props.site && !isLoggedIn()}>
                      <small data-visitor-note>
                        <Trans>
                          Browsing needs no account. You sign in or create one
                          before joining, then come back to this server.
                        </Trans>
                      </small>
                    </Show>

                    <Divider />
                    <Row>
                      <SecondaryButton
                        type="button"
                        onClick={() => copyLink(item())}
                      >
                        <Icon name={copied() ? "check" : "link"} size={18} />
                        <Show
                          when={copied()}
                          fallback={<Trans>Copy link</Trans>}
                        >
                          <Trans>Copied</Trans>
                        </Show>
                      </SecondaryButton>
                      <IconOnly
                        type="button"
                        data-report
                        aria-label={t`Report server`}
                        title={t`Report server`}
                        onClick={() => report(item())}
                      >
                        <Icon name="flag" size={18} />
                      </IconOnly>
                    </Row>
                  </JoinCard>

                  <Details>
                    <dt>
                      <Trans>Link</Trans>
                    </dt>
                    <dd dir="ltr">
                      {pageUrl(item()).replace(/^https?:\/\//, "")}
                    </dd>
                  </Details>
                </Aside>
              </Columns>
            </>
          )}
        </Match>
      </Switch>
      {inApp.dialog()}
    </Page>
  );
}

const Page = styled("article", {
  base: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    color: "var(--z-fg-primary)",
  },
});

/** Edge to edge on a phone, a wide picture with corners above that */
const BannerArea = styled("div", {
  base: {
    position: "relative",
    overflow: "hidden",
    height: "280px",
    borderRadius: "var(--z-shape-card)",
    border: "1px solid var(--dz-edge)",
    backgroundColor: "var(--dz-band)",
    "@media (max-width: 760px)": { height: "176px" },
    _phone: {
      marginInline: "-16px",
      borderRadius: 0,
      borderInline: "none",
      borderTop: "none",
    },
  },
});

const Crumbs = styled("nav", {
  base: {
    position: "absolute",
    top: "16px",
    insetInlineStart: "16px",
    maxWidth: "calc(100% - 32px)",
    height: "32px",
    paddingInline: "12px",
    borderRadius: "10px",
    background: "var(--z-bg-floating)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    "& a": {
      color: "var(--z-fg-secondary)",
      textDecoration: "none",
      whiteSpace: "nowrap",
      "&:hover": { color: "var(--z-fg-primary)" },
      "&:focus-visible": { outline: "2px solid var(--z-focus)" },
    },
    "& [aria-current]": {
      color: "var(--z-fg-primary)",
      fontWeight: 600,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "&:dir(rtl) [data-mirror]": { transform: "scaleX(-1)" },
    "@media (max-width: 760px)": { display: "none" },
  },
});

const Columns = styled("div", {
  base: {
    width: "100%",
    maxWidth: "1200px",
    marginInline: "auto",
    padding: "0 0 24px",
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 344px",
    gap: "40px",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      padding: "0 0 96px",
      gap: "24px",
    },
  },
});

const Main = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    "& h2": {
      margin: "0 0 12px",
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
    },
  },
});

const Identity = styled("div", {
  base: {
    // above the banner it overlaps
    position: "relative",
    zIndex: 1,
    marginTop: "-56px",
    display: "flex",
    alignItems: "flex-end",
    gap: "20px",
    paddingInlineStart: "24px",
    "& h1": {
      margin: 0,
      paddingBottom: "4px",
      minWidth: 0,
      fontSize: "28px",
      lineHeight: "36px",
      fontWeight: 700,
      overflowWrap: "anywhere",
    },
    "@media (max-width: 760px)": {
      marginTop: "-48px",
      paddingInlineStart: 0,
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "12px",
      "& h1": { fontSize: "24px", lineHeight: "32px", paddingBottom: 0 },
    },
  },
});

const IconFrame = styled("div", {
  base: {
    flexShrink: 0,
    padding: "6px",
    borderRadius: "28px",
    background: "var(--dz-page)",
    lineHeight: 0,
  },
});

/** One strip, split by hairlines: the page's sign of life */
const Pulse = styled("dl", {
  base: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "1px",
    overflow: "hidden",
    borderRadius: "var(--z-shape-card)",
    border: "1px solid var(--dz-edge)",
    background: "var(--dz-edge)",

    "& > div": {
      minWidth: 0,
      padding: "12px 16px",
      background: "var(--z-card-bg)",
    },
    "& dt": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
    "& dt span": {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "var(--z-live)",
    },
    "& dd": {
      margin: 0,
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
      overflowWrap: "anywhere",
    },
    "& [data-live] dd": { fontSize: "22px", lineHeight: "26px" },
    "& a": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      color: "var(--dz-mark)",
      textDecoration: "none",
      "--z-icon-color": "currentColor",
      _hover: { textDecoration: "underline" },
      _focusVisible: { outline: "2px solid var(--z-focus)" },
      _phone: { minHeight: "44px" },
    },
    _phone: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      // an odd number of facts: the last one takes the whole row
      "& > div:last-child:nth-child(odd)": { gridColumn: "1 / -1" },
    },
  },
});

const Description = styled("p", {
  base: {
    margin: 0,
    maxWidth: "680px",
    fontSize: "18px",
    lineHeight: "30px",
    color: "var(--z-fg-primary)",
    whiteSpace: "pre-line",
    overflowWrap: "anywhere",
  },
});

const Muted = styled("p", {
  base: { margin: 0, fontSize: "15px", color: "var(--z-fg-muted)" },
});

const Tags = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    "& a": {
      minHeight: "32px",
      "@media (max-width: 760px)": { minHeight: "44px" },
      paddingInline: "12px",
      borderRadius: "6px",
      border: "1px solid var(--dz-edge)",
      background: "var(--z-card-bg)",
      color: "var(--z-fg-primary)",
      fontSize: "13px",
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      textDecoration: "none",
      "& > b": { color: "var(--dz-mark)" },
      "&:hover": { background: "var(--z-nav-selected)" },
      "&:focus-visible": { outline: "2px solid var(--z-focus)" },
    },
  },
});

const Panel = styled("section", {
  base: {
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid var(--dz-edge)",
    background: "var(--z-card-bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    "& h2": { margin: 0 },
    "& p": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
    "& a": {
      fontSize: "14px",
      fontWeight: 600,
      color: "var(--dz-mark)",
      "@media (max-width: 760px)": {
        minHeight: "44px",
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
});

const Similar = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))",
    gap: "8px",
    "& a": {
      position: "relative",
      overflow: "hidden",
      padding: "12px",
      paddingInlineStart: "40px",
      borderRadius: "var(--z-shape-card)",
      border: "1px solid var(--dz-edge)",
      background: "var(--z-card-bg)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      color: "inherit",
      textDecoration: "none",
      "&:hover": { background: "var(--z-nav-selected)" },
      "&:focus-visible": { outline: "2px solid var(--z-focus)" },
    },
    // a sliver of its picture along the edge
    "& a > i": {
      position: "absolute",
      insetBlock: 0,
      insetInlineStart: 0,
      width: "28px",
    },
    "& span": {
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
    "& strong": {
      fontSize: "15px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-secondary)" },
  },
});

const Aside = styled("aside", {
  base: {
    marginTop: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    position: "sticky",
    top: "80px",
    alignSelf: "start",
    "@media (max-width: 900px)": {
      position: "static",
      alignSelf: "stretch",
      marginTop: 0,
      order: 1,
    },
  },
});

const JoinCard = styled("div", {
  base: {
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid var(--dz-edge)",
    background: "var(--z-card-bg)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& > small": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
  },
});

const State = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    "& > span": {
      width: "36px",
      height: "36px",
      flexShrink: 0,
      borderRadius: "10px",
      display: "grid",
      placeItems: "center",
    },
    "&[data-tone='open'] > span": {
      color: "var(--z-live)",
      background: "color-mix(in srgb, var(--z-live) 14%, transparent)",
    },
    "&[data-tone='wait'] > span": {
      color: "var(--z-warning)",
      background: "color-mix(in srgb, var(--z-warning) 14%, transparent)",
    },
    "&[data-tone='closed'] > span": {
      color: "var(--z-danger)",
      background: "color-mix(in srgb, var(--z-danger) 14%, transparent)",
    },
    "& > div": { display: "flex", flexDirection: "column", gap: "4px" },
    "& strong": { fontSize: "15px", fontWeight: 600 },
    "& small": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const buttonBase = {
  minHeight: "44px",
  paddingInline: "16px",
  borderRadius: "10px",
  font: "inherit",
  fontSize: "15px",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  textDecoration: "none",
  transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
  "&:focus-visible": {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "2px",
  },
  "&:disabled": { cursor: "default" },
} as const;

const PrimaryButton = styled("button", {
  base: {
    ...buttonBase,
    minHeight: "48px",
    fontSize: "16px",
    border: 0,
    background: "var(--z-accent-fill)",
    color: "var(--z-on-accent)",
    "& > span": { overflow: "hidden", textOverflow: "ellipsis" },
    "&:hover:not(:disabled)": { background: "var(--z-accent-hover)" },
    "&:active:not(:disabled)": { background: "var(--z-accent-pressed)" },
    "&[data-busy='true']": { opacity: 0.7 },
    "&:disabled:not([data-busy='true'])": {
      background: "var(--dz-page)",
      color: "var(--z-fg-muted)",
      border: "1px solid var(--dz-edge)",
    },
    // phones: always in reach of the thumb, over the page
    "@media (max-width: 900px)": {
      position: "fixed",
      insetInline: "16px",
      bottom: "calc(16px + env(safe-area-inset-bottom))",
      minHeight: "44px",
      zIndex: 10,
      boxShadow: "0 12px 32px rgb(0 0 0 / 0.45)",
    },
  },
});

const SecondaryButton = styled("button", {
  base: {
    ...buttonBase,
    flex: 1,
    border: "1px solid var(--z-border-strong)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    "&:hover": { background: "var(--z-nav-hover)" },
  },
});

const SecondaryLink = styled("a", {
  base: {
    ...buttonBase,
    border: "1px solid var(--z-border-strong)",
    color: "var(--z-fg-primary)",
    "&:hover": { background: "var(--z-nav-hover)" },
  },
});

const IconOnly = styled("button", {
  base: {
    ...buttonBase,
    width: "44px",
    paddingInline: 0,
    border: "1px solid var(--dz-edge)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    "&:hover": { background: "var(--z-nav-hover)" },
  },
});

const Row = styled("div", { base: { display: "flex", gap: "8px" } });

const Divider = styled("div", {
  base: { height: "1px", background: "var(--z-border-subtle)" },
});

const Details = styled("dl", {
  base: {
    margin: 0,
    padding: "16px 24px",
    borderRadius: "14px",
    border: "1px solid var(--dz-edge)",
    background: "var(--z-card-bg)",
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "12px 16px",
    fontSize: "14px",
    "& dt": { color: "var(--z-fg-muted)" },
    "& dd": {
      margin: 0,
      overflowWrap: "anywhere",
      textAlign: "start",
      fontFamily: "'IBM Plex Sans', sans-serif",
    },
  },
});

const Message = styled("div", {
  base: {
    maxWidth: "480px",
    margin: "80px auto",
    padding: "0 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    textAlign: "center",
    color: "var(--z-fg-secondary)",
    "& strong": { fontSize: "18px", color: "var(--z-fg-primary)" },
  },
});

const SkeletonLine = styled("div", {
  base: {
    height: "16px",
    width: "70%",
    borderRadius: "6px",
    background: "var(--z-card-bg)",
    "&[data-size='title']": { height: "32px", width: "40%", marginTop: "24px" },
  },
});
