import { Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { Dialog } from "@revolt/ui";
import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";
import { Icon } from "@revolt/ui/icons/Icon";

import { searchScope, searchSort } from "./searchChoices";
import { parseSearch } from "./searchSyntax";

// The sheet loads the first time it opens: kept out of the files the app
// installs up front (scripts/precacheShell.mjs). A file that does not arrive
// is asked for again; if it still fails the sheet stays empty and the
// search field still takes typed filters
const Filters = lazyRetry(
  () => import("./SearchFiltersSheet").then((m) => ({ default: m.Filters })),
  () => null,
);

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
