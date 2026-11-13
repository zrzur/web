import { For, JSX, Match, Show, Switch } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { API, ServerFlags, File as StoatFile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar } from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { Icon } from "@revolt/ui/icons/Icon";

import { AdLabel, useAdWord } from "./AdLabel";
import { ListingArt } from "./Art";
import { DiscoverBot, DiscoverKind, DiscoverServer } from "./api";
import { categoryIcon, useDiscoverLabels } from "./categories";
import {
  MarkInput,
  isPaidListing,
  isPaidMark,
  listingBadge,
  listingMark,
} from "./marks";
import { ART_SKY } from "./palette";
import { plainDescription } from "./plainText";
import { useTierName } from "./tiers";

export { listingBadge, listingMark };

/** Card data independent of servers/bots */
export type Listing = {
  kind: DiscoverKind;
  id: string;
  name: string;
  description?: string;
  icon?: API.File | StoatFile;
  banner?: API.File | StoatFile;
  verified: boolean;
  /** Zrzur's own server: it carries the official mark, not the verified seal */
  official?: boolean;
  featured: boolean;
  /** Paid boost label */
  boost?: "Boost" | "SuperBoost" | "MegaBoost";
  /** In the paid top row */
  promoted?: boolean;
  tags: string[];
  category?: string;
  language?: string;
  count: number;
  /** Members online now (approximate; servers only) */
  online?: number;
  /** Custom link name, for the public page address */
  link?: string;
};

export function fromServer(server: DiscoverServer): Listing {
  return {
    kind: "servers",
    id: server._id,
    name: server.name,
    description: server.description,
    icon: server.icon,
    banner: server.banner,
    verified: !!(
      (server.flags ?? 0) &
      (ServerFlags.Verified | ServerFlags.Official)
    ),
    official: !!((server.flags ?? 0) & ServerFlags.Official),
    featured: server.featured,
    boost: server.boost,
    promoted: server.promoted,
    tags: server.tags ?? [],
    category: server.category,
    language: server.language,
    count: server.member_count,
    // already rounded by the API; absent for small servers and Invisible members
    online: server.online_count ?? undefined,
    link: server.link,
  };
}

export function fromBot(bot: DiscoverBot): Listing {
  return {
    kind: "bots",
    id: bot._id,
    name: bot.username,
    description: bot.description,
    icon: bot.avatar,
    banner: bot.banner,
    verified: !!bot.verified,
    featured: bot.featured,
    boost: bot.boost,
    promoted: bot.promoted,
    tags: bot.tags ?? [],
    category: bot.category,
    language: bot.language,
    count: bot.server_count,
  };
}

/** Resolve an API file to a URL on the configured media server */
export function useFileUrl() {
  const client = useClient();
  return (file?: API.File | StoatFile) =>
    file ? new StoatFile(client(), file).createFileURL() : undefined;
}

/**
 * Uploaded artwork, or (no banner) a calm tone of its own, the same for a
 * listing every time
 */
export function bannerStyle(url: string | undefined) {
  if (url) return { "background-image": `url("${url}")` };
  return { "background-color": ART_SKY };
}

export function CountLabel(props: { kind: DiscoverKind; count: number }) {
  return (
    <Show
      when={props.kind === "servers"}
      fallback={
        <Plural
          value={props.count}
          _0="Not in any servers yet"
          one="In # server"
          other="In # servers"
        />
      }
    >
      <Plural value={props.count} one="# member" other="# members" />
    </Show>
  );
}

/** Small label for a listing's mark (paid places say so, as an ad) */
export function MarkPill(props: { listing: MarkInput & { name?: string } }) {
  const tierName = useTierName();
  const mark = () => listingMark(props.listing);
  return (
    <Marks>
      <Switch>
        <Match when={mark() === "promoted"}>
          <Pill data-tone="paid">
            <Icon name="megaphone" size={12} />
            {tierName("TopRow")}
          </Pill>
        </Match>
        <Match when={mark() === "headline"}>
          <Pill data-tone="headline">
            <Icon name="lightning" size={12} />
            {tierName("MegaBoost")}
          </Pill>
        </Match>
        <Match when={mark() === "spotlight"}>
          <Pill data-tone="paid">
            <Icon name="lightning" size={12} />
            {tierName("SuperBoost")}
          </Pill>
        </Match>
        <Match when={mark() === "boosted"}>
          <Pill data-tone="paid">
            <Icon name="lightning" size={12} />
            {tierName("Boost")}
          </Pill>
        </Match>
        <Match when={mark() === "picked"}>
          <Pill>
            <Icon name="seal-check" size={12} />
            <Trans>Hand-picked</Trans>
          </Pill>
        </Match>
      </Switch>
      <Show when={isPaidMark(mark())}>
        <AdLabel kind={props.listing.kind} name={props.listing.name} />
      </Show>
    </Marks>
  );
}

