import { Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { eventDay, eventWeekday } from "./eventFormat";

/**
 * An event drawn as a ticket: a stub with the day, a perforated line, and
 * the event beside it. The list, "My events" and the event's own page all
 * use this one shape.
 */
export const Ticket = styled("div", {
  base: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "132px minmax(0, 1fr)",
    minWidth: 0,
    minHeight: "112px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    "--ticket-line": "var(--z-border-soft, var(--z-border-subtle))",
    "&[data-live]": {
      background: "color-mix(in srgb, var(--z-live) 14%, var(--z-bg-raised))",
      "--ticket-line": "color-mix(in srgb, var(--z-live) 34%, transparent)",
    },
    _phone: { gridTemplateColumns: "76px minmax(0, 1fr)" },
  },
});

const Stub = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    padding: "12px 8px",
    minWidth: 0,
    textAlign: "center",
    borderInlineEnd: "2px dashed var(--ticket-line)",
    borderStartStartRadius: "var(--z-radius-md, 14px)",
    borderEndStartRadius: "var(--z-radius-md, 14px)",
    // yours: the stub a shade lighter (mixed, so it also shows on phones,
    // where every box wears one fill)
    "&[data-mine]": {
      background:
        "color-mix(in srgb, var(--z-fg-primary) 5%, var(--z-bg-raised))",
    },
    // the two bites of the perforation, in the colour of the page behind
    "&::before, &::after": {
      content: '""',
      position: "absolute",
      insetInlineEnd: "-11px",
      width: "20px",
      height: "20px",
      borderRadius: "999px",
      background: "var(--z-bg-chat)",
    },
    "&::before": { insetBlockStart: "-10px" },
    "&::after": { insetBlockEnd: "-10px" },
  },
});

const Small = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
    _phone: { fontSize: "12px", lineHeight: "16px" },
  },
});

const Day = styled("b", {
  base: {
    fontSize: "28px",
    lineHeight: "36px",
    fontWeight: 700,
    color: "var(--z-header-primary, var(--z-fg-primary))",
    "&[data-quiet]": { color: "var(--z-fg-secondary)" },
    _phone: { fontSize: "22px", lineHeight: "28px" },
  },
});

const Now = styled("b", {
  base: {
    fontSize: "22px",
    lineHeight: "32px",
    fontWeight: 700,
    color: "var(--z-live)",
    _phone: { fontSize: "18px", lineHeight: "24px" },
  },
});

/**
 * The stub of a ticket: weekday, day and month; while the event happens,
 * "Now" and since when
 */
export function TicketStub(props: {
  startsAt: string;
  /** Since when it is happening ("12 minutes ago"); shows "Now" */
  liveSince?: string;
  /** You hold this ticket (you answered Going or Maybe) */
  mine?: boolean;
  /** Over, cancelled or a draft */
  quiet?: boolean;
}) {
  const { i18n } = useLingui();
  const day = () => eventDay(props.startsAt, i18n().locale ?? "en");
  return (
    <Stub data-mine={props.mine || undefined} data-testid="ticket-stub">
      <Show
        when={props.liveSince === undefined}
        fallback={
          <>
            <Now>
              <Trans context="scheduled events">Now</Trans>
            </Now>
            <Small>{props.liveSince}</Small>
          </>
        }
      >
        <Small>{eventWeekday(props.startsAt, i18n().locale ?? "en")}</Small>
        <Day data-quiet={props.quiet || undefined}>{day().day}</Day>
        <Small>{day().month}</Small>
      </Show>
    </Stub>
  );
}

/** Your answer, stamped on the ticket */
export const Stamp = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "2px solid currentColor",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 650,
    whiteSpace: "nowrap",
    color: "var(--z-fg-secondary)",
    transform: "rotate(-4deg)",
    "--z-icon-color": "currentColor",
    "&[data-tone=good]": { color: "var(--z-status-success)" },
    "&[data-tone=wait]": { color: "var(--z-status-warning)" },
  },
});
