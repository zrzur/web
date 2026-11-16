import { For, Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { Embed, IconButton } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { canRemoveLinkPreviews, shownEmbeds } from "./linkPreviews";

/**
 * A message's embeds. Link previews get an X in the corner for the author and
 * for moderators: after a question it removes the message's previews for
 * everyone, and the link itself stays.
 */
export function MessageEmbeds(props: { message: Message }) {
  const { t } = useLingui();
  const { openModal, showError } = useModals();
  const instance = useInstance();

  /** Ask first; with Shift held, remove at once */
  function remove(event: { shiftKey?: boolean }) {
    if (event?.shiftKey) props.message.removeEmbeds().catch(showError);
    else openModal({ type: "remove_link_previews", message: props.message });
  }

  // our own invite and bot links show their card in the text instead
  const embeds = () =>
    shownEmbeds(props.message.embeds, {
      appOrigins: [instance.origin, window.location.origin],
    });

  return (
    <For each={embeds()}>
      {(embed) => (
        <Show
          when={embed.type !== "Text" && canRemoveLinkPreviews(props.message)}
          fallback={<Embed embed={embed} />}
        >
          <Frame data-link-preview>
            <Embed embed={embed} />
            <Corner data-preview-corner>
              <IconButton
                variant="outlined"
                size="xs"
                aria-label={t`Remove link previews`}
                data-remove-previews
                onPress={remove}
              >
                <Icon name="x" size={16} />
              </IconButton>
            </Corner>
          </Frame>
        </Show>
      )}
    </For>
  );
}

/** The X before the card instead of after it */
const cornerAtStart = {
  order: -1,
  marginInlineStart: 0,
  marginInlineEnd: "-38px",
} as const;

const cornerAtStartPhone = {
  order: -1,
  marginInlineStart: 0,
  marginInlineEnd: "-50px",
} as const;

const Frame = styled("div", {
  base: {
    // a row, so the X follows the card's own edge whatever the card's
    // width is (in a frame as wide as the message it floated beside the card)
    display: "flex",
    alignItems: "flex-start",
    maxWidth: "100%",
    "& > :first-child": { minWidth: 0 },
    "& [data-remove-previews]": {
      opacity: 0,
      // a quiet, neutral control: the confirmation carries the warning
      background: "var(--z-bg-raised)",
      borderColor: "var(--z-border-subtle)",
      "--colour": "var(--z-fg-muted)",
    },
    "& [data-remove-previews]:hover": {
      "--colour": "var(--z-fg-primary)",
    },
    "&:hover [data-remove-previews], & [data-remove-previews]:focus-visible": {
      opacity: 1,
    },
    // A card takes its direction from its own words, so in an Arabic app an
    // English card still starts on the left. The X goes to the card's own
    // end, where its header row is empty, and not onto the site name.
    _rtl: { "&:has(> [dir=ltr]) [data-preview-corner]": cornerAtStart },
    _ltr: { "&:has(> [dir=rtl]) [data-preview-corner]": cornerAtStart },
    // phones have no hover: the X is always there
    _phone: {
      "& [data-remove-previews]": { opacity: 1 },
      // the button is 44px there (tap target), so the pull-back grows too
      _rtl: {
        "&:has(> [dir=ltr]) [data-preview-corner]": cornerAtStartPhone,
      },
      _ltr: {
        "&:has(> [dir=rtl]) [data-preview-corner]": cornerAtStartPhone,
      },
    },
  },
});

/**
 * Pulled back over the card: the button's width and 6px from the card's edge
 * (32px button; 44px on phones, where every tap target is that size)
 */
const Corner = styled("div", {
  base: {
    position: "relative",
    zIndex: 1,
    flex: "none",
    marginBlockStart: "6px",
    marginInlineStart: "-38px",
    _phone: { marginInlineStart: "-50px" },
  },
});