const Marks = styled("div", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "4px",
  },
});

/** "Gaming · Arabic", the line under a listing's name */
export function ListingMeta(props: { listing: Listing }) {
  const labels = useDiscoverLabels();
  return (
    <Show when={props.listing.category || props.listing.language}>
      <Meta data-meta>
        <Show when={props.listing.category}>
          <span>
            <Icon
              name={categoryIcon(props.listing.kind, props.listing.category)}
              size={14}
            />
            {labels.category(props.listing.category)}
          </span>
        </Show>
        <Show when={props.listing.language}>
          <span>
            <Icon name="globe" size={14} />
            {labels.language(props.listing.language)}
          </span>
        </Show>
      </Meta>
    </Show>
  );
}

/**
 * Discover listing card, one size for all: the banner on top with the icon
 * over its edge, the name, what it is about, the tags, and a last row with who
 * is there, the flag and Join. With no banner, its portrait in birds. The whole
 * card opens the details for a pointer; for keyboards and screen readers
 * OpenButton does (a card that is a button could not hold the Join button).
 */
export function ListingCard(props: {
  listing: Listing;
  /** Open details */
  onOpen?: () => void;
  /** Join / add, bottom end */
  action?: JSX.Element;
  /** Report it, from the card */
  onReport?: () => void;
  testId?: string;
}) {
  const { t } = useLingui();
  const fileUrl = useFileUrl();
  const adWord = useAdWord();
  const isBot = () => props.listing.kind === "bots";
  /** Words only: a card cannot hold links or lists (the page shows them) */
  const about = () => plainDescription(props.listing.description);
  /** The name a screen reader hears: paid places say "Ad" too */
  const cardName = () =>
    isPaidListing(props.listing)
      ? `${props.listing.name}, ${adWord()}`
      : props.listing.name;

  return (
    <Card
      data-listing={props.listing.id}
      data-interactive={!!props.onOpen}
      data-testid={props.testId}
      onClick={() => props.onOpen?.()}
    >
      {/* keyboard and screen-reader way in; the card itself is no button, so
          the buttons inside it (the "?", join) are not nested in one */}
      <Show when={props.onOpen}>
        <OpenButton
          type="button"
          aria-label={cardName()}
          onClick={(e) => {
            e.stopPropagation();
            props.onOpen?.();
          }}
        />
      </Show>

      <Picture data-picture>
        <Banner>
          <ListingArt
            kind={props.listing.kind}
            id={props.listing.id}
            category={props.listing.category}
            count={props.listing.count}
            online={props.listing.online}
            banner={fileUrl(props.listing.banner)}
          />
          <MarkSlot>
            <Show when={isPaidListing(props.listing)}>
              <MarkPill listing={props.listing} />
            </Show>
          </MarkSlot>
        </Banner>

        <AvatarRing data-avatar data-kind={props.listing.kind}>
          <Avatar
            size={52}
            src={fileUrl(props.listing.icon)}
            fallback={props.listing.name}
            shape={
              props.listing.kind === "servers" ? "rounded-square" : "circle"
            }
          />
        </AvatarRing>
      </Picture>

      <Body data-body>
        <Name>
          <span dir="auto">{props.listing.name}</span>
          <Show when={listingBadge(props.listing)}>
            {(badge) => <BadgeMark id={badge()} size="xs" mode="hover" />}
          </Show>
          <Show when={isBot()}>
            <BotLabel />
          </Show>
        </Name>

        <Description
          data-description
          dir={about() ? "auto" : undefined}
          data-empty={!about()}
        >
          {about() || <Trans>No description yet.</Trans>}
        </Description>

        <Show when={props.listing.tags.length}>
          <Tags data-tags>
            {/* labels only: the card itself is the button, and the
                details list the same tags as filters */}
            <For each={props.listing.tags.slice(0, 5)}>
              {(tag) => (
                <TagLabel dir="auto">
                  <b aria-hidden="true">#</b>
                  {tag}
                </TagLabel>
              )}
            </For>
          </Tags>
        </Show>

        <Footer data-footer>
          <Stat data-stats>
            <Icon
              name={props.listing.kind === "servers" ? "users" : "robot"}
              size={16}
            />
            <span>
              <CountLabel
                kind={props.listing.kind}
                count={props.listing.count}
              />
            </span>
          </Stat>
          <Show when={props.action}>
            <div data-action onClick={(e) => e.stopPropagation()}>
              {props.action}
            </div>
          </Show>
          <Show when={props.onReport}>
            <Flag
              type="button"
              aria-label={t`Report`}
              title={t`Report`}
              onClick={(e) => {
                e.stopPropagation();
                props.onReport?.();
              }}
            >
              <Icon name="flag" size={16} />
            </Flag>
          </Show>
        </Footer>
      </Body>
    </Card>
  );
}

