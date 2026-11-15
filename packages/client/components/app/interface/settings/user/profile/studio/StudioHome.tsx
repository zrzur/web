import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Button, Dialog } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useDate } from "../CommunityParts";
import { CreatorPublicName } from "../CreatorPublicName";
import {
  type CommunityItem,
  type CommunityKind,
  type CommunityPermissions,
  kindOf,
} from "../communityApi";
import { type TemplateWords, downloadTemplate } from "../studioTemplates";

import {
  Actions,
  Callout,
  Crumbs,
  Page,
  PageHead,
  SpecList,
  StatusMark,
  Thumb,
  useStudioWords,
} from "./parts";
import {
  type StudioFilter,
  STUDIO_FILTERS,
  STUDIO_SPECS,
  actionsOf,
  needsAttention,
  reviewNote,
  shownStatus,
  studioCounts,
  studioList,
} from "./studioModel";

/** Largest number of designs a creator keeps (`max_items_per_creator`) */
export const STUDIO_MAX_ITEMS = 50;

const KINDS: CommunityKind[] = ["decorations", "nameplates", "effects"];

/**
 * The studio's first page: what the creator has, by state, with whatever
 * waits for them on top and one way to start a new design.
 */
export function StudioHome(props: {
  items: CommunityItem[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  perms: CommunityPermissions;
  /** suspended or revoked: look, download, change nothing */
  readOnly: boolean;
  /** this server takes effects */
  effects: boolean;
  avatar?: string;
  name: string;
  dialog?: boolean;
  onLeave: () => void;
  onNew: () => void;
  onOpen: (item: CommunityItem) => void;
  onEdit: (item: CommunityItem) => void;
  /** set by the shell so "/" style shortcuts can reach the search box */
  searchRef?: (input: HTMLInputElement) => void;
}) {
  const { t, i18n } = useLingui();
  const words = useStudioWords();
  const date = useDate();
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  const [filter, setFilter] = createSignal<StudioFilter>("all");
  const [kind, setKind] = createSignal<CommunityKind | "all">("all");
  const [query, setQuery] = createSignal("");
  const [specs, setSpecs] = createSignal(false);

  const counts = createMemo(() => studioCounts(props.items));
  const list = createMemo(() =>
    studioList(props.items, filter(), kind(), query()),
  );
  const attention = createMemo(() => needsAttention(props.items));
  const wornBy = () =>
    props.items.reduce(
      (sum, item) =>
        sum + (item.status === "Published" ? (item.popularity ?? 0) : 0),
      0,
    );
  const kept = () => counts().all - counts().withdrawn;
  const kinds = () =>
    KINDS.filter((entry) => entry !== "effects" || props.effects);

  const filterLabel = (id: StudioFilter) =>
    ({
      all: t`All`,
      drafts: t`Drafts`,
      review: t`In review`,
      attention: t`Needs you`,
      published: t`Published`,
      withdrawn: t`Withdrawn`,
    })[id];

  // words printed on the template images, in the person's language
  const guide = (): TemplateWords => ({
    avatar: t`Avatar`,
    keepClear: t`Avatar (keep clear)`,
    around: t`Draw around the circle`,
    name: t`Name`,
    cropped: t`Cropped`,
    ltrLanguages: t`Left-to-right languages`,
    rtlLanguages: t`Right-to-left languages`,
    fullFromHere: t`Fully seen from here`,
    fullUpToHere: t`Fully seen up to here`,
    bothDirections: t`Seen in both directions, never fully`,
    effectText: t`Keep this readable: leave it mostly transparent`,
    effectRules: t`4 seconds, one play, no flashing`,
  });
  const direction = () =>
    document.documentElement.dir === "rtl" ? "rtl" : ("ltr" as const);

  return (
    <Page data-dialog={props.dialog ? "" : undefined} data-testid="studio-home">
      <Show when={!props.dialog}>
        <Crumbs aria-label={t`You are here`}>
          <button type="button" onClick={() => props.onLeave()}>
            <Trans>Designs</Trans>
          </button>
          <span aria-hidden="true">/</span>
          <b>
            <Trans>Creator Studio</Trans>
          </b>
        </Crumbs>
      </Show>

      <PageHead>
        <div>
          <h1>
            <Trans>Creator Studio</Trans>
          </h1>
          <p>
            <Show
              when={!props.readOnly}
              fallback={<Trans>The designs you made, kept here.</Trans>}
            >
              <Trans>
                Make your designs, upload them and follow their status in one
                place.
              </Trans>
            </Show>
          </p>
        </div>
        <Actions>
          <Button variant="tonal" onPress={() => setSpecs(true)}>
            <Icon name="download-simple" size={16} />
            <Trans>Specs and templates</Trans>
          </Button>
          <Show when={!props.readOnly}>
            <Button
              variant="filled"
              data-testid="studio-new"
              onPress={() => props.onNew()}
            >
              <Icon name="plus" size={16} />
              <Trans>New design</Trans>
            </Button>
          </Show>
        </Actions>
      </PageHead>

      <Stats data-testid="studio-stats">
        <div>
          <strong>{number(counts().published)}</strong>
          <span>
            <Trans>Published</Trans>
          </span>
        </div>
        <div>
          <strong>{number(counts().review)}</strong>
          <span>
            <Trans>In review</Trans>
          </span>
        </div>
        <div>
          <strong>{number(counts().drafts)}</strong>
          <span>
            <Trans>Drafts</Trans>
          </span>
        </div>
        <div>
          <strong>{number(wornBy())}</strong>
          <span>
            <Trans>People wearing your designs</Trans>
          </span>
        </div>
        <div>
          <strong dir="ltr">
            {number(kept())} / {number(STUDIO_MAX_ITEMS)}
          </strong>
          <span>
            <Trans>Of your design limit</Trans>
          </span>
        </div>
      </Stats>

      <For each={attention().slice(0, 3)}>
        {(item) => (
          <Callout
            tone={
              shownStatus(item) === "ChangesRequested" ? "warning" : "error"
            }
            testid="studio-attention"
            title={
              <>
                <bdi>{item.pending?.name ?? item.name}</bdi>
                {" · "}
                {words.status(shownStatus(item))}
              </>
            }
            action={
              <Button
                variant="tonal"
                size="sm"
                onPress={() => props.onOpen(item)}
              >
                <Trans>Open design</Trans>
              </Button>
            }
          >
            {reviewNote(item) ?? (
              <Trans>Open it to see what happened and what you can do.</Trans>
            )}
          </Callout>
        )}
      </For>

      <Section>
        <Tabs role="tablist" aria-label={t`Your designs`}>
          <For each={STUDIO_FILTERS}>
            {(id) => (
              <button
                type="button"
                role="tab"
                data-testid={`studio-tab-${id}`}
                aria-selected={filter() === id}
                onClick={() => setFilter(id)}
              >
                {filterLabel(id)}
                <i>{number(counts()[id])}</i>
              </button>
            )}
          </For>
        </Tabs>

        <Tools>
          <Search>
            <Icon name="magnifying-glass" size={16} />
            <input
              ref={(input) => props.searchRef?.(input)}
              type="search"
              data-testid="studio-search"
              aria-label={t`Search your designs`}
              placeholder={t`Search your designs`}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </Search>
          <Chips role="group" aria-label={t`Type`}>
            <button
              type="button"
              aria-pressed={kind() === "all"}
              onClick={() => setKind("all")}
            >
              <Trans>All types</Trans>
            </button>
            <For each={kinds()}>
              {(entry) => (
                <button
                  type="button"
                  aria-pressed={kind() === entry}
                  onClick={() => setKind(entry)}
                >
                  {words.kind(entry)}
                </button>
              )}
            </For>
          </Chips>
        </Tools>

        <Switch>
          <Match when={props.loading}>
            <List aria-busy="true" data-testid="studio-loading">
              <For each={[0, 1, 2]}>{() => <Skeleton />}</For>
            </List>
          </Match>
          <Match when={props.failed}>
            <Callout
              tone="error"
              title={<Trans>Your designs couldn't be loaded</Trans>}
              action={
                <Button
                  variant="tonal"
                  size="sm"
                  onPress={() => props.onRetry()}
                >
                  <Trans>Try again</Trans>
                </Button>
              }
            >
              <Trans>Check your connection and try again.</Trans>
            </Callout>
          </Match>
          <Match when={!props.items.length}>
            <Empty data-testid="studio-empty">
              <Icon name="sparkle" size={32} />
              <strong>
                <Trans>No designs yet</Trans>
              </strong>
              <p>
                <Trans>
                  Start with a template, draw your design, then upload it here.
                </Trans>
              </p>
              <Show when={!props.readOnly}>
                <Button variant="tonal" onPress={() => props.onNew()}>
                  <Trans>New design</Trans>
                </Button>
              </Show>
            </Empty>
          </Match>
          <Match when={!list().length}>
            <Empty data-testid="studio-empty">
              <Icon name="magnifying-glass" size={32} />
              <strong>
                <Trans>Nothing here</Trans>
              </strong>
              <p>
                <Trans>No design matches this tab, type and search.</Trans>
              </p>
            </Empty>
          </Match>
          <Match when={true}>
            <List data-testid="studio-list">
              <HeadRow aria-hidden="true">
                <span />
                <span>
                  <Trans>Design</Trans>
                </span>
                <span>
                  <Trans>Status</Trans>
                </span>
                <span>
                  <Trans>Worn by</Trans>
                </span>
                <span>
                  <Trans>Published on</Trans>
                </span>
                <span />
              </HeadRow>
              <For each={list()}>
                {(item) => (
                  <Row data-testid="studio-row" data-id={item._id}>
                    <Thumb
                      item={item}
                      private={props.perms.creator === "Suspended"}
                      avatar={props.avatar}
                      name={props.name}
                    />
                    <RowName
                      type="button"
                      onClick={() => props.onOpen(item)}
                      aria-label={t`Open ${item.pending?.name ?? item.name}`}
                    >
                      <strong>
                        <bdi>{item.pending?.name ?? item.name}</bdi>
                      </strong>
                      <small>
                        {words.kind(kindOf(item))}
                        {" · "}
                        <Trans>
                          Version{" "}
                          {number(item.pending?.revision ?? item.revision)}
                        </Trans>
                      </small>
                      <PhoneStatus>
                        <StatusMark status={shownStatus(item)} />
                      </PhoneStatus>
                    </RowName>
                    <Cell>
                      <StatusMark status={shownStatus(item)} />
                    </Cell>
                    <Cell>
                      {item.status === "Published"
                        ? number(item.popularity ?? 0)
                        : "—"}
                    </Cell>
                    <Cell>{date(item.published_at ?? undefined) || "—"}</Cell>
                    <RowActions>
                      <Show when={actionsOf(item, props.readOnly).edit}>
                        <Button
                          variant="text"
                          size="sm"
                          data-testid="studio-row-edit"
                          onPress={() => props.onEdit(item)}
                        >
                          <Icon name="pencil-simple" size={16} />
                          <Trans>Edit</Trans>
                        </Button>
                      </Show>
                    </RowActions>
                    <Show when={reviewNote(item)}>
                      <RowNote dir="auto">
                        <b>
                          <Trans>Reviewer's note:</Trans>
                        </b>{" "}
                        {reviewNote(item)}
                      </RowNote>
                    </Show>
                  </Row>
                )}
              </For>
            </List>
          </Match>
        </Switch>
      </Section>

      <Show when={props.perms.creator === "Active"}>
        <CreatorPublicName initial={!!props.perms.show_public_name} />
      </Show>

      <Show when={!props.readOnly}>
        <Keys aria-label={t`Keyboard shortcuts`}>
          <span>
            <kbd>N</kbd> <Trans>New design</Trans>
          </span>
          <span>
            <kbd>F</kbd> <Trans>Search your designs</Trans>
          </span>
          <span>
            <kbd>Ctrl</kbd> <kbd>/</kbd> <Trans>All shortcuts</Trans>
          </span>
        </Keys>
      </Show>

      <Dialog
        show={specs()}
        onClose={() => setSpecs(false)}
        title={<Trans>Specs and templates</Trans>}
        size="lg"
      >
        <SpecsBody data-testid="studio-specs">
          <p>
            <Trans>
              Templates are guides: draw on a copy, then export without the
              guide marks. A WebM becomes an animated image when you upload it:
              its transparency stays and its sound is dropped.
            </Trans>
          </p>
          <For each={kinds()}>
            {(entry) => (
              <SpecCard>
                <header>
                  <strong>{words.kind(entry)}</strong>
                  <Button
                    variant="tonal"
                    size="sm"
                    onPress={() =>
                      void downloadTemplate(entry, guide(), direction())
                    }
                  >
                    <Icon name="download-simple" size={16} />
                    <Trans>Template</Trans>
                  </Button>
                </header>
                <SpecFacts kind={entry} />
              </SpecCard>
            )}
          </For>
        </SpecsBody>
      </Dialog>
    </Page>
  );
}

/** What a type asks of its file, in numbers */
export function SpecFacts(props: { kind: CommunityKind }) {
  const { i18n } = useLingui();
  const spec = () => STUDIO_SPECS[props.kind];
  const megabytes = () =>
    new Intl.NumberFormat(i18n().locale, {
      maximumFractionDigits: 1,
    }).format(spec().maxBytes / 1_000_000);
  return (
    <SpecList>
      <div>
        <dt>
          <Trans>Size</Trans>
        </dt>
        <dd dir="ltr">
          {spec().width} × {spec().height} px
        </dd>
      </div>
      <div>
        <dt>
          <Trans>Format</Trans>
        </dt>
        <dd>
          <Show
            when={spec().mustMove}
            fallback={<Trans>PNG, animated PNG, GIF, WebP or WebM</Trans>}
          >
            <Trans>Animated PNG, GIF, WebP or WebM</Trans>
          </Show>
        </dd>
      </div>
      <div>
        <dt>
          <Trans>File size</Trans>
        </dt>
        <dd>
          <Trans>Up to {megabytes()} MB (WebM up to 8 MB)</Trans>
        </dd>
      </div>
      <div>
        <dt>
          <Trans>Animation</Trans>
        </dt>
        <dd>
          <Show
            when={spec().mustMove}
            fallback={
              <Trans>Optional, up to {spec().maxSeconds} seconds</Trans>
            }
          >
            <Trans>
              Plays once, up to {spec().maxSeconds} seconds, no flashing
            </Trans>
          </Show>
        </dd>
      </div>
      <div>
        <dt>
          <Trans>Safe area</Trans>
        </dt>
        <dd>
          <Switch>
            <Match when={props.kind === "decorations"}>
              <Trans>Leave the middle two thirds clear for the avatar</Trans>
            </Match>
            <Match when={props.kind === "nameplates"}>
              <Trans>16 px are cropped at the top and bottom</Trans>
            </Match>
            <Match when={true}>
              <Trans>Keep at least half of each frame transparent</Trans>
            </Match>
          </Switch>
        </dd>
      </div>
    </SpecList>
  );
}

const Stats = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-sidebar)",
    "& > div": {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      padding: "16px 20px",
      borderInlineStart: "1px solid var(--z-border-subtle)",
    },
    "& > div:first-child": { borderInlineStart: "none" },
    "& strong": {
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
      textAlign: "start",
    },
    "& span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
    "@container (max-width: 760px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      "& > div": {
        padding: "16px",
        borderBlockStart: "1px solid var(--z-border-subtle)",
      },
      "& > div:nth-child(odd)": { borderInlineStart: "none" },
      "& > div:nth-child(-n + 2)": { borderBlockStart: "none" },
      "& > div:last-child": { gridColumn: "1 / -1" },
    },
  },
});

