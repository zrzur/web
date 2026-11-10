import {
  Match,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
} from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Button } from "@revolt/ui";
import { FlockDots } from "@revolt/ui/components/design/FlockDots";

import { type MoreState, PAGE_TILES, moreState, needsMore } from "./gallery";

/**
 * One page of a long list at a time. Pages come only when asked for, so the
 * list never grows under the reader while they scroll; the next page from
 * the server is asked for one press ahead. A new list (another filter, a
 * search, another sort) starts again from one page.
 */
export function usePaged<T>(
  list: () => T[],
  options: {
    /** what tells one list from another: the first item's key */
    key: (item: T) => string;
    /** the server holds more than is loaded */
    more?: () => boolean;
    loading?: () => boolean;
    /** fetch the next page from the server */
    onMore?: () => void;
    page?: number;
  },
) {
  const page = options.page ?? PAGE_TILES;
  const [visible, setVisible] = createSignal(page);
  const first = () => {
    const head = list()[0];
    return head === undefined ? undefined : options.key(head);
  };
  createEffect(
    on([first, () => list().length], ([key, length], before) => {
      if (!before) return;
      if (key !== before[0] || length < before[1]) setVisible(page);
    }),
  );
  const shown = createMemo(() => list().slice(0, visible()));
  const state = (): MoreState =>
    moreState(
      visible(),
      list().length,
      !!options.more?.(),
      !!options.loading?.(),
      page,
    );
  return {
    shown,
    state,
    next() {
      if (state() !== "more") return;
      const now = visible() + page;
      setVisible(now);
      if (
        needsMore(
          now,
          list().length,
          !!options.more?.(),
          !!options.loading?.(),
          page,
        )
      )
        options.onMore?.();
    },
  };
}

/**
 * The foot of a paged list: "Show more", the same button waiting while the
 * next page is on its way, or one plain line at the end. New items go in
 * above it, so the page stays where the reader left it.
 */
export function ShowMore(props: { state: MoreState; onMore: () => void }) {
  return (
    <Foot
      data-show-more={props.state}
      aria-busy={props.state === "loading" || undefined}
    >
      <Switch>
        <Match when={props.state === "more" || props.state === "loading"}>
          <Button
            size="lg"
            variant="tonal"
            isDisabled={props.state === "loading"}
            onPress={() => props.onMore()}
          >
            <Switch fallback={<Trans>Show more</Trans>}>
              <Match when={props.state === "loading"}>
                <FlockDots moving />
                <Trans>Loading…</Trans>
              </Match>
            </Switch>
          </Button>
        </Match>
        <Match when={props.state === "end"}>
          <p role="status">
            <Trans>That's everything for now.</Trans>
          </p>
        </Match>
      </Switch>
    </Foot>
  );
}

const Foot = styled("div", {
  base: {
    display: "flex",
    justifyContent: "center",
    paddingBlock: "24px 8px",
    // the list grows above: the browser keeps the page where it was
    overflowAnchor: "none",
    "&[data-show-more='none']": { display: "none" },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
    "& button": { minWidth: "160px" },
  },
});
