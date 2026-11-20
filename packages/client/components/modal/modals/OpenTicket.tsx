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
 * What is it about?
 * ( ) Support
 * ( ) Report
 * ( ) Something else
 * [ In a few words (optional)              ]
 * [                    Cancel  [ Open ticket ] ]
 */
export function OpenTicketModal(
  props: DialogProps & Modals & { type: "open_ticket" },
) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { showError } = useModals();
  // one kind: nothing to choose
  const [kind, setKind] = createSignal<string | undefined>(
    // eslint-disable-next-line solid/reactivity
    props.server.tickets?.types.length === 1
      ? props.server.tickets.types[0].id
      : undefined,
  );
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
        <Group>
          <GroupLabel id="ticket-kinds">
            <Trans>What is it about?</Trans>
          </GroupLabel>
          <Kinds role="radiogroup" aria-labelledby="ticket-kinds">
            <For each={types()}>
              {(type) => (
                <Kind
                  type="button"
                  role="radio"
                  aria-checked={kind() === type.id}
                  data-testid={`ticket-type-${type.id}`}
                  onClick={() => setKind(type.id)}
                >
                  <Dot aria-hidden="true" />
                  <KindName dir="auto">{type.name}</KindName>
                </Kind>
              )}
            </For>
          </Kinds>
        </Group>
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
  base: { display: "flex", flexDirection: "column", gap: "20px" },
});

const Group = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const GroupLabel = styled("span", {
  base: {
    paddingInline: "2px",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-section-label, var(--z-fg-secondary))",
  },
});

/** One box for all the kinds, a hairline between them: the settings card */
const Kinds = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
    _phone: {
      border: "none",
      background:
        "var(--z-sheet-group, color-mix(in srgb, var(--z-fg-primary) 5%, transparent))",
    },
  },
});

const Kind = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    paddingBlock: "12px",
    paddingInline: "16px",
    border: "none",
    background: "none",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 500,
    textAlign: "start",
    cursor: "pointer",
    transition: "background-color 120ms ease",
    _motionReduce: { transition: "none" },
    "& + &::before": {
      content: "''",
      position: "absolute",
      top: 0,
      insetInline: "16px",
      height: "1px",
      background: "var(--z-border-subtle)",
    },
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    // the chosen kind is raised, never tinted; its dot says which
    "&[aria-checked=true]": { background: "var(--z-nav-selected)" },
  },
});

/** The radio mark: a ring, filled with the action colour when chosen */
const Dot = styled("span", {
  base: {
    flexShrink: 0,
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: "2px solid var(--z-fg-muted)",
    boxSizing: "border-box",
    transition: "border-color 120ms ease, border-width 120ms ease",
    _motionReduce: { transition: "none" },
    "[aria-checked=true] > &": {
      borderColor: "var(--z-accent)",
      borderWidth: "5px",
    },
  },
});

const KindName = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
});
