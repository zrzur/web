import { Trans, useLingui } from "@lingui/solid/macro";
import { useState } from "@revolt/state";
import { loaded, useDevice } from "@revolt/common";
import { Icon } from "@revolt/ui/icons/Icon";
import { useInfiniteQuery, useQuery } from "@tanstack/solid-query";
import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

import { CompositionMediaPickerContext } from "./CompositionMediaPicker";
import {
  type KlipyGif,
  klipyCategories,
  klipyEnabled,
  klipyGifs,
  previewOf,
  mediaSrc,
  sendUrlOf,
  stillOf,
  videoOf,
} from "./klipy";

/**
 * GIF picker backed by KLIPY: category tiles first, then trending or
 * search results in two balanced columns, loading more while you scroll.
 */
export function GifPicker() {
  const state = useState();
  const { isMobile } = useDevice();
  const { t, i18n } = useLingui();
  const { onMessage } = useContext(CompositionMediaPickerContext);

  const [filter, setFilter] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [trending, setTrending] = createSignal(false);
  const browsing = () => !query() && !trending();
  const locale = () => i18n().locale.split(/[-_]/)[0] || "en";
  // our own session token only proves who is asking our GIF service; it is
  // never passed on to KLIPY (the service sends a random per-process id)
  const auth = () => ({ token: state.auth.getSession()?.token });
  let scroller: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;

  createEffect(() => {
    const value = filter().trim();
    const timer = setTimeout(() => setQuery(value), 300);
    onCleanup(() => clearTimeout(timer));
  });
  createEffect(() => {
    query();
    trending();
    if (scroller) scroller.scrollTop = 0;
  });

  const categories = useQuery(() => ({
    queryKey: ["klipy", "categories", locale()],
    enabled: klipyEnabled() && browsing(),
    queryFn: ({ signal }) => klipyCategories(locale(), auth(), signal),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  }));

  // one trending GIF gives the "Trending GIFs" tile its picture
  const trendingCover = useQuery(() => ({
    queryKey: ["klipy", "cover", locale()],
    enabled: klipyEnabled() && browsing(),
    queryFn: ({ signal }) =>
      klipyGifs({ query: "", page: 1, locale: locale() }, auth(), signal),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  }));

  const coverUrl = () => {
    const first = loaded(trendingCover)?.data?.[0];
    return first ? mediaSrc(previewOf(first)) : undefined;
  };

  const results = useInfiniteQuery(() => ({
    queryKey: ["klipy", "gifs", locale(), query()],
    enabled: klipyEnabled() && !browsing(),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      klipyGifs(
        {
          query: query(),
          page: pageParam,
          locale: locale(),
        },
        auth(),
        signal,
      ),
    getNextPageParam: (last) =>
      last.has_next ? last.current_page + 1 : undefined,
    retry: false,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  }));

  const gifs = createMemo(() =>
    (loaded(results)?.pages ?? []).flatMap((page) => page.data ?? []),
  );

  /** Two columns, each GIF goes to the shorter one so order reads naturally */
  const columns = createMemo(() => {
    const cols: [KlipyGif[], KlipyGif[]] = [[], []];
    const heights = [0, 0];
    for (const gif of gifs()) {
      const media = previewOf(gif);
      if (!media) continue;
      const side = heights[0] <= heights[1] ? 0 : 1;
      cols[side].push(gif);
      heights[side] += media.height / Math.max(1, media.width);
    }
    return cols;
  });

  const loading = () =>
    browsing() ? categories.isFetching : results.isLoading;
  const error = () => (browsing() ? categories.isError : results.isError);

  function reset() {
    setFilter("");
    setQuery("");
    setTrending(false);
    input?.focus();
  }

  function send(gif: KlipyGif) {
    const url = sendUrlOf(gif);
    if (!url) return;
    onMessage(url);
  }

  return (
    <section
      class="z-gif-picker"
      data-unavailable={!klipyEnabled()}
      aria-label={t`GIF picker`}
    >
      <div class="z-picker-search">
        <Show
          when={!browsing()}
          fallback={<Icon name="magnifying-glass" size={18} />}
        >
          <button
            type="button"
            class="z-picker-icon-button"
            aria-label={t`Back to categories`}
            onClick={reset}
          >
            <Icon name="arrow-left" size={18} />
          </button>
        </Show>
        {/* KLIPY requires this exact placeholder */}
        <input
          ref={input}
          type="search"
          aria-label={t`Search KLIPY`}
          placeholder={t`Search KLIPY`}
          autocomplete="off"
          spellcheck={false}
          autofocus={!isMobile}
          disabled={!klipyEnabled()}
          value={filter()}
          onInput={(e) => {
            setTrending(false);
            setFilter(e.currentTarget.value);
          }}
        />
        <Show when={filter()}>
          <button
            type="button"
            class="z-picker-icon-button"
            aria-label={t`Clear search`}
            onClick={reset}
          >
            <Icon name="x" size={16} />
          </button>
        </Show>
      </div>

      <div
        class="z-picker-scroll"
        ref={scroller}
        aria-busy={klipyEnabled() && loading()}
      >
        <Switch>
          <Match when={!klipyEnabled()}>
            <PickerState
              icon="gif"
              title={<Trans>GIFs aren't available yet</Trans>}
            >
              <Trans>You can still send emoji in the meantime.</Trans>
            </PickerState>
          </Match>
          <Match when={loading()}>
            <div class="z-gif-grid" role="status" aria-label={t`Loading GIFs`}>
              <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
                {() => <div class="z-gif-skeleton" />}
              </For>
            </div>
          </Match>
          <Match when={error()}>
            <PickerState
              icon="arrow-clockwise"
              title={<Trans>Couldn't load GIFs</Trans>}
            >
              <Trans>
                The GIF service couldn't be reached. Please try again.
              </Trans>
              <button
                type="button"
                class="z-picker-action"
                onClick={() =>
                  browsing() ? categories.refetch() : results.refetch()
                }
              >
                <Trans>Try again</Trans>
              </button>
            </PickerState>
          </Match>
          <Match when={browsing()}>
            <div class="z-gif-grid">
              <CategoryTile
                label={<Trans>Trending GIFs</Trans>}
                image={coverUrl()}
                onClick={() => setTrending(true)}
              />
              <For each={loaded(categories)}>
                {(category) => (
                  <CategoryTile
                    label={category.category}
                    image={mediaSrc({ src: category.preview_src })}
                    onClick={() => {
                      setFilter(category.query);
                      setQuery(category.query);
                    }}
                  />
                )}
              </For>
            </div>
          </Match>
          <Match when={!gifs().length}>
            <PickerState
              icon="magnifying-glass"
              title={<Trans>No GIFs found</Trans>}
            >
              <Trans>Try a different word or explore the categories.</Trans>
              <button type="button" class="z-picker-action" onClick={reset}>
                <Trans>Browse categories</Trans>
              </button>
            </PickerState>
          </Match>
          <Match when={gifs().length}>
            <div class="z-gif-columns">
              <For each={columns()}>
                {(column) => (
                  <div class="z-gif-column">
                    <For each={column}>
                      {(gif) => (
                        <GifTile gif={gif} onSelect={() => send(gif)} />
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
            <Show when={results.hasNextPage}>
              <LoadMore
                root={scroller}
                busy={results.isFetchingNextPage}
                onVisible={() => results.fetchNextPage()}
              />
            </Show>
          </Match>
        </Switch>
      </div>

      <Show when={klipyEnabled()}>
        <footer class="z-gif-attribution">Powered by KLIPY</footer>
      </Show>
    </section>
  );
}

function CategoryTile(props: {
  label: JSX.Element;
  image?: string;
  onClick: () => void;
}) {
  const [failed, setFailed] = createSignal(false);
  return (
    <button
      type="button"
      class="z-gif-category"
      onClick={() => props.onClick()}
    >
      <Show when={props.image && !failed()}>
        <img
          src={props.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </Show>
      <span>{props.label}</span>
    </button>
  );
}

/** Asks for the next page once the end of the list scrolls into view */
function LoadMore(props: {
  root?: HTMLElement;
  busy: boolean;
  onVisible: () => void;
}) {
  let sentinel: HTMLDivElement | undefined;
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !props.busy) props.onVisible();
      },
      { root: props.root, rootMargin: "240px" },
    );
    if (sentinel) observer.observe(sentinel);
    onCleanup(() => observer.disconnect());
  });
  return (
    <div ref={sentinel} class="z-gif-more" aria-hidden="true">
      <Show when={props.busy}>
        <div class="z-gif-skeleton" />
      </Show>
    </div>
  );
}

function PickerState(props: {
  icon: "gif" | "magnifying-glass" | "arrow-clockwise";
  title: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div class="z-picker-state" role="status">
      <div class="z-picker-state-icon">
        <Icon name={props.icon} size={30} />
      </div>
      <strong>{props.title}</strong>
      <div class="z-picker-state-body">{props.children}</div>
    </div>
  );
}

/**
 * A still JPG (a few KB) shows at once; the small MP4 loads and plays only
 * while the tile is on screen, unless the user prefers reduced motion.
 */
function GifTile(props: { gif: KlipyGif; onSelect: () => void }) {
  const { t } = useLingui();
  const [failed, setFailed] = createSignal(false);
  const [visible, setVisible] = createSignal(false);
  const media = () => previewOf(props.gif);
  const video = () => videoOf(props.gif);
  const still = () => stillOf(props.gif);
  // only signed links on our GIF service; a missing preview shows the fallback
  const imageSrc = () => mediaSrc(still() ?? media());
  const videoSrc = () => mediaSrc(video());
  const stillSrc = () => mediaSrc(still());
  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let tile: HTMLButtonElement | undefined;
  onMount(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { root: tile?.closest(".z-picker-scroll"), rootMargin: "120px" },
    );
    if (tile) observer.observe(tile);
    onCleanup(() => observer.disconnect());
  });
  return (
    <button
      ref={tile}
      type="button"
      class="z-gif-tile"
      aria-label={props.gif.title || t`Send GIF`}
      title={props.gif.title}
      onClick={() => props.onSelect()}
      style={{
        "aspect-ratio": `${media()?.width ?? 1} / ${media()?.height ?? 1}`,
      }}
    >
      <Show
        when={!failed() && imageSrc()}
        fallback={
          <span class="z-gif-preview-failed">
            <Icon name="gif" size={28} />
          </span>
        }
      >
        <Show
          when={videoSrc() && stillSrc() && !reduceMotion}
          fallback={
            <img
              src={imageSrc()}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          }
        >
          <video
            poster={stillSrc()}
            src={visible() ? videoSrc() : undefined}
            autoplay
            muted
            loop
            playsinline
            preload="none"
            onError={() => setFailed(true)}
          />
        </Show>
      </Show>
    </button>
  );
}
