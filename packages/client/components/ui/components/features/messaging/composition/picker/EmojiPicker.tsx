import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { CustomEmoji, UnicodeEmoji } from "@revolt/markdown/emoji";
import {
  UNICODE_EMOJI_PACK_PUA,
  UNICODE_ZWNJ,
  isEmojiPackAvailable,
  isRegionalIndicator,
  unicodeEmojiUrl,
} from "@revolt/markdown/emoji/UnicodeEmoji";
import { useModals } from "@revolt/modal";
import { useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui/components/design";
import { searchEmoji } from "@revolt/ui/emojis";
import { Icon } from "@revolt/ui/icons/Icon";

import { CompositionMediaPickerContext } from "./CompositionMediaPicker";
import { EMOJI_CATEGORIES, EmojiCategoryId } from "./emojiSections";

/** A cell in the grid: a server's custom emoji or a Unicode emoji */
type Entry =
  | { kind: "custom"; id: string; name: string }
  | { kind: "unicode"; text: string; name: string };

type HeadingRow = { kind: "heading"; title: string; server?: Server };
type CellsRow = { kind: "cells"; entries: Entry[] };
/** one fixed-height line of the virtual list */
type Row = { kind: "tip" } | HeadingRow | CellsRow;

/** Fingers: cells and rows are 44 px (mobile-design-rules, section 1) */
const COARSE =
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
/** Height of every row in the list, in px */
const ROW = COARSE ? 44 : 40;
/** Narrowest an emoji cell gets, in px */
const CELL = COARSE ? 44 : 36;
/** Rows rendered above and below the visible area */
const OVERSCAN = 4;

const keyOf = (entry: Entry) =>
  entry.kind === "custom" ? `c:${entry.id}` : `u:${entry.text}`;

/** Search results are capped so typing never builds thousands of cells */
const SEARCH_LIMIT = 120;

const FAVOURITES_KEY = "zrzur:emoji-favourites";

function loadFavourites(): Entry[] {
  try {
    const list = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Emoji picker: favourites, each server's custom emoji, then every
 * standard emoji by category. Only emoji
 * that have an image in the chosen pack are offered, so nothing shows up
 * blank. Images load lazily and off-screen sections skip layout, so opening
 * it stays instant.
 */
export function EmojiPicker() {
  const client = useClient();
  const { ordering, settings } = useState();
  const { isMobile } = useDevice();
  const { openModal } = useModals();
  const params = useSmartParams();
  const { t } = useLingui();
  const { onTextReplacement } = useContext(CompositionMediaPickerContext);

  const [filter, setFilter] = createSignal("");
  const [favourites, setFavourites] = createSignal(loadFavourites());
  let scroller: HTMLDivElement | undefined;

  const pack = () => settings.getValue("appearance:unicode_emoji");

  /** whether this emoji has an image in the chosen pack */
  const drawable = (text: string) =>
    pack() === "system" ||
    !isEmojiPackAvailable(pack()!) ||
    unicodeEmojiUrl(pack(), text) !== "";

  const categories = createMemo(() =>
    EMOJI_CATEGORIES.map((category) => ({
      id: category.id,
      entries: category.emoji
        .filter((emoji) => drawable(emoji.emoji))
        .map((emoji) => ({
          kind: "unicode" as const,
          text: emoji.emoji,
          name: emoji.shorthands[0],
        })),
    })).filter((category) => category.entries.length),
  );

  const categoryTitle = (id: EmojiCategoryId) =>
    ({
      people: t`Smileys & people`,
      nature: t`Animals & nature`,
      food: t`Food & drink`,
      travel: t`Travel & places`,
      activities: t`Activities`,
      objects: t`Objects`,
      symbols: t`Symbols`,
      flags: t`Flags`,
    })[id];

  const servers = createMemo(() =>
    ordering.orderedServers(client()).filter((s) => s.emojis.length > 0),
  );

  /** The server you're in, if you may add emoji to it */
  const manageable = () => {
    const server = params().serverId
      ? client().servers.get(params().serverId!)
      : undefined;
    return server?.havePermission("ManageCustomisation") ? server : undefined;
  };

  const results = createMemo(() => {
    const needle = filter().trim().toLowerCase();
    if (!needle) return [];
    const list: Entry[] = [];
    for (const server of servers())
      for (const emoji of server.emojis)
        if (emoji.name.toLowerCase().includes(needle))
          list.push({ kind: "custom", id: emoji.id, name: emoji.name });
    for (const emoji of searchEmoji(needle)) {
      if (list.length >= SEARCH_LIMIT) break;
      if (!drawable(emoji.emoji)) continue;
      list.push({
        kind: "unicode",
        text: emoji.emoji,
        name: emoji.shorthands[0],
      });
    }
    return list.slice(0, SEARCH_LIMIT);
  });

  function insert(entry: Entry) {
    if (entry.kind === "custom") {
      onTextReplacement(`:${entry.id}:`);
    } else {
      onTextReplacement(
        `${UNICODE_EMOJI_PACK_PUA[pack()!] ?? ""}${isRegionalIndicator(entry.text) ? UNICODE_ZWNJ + entry.text : entry.text}`,
      );
    }
  }

  function toggleFavourite(entry: Entry) {
    const key = keyOf(entry);
    const next = favourites().some((f) => keyOf(f) === key)
      ? favourites().filter((f) => keyOf(f) !== key)
      : [entry, ...favourites()].slice(0, 32);
    setFavourites(next);
    try {
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
    } catch {
      // favourites just won't persist (private window, blocked storage)
    }
  }

  const Cell = (props: { entry: Entry }) => (
    <button
      type="button"
      class="z-emoji-cell"
      title={`:${props.entry.name}:`}
      aria-label={props.entry.name}
      onClick={() => insert(props.entry)}
      onContextMenu={(e) => {
        e.preventDefault();
        toggleFavourite(props.entry);
      }}
    >
      {props.entry.kind === "custom" ? (
        <CustomEmoji id={props.entry.id} />
      ) : (
        <UnicodeEmoji emoji={props.entry.text} pack={pack()} />
      )}
    </button>
  );

  // The full list is ~1,600 emoji. Rendering them all at once made the
  // picker slow to open and flooded the network with image requests, so
  // only the rows on screen (plus a few either side) exist in the DOM.
  const [scrollTop, setScrollTop] = createSignal(0);
  const [viewport, setViewport] = createSignal(320);
  const [columns, setColumns] = createSignal(9);

  onMount(() => {
    if (!scroller) return;
    const measure = () => {
      setViewport(scroller!.clientHeight);
      setColumns(Math.max(1, Math.floor((scroller!.clientWidth - 12) / CELL)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    onCleanup(() => observer.disconnect());
  });

  /** every section flattened into fixed-height rows: a heading, then cells */
  const rows = createMemo(() => {
    const list: Row[] = [{ kind: "tip" }];
    const add = (heading: Omit<HeadingRow, "kind">, entries: Entry[]) => {
      if (!entries.length) return;
      list.push({ kind: "heading", ...heading });
      for (let i = 0; i < entries.length; i += columns())
        list.push({ kind: "cells", entries: entries.slice(i, i + columns()) });
    };
    add({ title: t`Favorites` }, favourites());
    for (const server of servers())
      add(
        { title: server.name, server },
        server.emojis.map((emoji) => ({
          kind: "custom" as const,
          id: emoji.id,
          name: emoji.name,
        })),
      );
    for (const category of categories())
      add({ title: categoryTitle(category.id) }, category.entries);
    return list;
  });

  const visibleRows = createMemo(() => {
    const first = Math.max(0, Math.floor(scrollTop() / ROW) - OVERSCAN);
    const last = Math.min(
      rows().length,
      Math.ceil((scrollTop() + viewport()) / ROW) + OVERSCAN,
    );
    const all = rows();
    const out: { row: Row; index: number }[] = [];
    for (let i = first; i < last; i++) out.push({ row: all[i], index: i });
    return out;
  });

  /** the section whose rows are at the top, shown as a pinned title */
  const pinnedHeading = createMemo(() => {
    const top = Math.floor(scrollTop() / ROW);
    const all = rows();
    for (let i = Math.min(top, all.length - 1); i >= 0; i--)
      if (all[i].kind === "heading") return all[i] as HeadingRow;
    return undefined;
  });

  const Heading = (props: { row: HeadingRow }) => (
    <h3 class="z-emoji-heading">
      <Show when={props.row.server}>
        <Avatar
          size={16}
          src={props.row.server!.animatedIconURL}
          fallback={props.row.server!.name}
        />
      </Show>
      <span>{props.row.title}</span>
    </h3>
  );

  return (
    <div class="z-emoji-picker">
      <div class="z-emoji-top">
        <div class="z-picker-search">
          <input
            type="search"
            autofocus={!isMobile}
            aria-label={t`Find the perfect emoji`}
            placeholder={t`Find the perfect emoji`}
            autocomplete="off"
            spellcheck={false}
            value={filter()}
            onInput={(e) => {
              setFilter(e.currentTarget.value);
              if (scroller) scroller.scrollTop = 0;
            }}
          />
          <Show
            when={filter()}
            fallback={<Icon name="magnifying-glass" size={18} />}
          >
            <button
              type="button"
              class="z-picker-icon-button"
              aria-label={t`Clear search`}
              onClick={() => setFilter("")}
            >
              <Icon name="x" size={16} />
            </button>
          </Show>
        </div>
        <Show when={manageable()}>
          {(server) => (
            <button
              type="button"
              class="z-emoji-add"
              title={t`Add emoji to this server`}
              aria-label={t`Add emoji to this server`}
              onClick={() =>
                openModal({
                  type: "settings",
                  config: "server",
                  context: server(),
                })
              }
            >
              <Icon name="plus" size={18} />
            </button>
          )}
        </Show>
      </div>

      <div
        ref={scroller}
        class="z-emoji-results"
        aria-label={t`Emoji results`}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <Show
          when={filter().trim()}
          fallback={
            <>
              <div class="z-emoji-pinned" aria-hidden="true">
                <Show when={scrollTop() > ROW && pinnedHeading()}>
                  {(row) => <Heading row={row()} />}
                </Show>
              </div>
              <div
                class="z-emoji-virtual"
                style={{ height: `${rows().length * ROW}px` }}
              >
                <For each={visibleRows()}>
                  {(item) => (
                    <div
                      class="z-emoji-row"
                      style={{
                        transform: `translateY(${item.index * ROW}px)`,
                        "grid-template-columns": `repeat(${columns()}, 1fr)`,
                      }}
                    >
                      <Switch>
                        <Match when={item.row.kind === "tip"}>
                          <p class="z-emoji-tip">
                            <Trans>
                              Tip: right-click (or hold) any emoji to add it to
                              your favorites.
                            </Trans>
                          </p>
                        </Match>
                        <Match when={item.row.kind === "heading"}>
                          <Heading row={item.row as HeadingRow} />
                        </Match>
                        <Match when={item.row.kind === "cells"}>
                          <For each={(item.row as CellsRow).entries}>
                            {(entry) => <Cell entry={entry} />}
                          </For>
                        </Match>
                      </Switch>
                    </div>
                  )}
                </For>
              </div>
            </>
          }
        >
          <Show
            when={results().length}
            fallback={
              <div class="z-picker-state" role="status">
                <strong>
                  <Trans>No emoji found</Trans>
                </strong>
                <span>
                  <Trans>Try another search.</Trans>
                </span>
              </div>
            }
          >
            <div class="z-emoji-grid z-emoji-grid--search">
              <For each={results()}>{(entry) => <Cell entry={entry} />}</For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
