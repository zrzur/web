import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar, Dialog, Segmented } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { searchChannels, searchPeople } from "./SearchBox";
import {
  addFilter,
  dayValue,
  removeFilter,
  removeKey,
  searchScope,
  searchSort,
  setSearchScope,
  setSearchSort,
} from "./searchChoices";
import { useSearchLabels } from "./searchLabels";
import { type HasValue, HAS_VALUES, parseSearch } from "./searchSyntax";

/**
 * Phones: the filters of the message search, picked instead of typed
 * (owner, 2026-11-18: the switches and the list of filter words filled the
 * middle of the page). A button at the end of the search field's row opens
 * a sheet:
 *
 *  Filter results
 *  Where          [ This channel | Whole server ]
 *  Order          [ Relevance | Latest | Oldest ]
 *  Has            (Link) (File) (Image) (Video) (Embed) (Sound)
 *  From a member                      >
 *  In a channel                       >
 *  On a day       (Today) (Yesterday)
 *  [ Show results ]
 *
 * A choice is written into the search field as the filter one could type
 * (`has:image`), so both ways stay one thing; the page shows it as a chip.
 */
export function SearchFilterButton(props: {
  channel: Channel;
  query: string;
  onQuery: (query: string) => void;
}) {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);

  const chosen = () =>
    parseSearch(props.query).tokens.some((token) => token.value) ||
    (!!props.channel.server && searchScope() === "server") ||
    searchSort() !== "Latest";

  return (
    <>
      <Open
        type="button"
        data-search-filters-open
        data-active={chosen()}
        aria-label={t`Filter results`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="funnel" size={22} />
      </Open>
      <Dialog
        show={open()}
        onClose={() => setOpen(false)}
        appearance="creation"
        size="sm"
        title={<Trans>Filter results</Trans>}
        actions={[
          {
            text: <Trans>Show results</Trans>,
            onClick: () => setOpen(false),
          },
        ]}
      >
        <Show when={open()}>
          <Filters
            channel={props.channel}
            query={props.query}
            onQuery={props.onQuery}
          />
        </Show>
      </Dialog>
    </>
  );
}

