import { For, JSX, Show, createEffect, createSignal, on } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { chip } from "./ProfileCard";

const GAP = 6;
/** Room the +N more chip takes in any language */
const MORE_WIDTH = 64;

/**
 * Chips on one row, never a second one. What does not fit folds behind
 * +N more on that same row, which opens the rest in place. Links and roles
 * both draw through this.
 */
export function ProfileChipRow<T>(props: {
  items: T[];
  children: (item: T) => JSX.Element;
}) {
  const [fit, setFit] = createSignal<number>();
  const [open, setOpen] = createSignal(false);
  const shown = () => {
    const limit = fit();
    return open() || limit === undefined
      ? props.items
      : props.items.slice(0, limit);
  };
  const hidden = () => props.items.length - shown().length;
  let list: HTMLUListElement | undefined;

  function measure() {
    if (!list) return;
    const room = list.clientWidth;
    const widths = ([...list.children] as HTMLElement[]).map(
      (item) => item.offsetWidth,
    );
    const total = widths.reduce((sum, width) => sum + width + GAP, -GAP);
    if (total <= room) return;
    let used = 0;
    let count = 0;
    for (const width of widths) {
      if (used + width + GAP + MORE_WIDTH > room) break;
      used += width + GAP;
      count++;
    }
    setFit(Math.max(count, 1));
  }

  createEffect(
    on(
      () => props.items,
      () => {
        setFit(undefined);
        setOpen(false);
        requestAnimationFrame(measure);
      },
    ),
  );

  return (
    <Row ref={list} data-open={open() || undefined}>
      <For each={shown()}>{(item) => <li>{props.children(item)}</li>}</For>
      <Show when={hidden() > 0}>
        <li>
          <button
            class={chip({ press: true })}
            type="button"
            onClick={() => setOpen(true)}
          >
            <span>
              <Trans>+{hidden()} more</Trans>
            </span>
          </button>
        </li>
      </Show>
    </Row>
  );
}

const Row = styled("ul", {
  base: {
    listStyle: "none",
    marginInline: 0,
    paddingInline: 0,
    display: "flex",
    flexWrap: "nowrap",
    gap: "6px",
    minWidth: 0,
    overflow: "hidden",
    // room inside the clip for the focus ring of a chip
    paddingBlock: "4px",
    marginBlock: "-4px",
    "& li": { flex: "0 0 auto", minWidth: 0, maxWidth: "100%" },
    "&[data-open]": { flexWrap: "wrap", overflow: "visible" },
  },
});