const Section = styled("section", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});

const Tabs = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    overflowX: "auto",
    scrollbarWidth: "none",
    "& button": {
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      height: "44px",
      paddingInline: "12px",
      border: "none",
      borderBlockEnd: "2px solid transparent",
      background: "none",
      font: "inherit",
      fontSize: "14px",
      fontWeight: 500,
      color: "var(--z-fg-secondary)",
      whiteSpace: "nowrap",
      cursor: "pointer",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-2px",
      },
    },
    "& button[aria-selected='true']": {
      fontWeight: 600,
      color: "var(--z-fg-primary)",
      borderBlockEndColor: "var(--z-accent-fill)",
    },
    "& i": {
      fontStyle: "normal",
      fontSize: "12px",
      lineHeight: "20px",
      paddingInline: "8px",
      borderRadius: "var(--z-radius-pill, 999px)",
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-muted)",
    },
  },
});

const Tools = styled("div", {
  base: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" },
});

const Search = styled("label", {
  base: {
    flex: "1 1 240px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "40px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    "&:focus-within": { borderColor: "var(--z-focus)" },
    "& input": {
      flex: 1,
      minWidth: 0,
      height: "100%",
      border: "none",
      outline: "none",
      background: "none",
      font: "inherit",
      fontSize: "14px",
      color: "var(--z-fg-primary)",
      textAlign: "start",
      "&::placeholder": { color: "var(--z-fg-muted)" },
    },
    _phone: { height: "44px", flexBasis: "100%" },
  },
});

