import { For, Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";
import { Embed, IconButton } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { canRemoveLinkPreviews } from "./linkPreviews";

/**
 * A message's embeds. Link previews get an X in the corner for the author and
 * for moderators: it removes the message's previews for everyone.
 */
export function MessageEmbeds(props: { message: Message }) {
  const { t } = useLingui();
  const { showError } = useModals();

  return (
    <For each={props.message.embeds}>
      {(embed) => (
        <Show
          when={embed.type !== "Text" && canRemoveLinkPreviews(props.message)}
          fallback={<Embed embed={embed} />}
        >
          <Frame data-link-preview>
            <Embed embed={embed} />
            <Corner>
              <IconButton
                variant="tonal"
                size="xs"
                aria-label={t`Remove link previews`}
                data-remove-previews
                onPress={() => props.message.removeEmbeds().catch(showError)}
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

const Frame = styled("div", {
  base: {
    position: "relative",
    width: "fit-content",
    maxWidth: "100%",
    "& [data-remove-previews]": { opacity: 0 },
    "&:hover [data-remove-previews], & [data-remove-previews]:focus-visible": {
      opacity: 1,
    },
    // phones have no hover: the X is always there
    _phone: { "& [data-remove-previews]": { opacity: 1 } },
  },
});

const Corner = styled("div", {
  base: {
    position: "absolute",
    top: "var(--gap-sm)",
    insetInlineEnd: "var(--gap-sm)",
  },
});
