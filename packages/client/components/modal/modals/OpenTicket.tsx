import { For, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useNavigate } from "@revolt/routing";
import { Dialog, DialogProps, TextField } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

/**
 * Modal to open a ticket in a server that has kinds of ticket
 *
 * [ticket] Open a ticket
 *          What is it about?
 * ( Support ) ( Report ) ( Something else )
 * [ In a few words (optional)              ]
 * [                    Cancel  [ Open ticket ] ]
 */
export function OpenTicketModal(
  props: DialogProps & Modals & { type: "open_ticket" },
) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { showError } = useModals();
  const [kind, setKind] = createSignal<string>();
  const [subject, setSubject] = createSignal("");
  const [pending, setPending] = createSignal(false);

  const types = () => props.server.tickets?.types ?? [];

  async function open() {
    setPending(true);
    try {
      const channel = await props.server.openTicket(
        subject().trim() || undefined,
        kind(),
      );
      navigate(`/server/${props.server.id}/channel/${channel.id}`);
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      size="sm"
      iconName="ticket"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Open a ticket</Trans>}
      description={
        <Trans>
          A private channel between you and the staff of this server.
        </Trans>
      }
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Open ticket</Trans>,
          isLoading: pending(),
          isDisabled: !kind(),
          onClick: open,
        },
      ]}
      isDisabled={pending()}
    >
      <Stack>
        <Kinds role="radiogroup" aria-label={t`What is it about?`}>
          <For each={types()}>
            {(type) => (
              <Kind
                type="button"
                role="radio"
                aria-checked={kind() === type.id}
                data-testid={`ticket-type-${type.id}`}
                onClick={() => setKind(type.id)}
              >
                {type.name}
              </Kind>
            )}
          </For>
        </Kinds>
        <TextField
          label={t`In a few words (optional)`}
          maxlength={100}
          counter
          value={subject()}
          onInput={(event) => setSubject(event.currentTarget.value)}
        />
      </Stack>
    </Dialog>
  );
}

const Stack = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px" },
});

const Kinds = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const Kind = styled("button", {
  base: {
    minHeight: "36px",
    paddingInline: "16px",
    borderRadius: "999px",
    border: "1px solid var(--z-border-subtle)",
    background: "none",
    color: "var(--z-fg-secondary)",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "&[aria-checked=true]": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 16%, transparent)",
      color: "var(--z-fg-primary)",
    },
    _phone: { minHeight: "44px" },
  },
});