const Chips = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    "& button": {
      height: "32px",
      paddingInline: "12px",
      borderRadius: "var(--z-radius-pill, 999px)",
      border: "1px solid var(--z-border-subtle)",
      background: "none",
      font: "inherit",
      fontSize: "13px",
      color: "var(--z-fg-secondary)",
      whiteSpace: "nowrap",
      cursor: "pointer",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      _phone: { height: "44px", paddingInline: "16px" },
    },
    "& button[aria-pressed='true']": {
      borderColor: "var(--z-accent-fill)",
      background: "color-mix(in srgb, var(--z-accent-fill) 14%, transparent)",
      color: "var(--z-accent-text)",
    },
  },
});

const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-sidebar)",
    overflow: "hidden",
  },
});

const columns = "88px minmax(0, 1.6fr) minmax(0, 1fr) 120px 140px auto";

const HeadRow = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: columns,
    gap: "16px",
    alignItems: "center",
    padding: "8px 16px",
    fontSize: "12px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    "@container (max-width: 760px)": { display: "none" },
  },
});

const Row = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: columns,
    gap: "8px 16px",
    alignItems: "center",
    padding: "12px 16px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    "&:first-child, [aria-hidden] + &": { borderBlockStart: "none" },
    "@container (max-width: 760px)": {
      gridTemplateColumns: "64px minmax(0, 1fr) auto",
      gap: "8px 12px",
    },
  },
});