/**
 * What holds cards: the height of the fullest one (three lines of words, two
 * of tags, a count on three lines). Every card, skeleton and free place takes
 * it, on phones too: there the last row's 44 px fit the same room.
 */
export const CardRoom = styled("div", {
  base: { "--card-h": "360px" },
});

const Card = styled("article", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
    borderRadius: "var(--z-shape-card)",
    border: "1px solid var(--z-card-border, var(--dz-edge))",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    color: "var(--z-fg-primary)",
    "--banner-h": "100px",
    "--avatar-ring": "60px",
    "--ring": "var(--z-card-solid, var(--z-bg-sidebar))",

    // the same size whether or not it has tags; the wall sets it
    minHeight: "var(--card-h, 0)",

    "&[data-interactive='true']": {
      cursor: "pointer",
      "@media (hover: hover)": {
        _hover: {
          background: "var(--dz-glass-hover)",
          "--ring": "var(--dz-glass-hover)",
          borderColor: "var(--z-border-strong, var(--dz-edge))",
        },
      },
      "&:active": { background: "var(--dz-glass-hover)" },
    },
  },
});

/** The picture and the icon over its edge */
const Picture = styled("div", {
  base: { flexShrink: 0 },
});

/** Covers the card for keyboard focus and screen readers; clicks pass through */
export const OpenButton = styled("button", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    borderRadius: "inherit",
    pointerEvents: "none",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
  },
});

const Banner = styled("div", {
  base: {
    position: "relative",
    height: "var(--banner-h)",
    flexShrink: 0,
  },
});

const MarkSlot = styled("div", {
  base: {
    position: "absolute",
    zIndex: 3,
    top: "8px",
    insetInlineEnd: "8px",
    display: "flex",
  },
});

export const Pill = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "24px",
    paddingInline: "8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    // a solid plate under the words, readable over any artwork
    color: "var(--z-fg-primary)",
    background: "var(--dz-glass, var(--z-bg-raised))",
    border: "1px solid var(--dz-edge)",
    "--z-icon-color": "var(--z-fg-secondary)",

    // paid places: accent words on the same plate
    "&[data-tone='paid']": {
      color: "var(--z-fg-primary)",
      background: "var(--dz-glass, var(--z-bg-raised))",
      borderColor: "var(--z-accent)",
      "--z-icon-color": "var(--z-fg-primary)",
    },
    "&[data-tone='headline']": {
      color: "var(--z-on-premium)",
      background: "var(--z-premium-gradient)",
      borderColor: "transparent",
      "--z-icon-color": "var(--z-on-premium)",
    },
  },
});

const AvatarRing = styled("div", {
  base: {
    position: "absolute",
    zIndex: 1,
    top: "calc(var(--banner-h) - var(--avatar-ring) / 2)",
    // the icon lines up with the words under it
    insetInlineStart: "8px",
    padding: "4px",
    borderRadius: "18px",
    background: "var(--ring)",
    lineHeight: 0,

    "&[data-kind='bots']": { borderRadius: "999px" },
  },
});

const Body = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "calc(var(--avatar-ring) / 2 + 8px) 12px 12px",
    minWidth: 0,
  },
});

const Name = styled("h3", {
  base: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: "24px",

    "& span[dir]": {
      display: "block",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 12px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-muted)",

    "& > span": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    },
  },
});