function Filters(props: {
  channel: Channel;
  query: string;
  onQuery: (query: string) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const labels = useSearchLabels();
  /** which list is open inside the sheet */
  const [picking, setPicking] = createSignal<"from" | "in">();
  const [find, setFind] = createSignal("");

  const tokens = createMemo(() => parseSearch(props.query).tokens);
  const has = (value: HasValue) =>
    tokens().some((token) => token.key === "has" && token.value === value);
  const day = () => tokens().find((token) => token.key === "during")?.value;

  const people = createMemo(() => {
    const wanted = find().trim().toLowerCase();
    return searchPeople(props.channel, client())
      .filter(
        (person) =>
          !wanted ||
          person.name.toLowerCase().includes(wanted) ||
          (person.username ?? "").toLowerCase().includes(wanted),
      )
      .slice(0, 40);
  });
  const channels = createMemo(() => {
    const wanted = find().trim().toLowerCase();
    return searchChannels(props.channel)
      .filter(
        (channel) => !wanted || channel.name.toLowerCase().includes(wanted),
      )
      .slice(0, 40);
  });

  const pick = (key: "from" | "in", value: string) => {
    props.onQuery(addFilter(props.query, key, value));
    setPicking(undefined);
    setFind("");
  };

  return (
    <Body data-search-filters>
      <Show
        when={!picking()}
        fallback={
          <>
            <Back type="button" onClick={() => setPicking(undefined)}>
              <Icon name="arrow-left" size={20} />
              <span>
                <Show
                  when={picking() === "from"}
                  fallback={<Trans>In a channel</Trans>}
                >
                  <Trans>From a member</Trans>
                </Show>
              </span>
            </Back>
            <Find>
              <Icon name="magnifying-glass" size={20} />
              <input
                type="text"
                value={find()}
                placeholder={
                  picking() === "from" ? t`Find a member` : t`Find a channel`
                }
                aria-label={
                  picking() === "from" ? t`Find a member` : t`Find a channel`
                }
                onInput={(event) => setFind(event.currentTarget.value)}
              />
            </Find>
            <List>
              <Show
                when={picking() === "from"}
                fallback={
                  <For each={channels()}>
                    {(channel) => (
                      <Item
                        type="button"
                        data-choice
                        onClick={() => pick("in", channel.name)}
                      >
                        <Icon name="hash" size={20} />
                        <bdi>{channel.name}</bdi>
                      </Item>
                    )}
                  </For>
                }
              >
                <For each={people()}>
                  {(person) => (
                    <Item
                      type="button"
                      data-choice
                      onClick={() =>
                        pick("from", person.username ?? person.name)
                      }
                    >
                      <Avatar
                        size={28}
                        src={person.avatar}
                        fallback={person.name}
                      />
                      <bdi>{person.name}</bdi>
                    </Item>
                  )}
                </For>
              </Show>
            </List>
          </>
        }
      >
        <Show when={props.channel.server}>
          <Label>
            <Trans>Where to search</Trans>
          </Label>
          <Segmented
            aria-label={t`Where to search`}
            value={searchScope()}
            onChange={(value) => setSearchScope(value)}
            options={[
              { value: "channel", label: <Trans>This channel</Trans> },
              { value: "server", label: <Trans>Whole server</Trans> },
            ]}
          />
        </Show>

        <Label>
          <Trans>Sort results</Trans>
        </Label>
        <Segmented
          aria-label={t`Sort results`}
          value={searchSort()}
          onChange={(value) => setSearchSort(value)}
          options={[
            { value: "Relevance", label: <Trans>Relevance</Trans> },
            { value: "Latest", label: <Trans>Latest</Trans> },
            { value: "Oldest", label: <Trans>Oldest</Trans> },
          ]}
        />

        <Label>{labels.key("has")}</Label>
        <Picks>
          <For each={HAS_VALUES}>
            {(value) => (
              <Pick
                type="button"
                data-has={value}
                aria-pressed={has(value)}
                onClick={() =>
                  props.onQuery(
                    has(value)
                      ? removeFilter(props.query, "has", value)
                      : addFilter(props.query, "has", value),
                  )
                }
              >
                {labels.has(value)}
              </Pick>
            )}
          </For>
        </Picks>

        <Rows>
          <RowButton
            type="button"
            data-pick="from"
            onClick={() => setPicking("from")}
          >
            <Icon name="user" size={22} />
            <span>
              <Trans>From a member</Trans>
            </span>
            <Icon name="caret-right" size={16} />
          </RowButton>
          <Show when={props.channel.server}>
            <RowButton
              type="button"
              data-pick="in"
              onClick={() => {
                // a channel of the server: the search then covers the server
                setSearchScope("server");
                setPicking("in");
              }}
            >
              <Icon name="hash" size={22} />
              <span>
                <Trans>In a channel</Trans>
              </span>
              <Icon name="caret-right" size={16} />
            </RowButton>
          </Show>
        </Rows>

        <Label data-pick="during">
          <Trans>On a day</Trans>
        </Label>
        <Picks>
          <For each={[0, 1]}>
            {(ago) => (
              <Pick
                type="button"
                data-day={ago}
                aria-pressed={day() === dayValue(ago)}
                onClick={() => {
                  const without = removeKey(props.query, "during");
                  props.onQuery(
                    day() === dayValue(ago)
                      ? without
                      : addFilter(without, "during", dayValue(ago)),
                  );
                }}
              >
                {ago === 0 ? <Trans>Today</Trans> : <Trans>Yesterday</Trans>}
              </Pick>
            )}
          </For>
        </Picks>
      </Show>
    </Body>
  );
}

/** one fill for every box, as everywhere on phones */
const FILL =
  "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))";

/** the button beside the search field: the field's height, marked when in use */
const Open = styled("button", {
  base: {
    flex: "none",
    display: "grid",
    placeItems: "center",
    width: "44px",
    height: "44px",
    border: "none",
    borderRadius: "12px",
    background: "none",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    "&[data-active='true']": {
      color: "var(--z-accent-text, var(--z-accent))",
      background: "color-mix(in srgb, var(--z-accent) 14%, transparent)",
    },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "var(--z-fg-primary)",
    // the two switches take the look of every box on a phone: filled, no frame
    "& [role='radiogroup']": {
      border: "none",
      borderRadius: "12px",
      boxShadow: "none",
      background: FILL,
    },
  },
});

const Label = styled("div", {
  base: {
    paddingInline: "2px",
    marginBlockStart: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const Picks = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const Pick = styled("button", {
  base: {
    minHeight: "40px",
    paddingInline: "16px",
    border: "none",
    borderRadius: "20px",
    background: FILL,
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    "&[aria-pressed='true']": {
      color: "var(--z-fg-primary)",
      fontWeight: 600,
      background: "var(--z-nav-selected)",
      boxShadow: "inset 0 0 0 1px var(--z-border-strong)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});

const Rows = styled("div", {
  base: {
    marginBlockStart: "8px",
    borderRadius: "14px",
    overflow: "hidden",
    background: FILL,
    "& > * + *": {
      borderTop: "1px solid var(--z-float-divider, var(--z-border-subtle))",
    },
  },
});

const RowButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    width: "100%",
    minHeight: "52px",
    padding: "8px 14px",
    border: "none",
    background: "none",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "16px",
    fontWeight: 500,
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-neutral)",
    "& > span:not(.z-icon)": { flex: 1, minWidth: 0, textAlign: "start" },
    "& > :last-child": { "--z-icon-color": "var(--z-icon-muted)" },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
  },
});

const Back = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "44px",
    padding: 0,
    border: "none",
    background: "none",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-neutral)",
  },
});

const Find = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "44px",
    paddingInline: "12px",
    borderRadius: "12px",
    background: FILL,
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    "& input": {
      flex: 1,
      minWidth: 0,
      height: "100%",
      border: "none",
      outline: "none",
      background: "none",
      color: "var(--z-fg-primary)",
      font: "inherit",
    },
    "&:focus-within": { boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

const List = styled("div", {
  base: {
    borderRadius: "14px",
    overflow: "hidden",
    background: FILL,
    "&:empty": { display: "none" },
  },
});

const Item = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    minHeight: "48px",
    padding: "6px 14px",
    border: "none",
    background: "none",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "16px",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-neutral)",
    "& bdi": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& + &": {
      borderTop: "1px solid var(--z-float-divider, var(--z-border-subtle))",
    },
    _active: {
      background: "color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
    },
  },
});