const RowName = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
    minHeight: "44px",
    justifyContent: "center",
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    color: "inherit",
    textAlign: "start",
    cursor: "pointer",
    borderRadius: "var(--z-radius-xs, 6px)",
    "& strong": {
      maxWidth: "100%",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
    },
    "& small": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
    "&:hover strong": { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/** the state under the name where the table has no column for it */
const PhoneStatus = styled("span", {
  base: {
    display: "none",
    "@container (max-width: 760px)": { display: "inline-flex" },
  },
});

const Cell = styled("div", {
  base: {
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
    fontVariantNumeric: "tabular-nums",
    "@container (max-width: 760px)": { display: "none" },
  },
});

const RowActions = styled("div", {
  base: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "4px",
    _phone: { "& button": { minHeight: "44px", minWidth: "44px" } },
  },
});

const RowNote = styled("p", {
  base: {
    gridColumn: "2 / -1",
    margin: 0,
    padding: "8px 12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-raised)",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
    "& b": { fontWeight: 600, color: "var(--z-fg-primary)" },
    "@container (max-width: 760px)": { gridColumn: "1 / -1" },
  },
});

/** a row that is still loading: a tile and two lines */
function Skeleton() {
  return (
    <SkeletonRow>
      <i />
      <span>
        <i />
        <i />
      </span>
    </SkeletonRow>
  );
}

const SkeletonRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 16px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    "&:first-child": { borderBlockStart: "none" },
    "& i": {
      display: "block",
      borderRadius: "var(--z-radius-xs, 6px)",
      background: "var(--z-bg-raised)",
    },
    "& > i": {
      flex: "none",
      width: "88px",
      height: "56px",
      borderRadius: "var(--z-radius, 10px)",
    },
    "& > span": {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    "& > span i:first-child": { width: "30%", height: "14px" },
    "& > span i:last-child": { width: "18%", height: "10px" },
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "48px 24px",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-sidebar)",
    textAlign: "center",
    "--z-icon-color": "var(--z-fg-muted)",
    "& strong": { fontSize: "18px", lineHeight: "26px", fontWeight: 600 },
    "& p": {
      margin: "0 0 8px",
      maxWidth: "44ch",
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
    },
    _phone: { "& button": { minHeight: "44px" } },
  },
});

const Keys = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 20px",
    fontSize: "13px",
    lineHeight: "24px",
    color: "var(--z-fg-muted)",
    "& kbd": {
      fontFamily: "var(--z-font-mono, monospace)",
      fontSize: "12px",
      paddingInline: "6px",
      borderRadius: "var(--z-radius-xs, 6px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-secondary)",
    },
    // a phone has no keys to press
    _phone: { display: "none" },
  },
});

const SpecsBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& > p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const SpecCard = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-border-subtle)",
    "& header": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
    },
    "& header strong": { fontSize: "15px", fontWeight: 600 },
    _phone: { "& button": { minHeight: "44px" } },
  },
});