const Description = styled("p", {
  base: {
    flex: "0 1 auto",
    margin: 0,
    minHeight: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    lineClamp: 3,
    overflowWrap: "anywhere",
    // Arabic text keeps its own order but lines up with the card
    textAlign: "match-parent",

    "&[data-empty='true']": { color: "var(--z-fg-muted)" },
  },
});

const Tags = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    marginTop: "4px",
    // at most two rows: the rest wait on its page
    maxHeight: "52px",
    overflow: "hidden",
  },
});

const TagLabel = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    height: "24px",
    paddingInline: "8px",
    borderRadius: "var(--z-shape-chip)",
    background: "var(--dz-glass-hover)",
    color: "var(--z-fg-secondary)",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    "& > b": { color: "var(--dz-mark)", fontWeight: 700 },
  },
});

export const Tag = styled("button", {
  base: {
    height: "24px",
    padding: "0 8px",
    borderRadius: "var(--z-shape-chip)",
    border: "1px solid transparent",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "color 120ms ease, border-color 120ms ease",

    "& > b": { color: "var(--dz-mark)", fontWeight: 700 },
    _hover: {
      color: "var(--z-fg-primary)",
      background: "var(--z-bg-raised)",
    },
    _disabled: {
      cursor: "default",
      _hover: { background: "var(--z-bg-input)" },
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    // phones: a 44 px tap target (phone rules)
    _phone: { height: "44px", paddingInline: "12px", fontSize: "13px" },
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "4px",
    marginTop: "auto",
    paddingTop: "8px",
    // reading order: Join, then the flag; on screen the flag comes first
    "& > [data-action]": {
      order: 2,
      flexShrink: 0,
      "& > button": {
        paddingInline: "8px",
        // phones: a 44 px tap target, a short word too
        _phone: { minWidth: "44px" },
      },
    },
  },
});

/** Report, quiet until you point at it */
const Flag = styled("button", {
  base: {
    order: 1,
    flexShrink: 0,
    width: "32px",
    height: "32px",
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "var(--z-shape-button)",
    background: "transparent",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    transition: "color 120ms ease, background-color 120ms ease",
    _hover: {
      color: "var(--z-fg-primary)",
      background: "var(--dz-glass-hover)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    _phone: { width: "44px", height: "44px" },
  },
});

/** The count: on a narrow card its word takes a second line, never the row */
const Stat = styled("div", {
  base: {
    flex: 1,
    // three lines: "Noch auf keinem Server" beside a long button
    minHeight: "48px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--dz-mark)",
    "& > svg": { flexShrink: 0 },
  },
});

/** Primary card / detail button */
export const PrimaryButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    height: "var(--z-control-sm)",
    padding: "0 12px",
    borderRadius: "var(--z-shape-button)",
    border: "1px solid transparent",
    background: "var(--z-btn-primary-bg)",
    boxShadow: "var(--z-btn-lift)",
    color: "var(--z-on-accent)",
    font: "inherit",
    // the same text as the app's buttons
    fontSize: "14px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    transition: "background-color 0.12s ease, transform 80ms ease",

    _hover: { background: "var(--z-btn-primary-hover)" },
    "&:active": { transform: "translateY(0.5px) scale(0.985)" },
    _motionReduce: { transition: "none", "&:active": { transform: "none" } },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _disabled: { opacity: 0.6, cursor: "default" },

    "&[data-variant='secondary']": {
      background: "var(--z-btn-surface-bg)",
      color: "var(--z-fg-primary)",
      borderColor: "var(--z-btn-surface-border)",
      boxShadow: "var(--z-btn-surface-lift)",
      _hover: {
        background: "var(--z-btn-surface-hover)",
        borderColor: "var(--z-btn-outline-border)",
      },
      "&:active": { boxShadow: "var(--z-btn-pressed)" },
    },
    "&[data-variant='danger']": {
      background: "transparent",
      color: "var(--z-danger)",
      border: "1px solid color-mix(in srgb, var(--z-danger) 45%, transparent)",
      _hover: {
        background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
      },
    },
    "&[data-size='large']": {
      height: "var(--z-control-lg)",
      padding: "0 18px",
      fontSize: "14px",
      borderRadius: "var(--z-shape-button)",
    },
    // phones: a 44 px tap target (phone rules)
    _phone: { minHeight: "44px", paddingInline: "16px" },
  },
});
