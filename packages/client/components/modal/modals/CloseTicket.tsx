import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useMutation } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Dialog, DialogProps } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to close a ticket
 *
 * [ticket] Close this ticket?
 *          (what happens, for its opener or for the staff)
 * How was the help?  * * * * *      (its opener only, optional)
 * [                      Cancel   [ Close ticket ] ]
 */
export function CloseTicketModal(
  props: DialogProps & Modals & { type: "close_ticket" },
) {
  const { t } = useLingui();
  const { showError } = useModals();
  const client = useClient();
  const [rating, setRating] = createSignal<number>();

  const close = useMutation(() => ({
    mutationFn: () => props.channel.closeTicket(rating()),
    onError: showError,
  }));

  const mine = () => props.channel.ticket?.openerId === client().user?.id;

  return (
    <Dialog
      size="sm"
      iconName="ticket"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Close this ticket?</Trans>}
      description={
        <Show
          when={mine()}
          fallback={
            <Trans>
              The member who opened it will no longer see it. You can reopen it
              or delete it later.
            </Trans>
          }
        >
          <Trans>
            You will no longer see this ticket. The staff keep it and can open
            it again for you.
          </Trans>
        </Show>
      }
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Close ticket</Trans>,
          isLoading: close.isPending,
          onClick: () => close.mutateAsync(),
        },
      ]}
      isDisabled={close.isPending}
    >
      <Show when={mine()} fallback={null}>
        <Rate>
          <RateLabel id="ticket-rating">
            <Trans>How was the help? (optional)</Trans>
          </RateLabel>
          <Stars role="radiogroup" aria-labelledby="ticket-rating">
            <For each={[1, 2, 3, 4, 5]}>
              {(value) => (
                <Star
                  type="button"
                  role="radio"
                  aria-checked={rating() === value}
                  aria-label={t`${value} out of 5`}
                  data-on={(rating() ?? 0) >= value ? "" : undefined}
                  data-testid={`ticket-star-${value}`}
                  onClick={() =>
                    setRating(rating() === value ? undefined : value)
                  }
                >
                  <Icon name="star" size={24} />
                </Star>
              )}
            </For>
          </Stars>
        </Rate>
      </Show>
    </Dialog>
  );
}

const Rate = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const RateLabel = styled("span", {
  base: { fontSize: "14px", color: "var(--z-fg-secondary)" },
});

const Stars = styled("div", {
  base: { display: "flex", gap: "4px" },
});

const Star = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "44px",
    height: "44px",
    border: "none",
    borderRadius: "8px",
    background: "none",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[data-on]": { color: "var(--z-warning)" },
  },
});
