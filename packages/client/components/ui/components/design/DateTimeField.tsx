import { For, Show, createMemo, createSignal, createUniqueId } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import {
  addDays,
  addMonths,
  atMinutes,
  dateFormats,
  minutesOf,
  monthGrid,
  sameDay,
  startOfDay,
  timeSlots,
  weekStartFor,
} from "./dateTime";
import { FloatingSelect } from "./FloatingSelect";
import { MenuItem } from "./Menu";

type Props = {
  /** Label over the field */
  label: string;
  /** Chosen moment (local time zone) */
  value?: Date;
  /** Earliest day that can be picked */
  min?: Date;
  /** 12 or 24 hours; the language decides when unset */
  hour12?: boolean;
  /** Short line under the field */
  helper?: string;
  /** Inline problem; marks the field invalid */
  error?: string | false;
  disabled?: boolean;
  /** Test id prefix for the parts (`-date`, `-time`) */
  testId?: string;
  onChange: (value: Date) => void;
};

/**
 * A day and a time, in the person's own time zone and language. The day
 * opens a month calendar under the field (a grid you can use with the
 * arrow keys, Page Up/Down for months, Home/End for the week, Enter to
 * choose, Escape to close; arrows follow the reading direction). The time
 * is a list of quarter hours. No native date input: it looks different on
 * every system and reads dates in the wrong order in Arabic.
 */
export function DateTimeField(props: Props) {
  const { t, i18n } = useLingui();
  const id = createUniqueId();
  const formats = createMemo(() =>
    dateFormats(i18n().locale ?? "en", props.hour12),
  );
  const weekStart = () => weekStartFor(i18n().locale ?? "en");
  const rtl = () => typeof document !== "undefined" && document.dir === "rtl";

  const [open, setOpen] = createSignal(false);
  // the month on screen and the focused day while the calendar is open
  const [cursor, setCursor] = createSignal(
    startOfDay(props.value ?? props.min ?? new Date()),
  );
  let grid: HTMLDivElement | undefined;
  let toggle: HTMLButtonElement | undefined;

  const days = createMemo(() =>
    monthGrid(cursor().getFullYear(), cursor().getMonth(), weekStart()),
  );
  const weekdays = createMemo(() =>
    days()
      .slice(0, 7)
      .map((day) => ({
        short: formats().weekday.format(day),
        long: formats().weekdayLong.format(day),
      })),
  );

  const tooEarly = (day: Date) =>
    !!props.min && startOfDay(day) < startOfDay(props.min);

  function openCalendar() {
    setCursor(startOfDay(props.value ?? props.min ?? new Date()));
    setOpen(true);
    queueMicrotask(focusCursor);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) toggle?.focus();
  }

  function focusCursor() {
    grid
      ?.querySelector<HTMLButtonElement>(
        `[data-day="${cursor().toDateString()}"]`,
      )
      ?.focus();
  }

  function moveTo(day: Date) {
    setCursor(startOfDay(day));
    queueMicrotask(focusCursor);
  }

  function choose(day: Date) {
    if (tooEarly(day)) return;
    const minutes = props.value ? minutesOf(props.value) : 18 * 60;
    props.onChange(atMinutes(day, minutes));
    close();
  }

  function onGridKey(event: KeyboardEvent) {
    const day = cursor();
    // left and right follow the reading direction
    const forward = rtl() ? "ArrowLeft" : "ArrowRight";
    const back = rtl() ? "ArrowRight" : "ArrowLeft";
    const startOffset = (day.getDay() - weekStart() + 7) % 7;
    const step: Record<string, () => Date> = {
      [forward]: () => addDays(day, 1),
      [back]: () => addDays(day, -1),
      ArrowDown: () => addDays(day, 7),
      ArrowUp: () => addDays(day, -7),
      Home: () => addDays(day, -startOffset),
      End: () => addDays(day, 6 - startOffset),
      PageDown: () => addMonths(day, event.shiftKey ? 12 : 1),
      PageUp: () => addMonths(day, event.shiftKey ? -12 : -1),
    };
    if (step[event.key]) {
      event.preventDefault();
      moveTo(step[event.key]());
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  const time = () => (props.value ? minutesOf(props.value) : undefined);
  // a time off the quarter hours (an older event, a clock change) stays
  // in the list, so it is shown and kept until another is chosen
  const slots = () => {
    const list = timeSlots();
    const own = time();
    return own === undefined || list.includes(own)
      ? list
      : [...list, own].sort((a, b) => a - b);
  };
  // the person's time zone, named, so a time is never read in another one
  const zone = () => {
    const parts = new Intl.DateTimeFormat(i18n().locale ?? "en", {
      timeZoneName: "short",
    }).formatToParts(props.value ?? new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  };
  const zoneId = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timeLabel = (minutes: number) =>
    formats().time.format(atMinutes(new Date(2000, 0, 3), minutes));

  return (
    <Fieldset
      aria-describedby={props.helper || props.error ? `${id}-help` : undefined}
      data-invalid={props.error ? "" : undefined}
    >
      <Legend>{props.label}</Legend>
      <Row>
        <Control data-open={open()}>
          <DayButton
            ref={toggle}
            type="button"
            id={`${id}-day`}
            disabled={props.disabled}
            aria-expanded={open()}
            aria-controls={`${id}-calendar`}
            data-testid={props.testId ? `${props.testId}-date` : undefined}
            data-empty={!props.value}
            onClick={() => (open() ? close() : openCalendar())}
          >
            <Icon name="calendar" size={18} />
            <span>
              {props.value
                ? formats().day.format(props.value)
                : t`Choose a day`}
            </span>
          </DayButton>
        </Control>
        <FloatingSelect
          id={`${id}-time`}
          // no label of its own: the legend names the pair, so the day and
          // the time start on one line at one height
          aria-label={`${props.label}: ${t`Time`}`}
          class={timeTrigger}
          value={time() === undefined ? "" : String(time())}
          disabled={props.disabled}
          onChange={(event) => {
            const minutes = Number(event.currentTarget.value);
            const day = props.value ?? props.min ?? new Date();
            props.onChange(atMinutes(day, minutes));
          }}
        >
          <For each={slots()}>
            {(minutes) => (
              <MenuItem
                value={String(minutes)}
                data-testid={
                  props.testId ? `${props.testId}-time-${minutes}` : undefined
                }
              >
                {timeLabel(minutes)}
              </MenuItem>
            )}
          </For>
        </FloatingSelect>
      </Row>
      <Zone
        data-testid={props.testId ? `${props.testId}-zone` : undefined}
        title={zoneId()}
        aria-label={`${t`Time zone`}: ${zoneId()}`}
      >
        <Icon name="globe" size={14} />
        <span>
          {zone()} · {zoneId()}
        </span>
      </Zone>
      <Show when={open()}>
        <Calendar id={`${id}-calendar`} role="group" aria-label={props.label}>
          <MonthBar>
            <NavButton
              type="button"
              aria-label={t`Previous month`}
              onClick={() => setCursor(addMonths(cursor(), -1))}
            >
              <Icon name="caret-left" size={18} />
            </NavButton>
            <MonthTitle aria-live="polite">
              {formats().month.format(cursor())}
            </MonthTitle>
            <NavButton
              type="button"
              aria-label={t`Next month`}
              onClick={() => setCursor(addMonths(cursor(), 1))}
            >
              <Icon name="caret-right" size={18} />
            </NavButton>
          </MonthBar>
          <Grid ref={grid} role="grid" onKeyDown={onGridKey}>
            <div role="row" class="week">
              <For each={weekdays()}>
                {(weekday) => (
                  <span role="columnheader" aria-label={weekday.long}>
                    {weekday.short}
                  </span>
                )}
              </For>
            </div>
            <For each={[0, 1, 2, 3, 4, 5]}>
              {(week) => (
                <div role="row" class="week">
                  <For each={days().slice(week * 7, week * 7 + 7)}>
                    {(day) => (
                      <span
                        role="gridcell"
                        aria-selected={
                          !!props.value && sameDay(day, props.value)
                        }
                      >
                        <DayCell
                          type="button"
                          data-day={day.toDateString()}
                          data-outside={
                            day.getMonth() !== cursor().getMonth() || undefined
                          }
                          data-today={sameDay(day, new Date()) || undefined}
                          data-selected={
                            (!!props.value && sameDay(day, props.value)) ||
                            undefined
                          }
                          tabIndex={sameDay(day, cursor()) ? 0 : -1}
                          disabled={tooEarly(day)}
                          aria-label={formats().longDay.format(day)}
                          aria-current={
                            sameDay(day, new Date()) ? "date" : undefined
                          }
                          onClick={() => choose(day)}
                        >
                          {formats().dayNumber.format(day)}
                        </DayCell>
                      </span>
                    )}
                  </For>
                </div>
              )}
            </For>
          </Grid>
        </Calendar>
      </Show>
      <Show when={props.error || props.helper}>
        <Help id={`${id}-help`} data-error={props.error ? "" : undefined}>
          {props.error || props.helper}
        </Help>
      </Show>
    </Fieldset>
  );
}

const Fieldset = styled("fieldset", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: "none",
    "&:focus-within legend": { color: "var(--z-fg-primary)" },
  },
});

const Legend = styled("legend", {
  base: {
    padding: 0,
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: 650,
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

const Row = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
    alignItems: "start",
    gap: "8px",
  },
});

/** The time list looks like the day box: same height, corners and type */
// atomic classes of equal weight win by file order, so the heights here
// must win over the select's own (36 px, 44 px on phones) on purpose
const timeTrigger = css({
  minHeight: "44px !important",
  borderRadius: "var(--z-radius, 10px)",
  fontSize: "15px",
  // phones: the day button is 44 px inside a 1 px border
  _phone: { fontSize: "16px", minHeight: "46px !important" },
});

const Control = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    minHeight: "44px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-field-bg)",
    border:
      "1px solid var(--z-field-border, color-mix(in srgb, var(--z-fg-primary) 10%, transparent))",
    boxShadow: "var(--z-field-shadow)",
    _hover: {
      borderColor:
        "var(--z-field-border-hover, color-mix(in srgb, var(--z-fg-primary) 18%, transparent))",
    },
    "&:focus-within, &[data-open='true']": {
      borderColor: "var(--z-accent)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
  },
});

const DayButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    minWidth: 0,
    minHeight: "42px",
    paddingInline: "12px",
    border: "none",
    borderRadius: "inherit",
    outline: "none",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "15px",
    textAlign: "start",
    cursor: "pointer",
    "--z-icon-color": "var(--z-fg-muted)",
    _phone: { fontSize: "16px", minHeight: "44px" },
    "&[data-empty='true']": { color: "var(--z-fg-muted)" },
    "&:disabled": { cursor: "not-allowed", opacity: 0.6 },
    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Calendar = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
    border: "1px solid var(--z-border-subtle)",
  },
});

const MonthBar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
});

const MonthTitle = styled("span", {
  base: {
    fontSize: "15px",
    fontWeight: 650,
    color: "var(--z-fg-primary)",
  },
});

const NavButton = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    border: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    // the arrows point the way the month moves in the reading direction
    // direction icons turn by themselves in right-to-left (styles.css)
    _phone: { width: "44px", height: "44px" },
  },
});

const Grid = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& .week": {
      display: "grid",
      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
      gap: "4px",
    },
    "& [role=columnheader]": {
      textAlign: "center",
      fontSize: "12px",
      fontWeight: 650,
      color: "var(--z-fg-muted)",
      paddingBlock: "4px",
    },
    "& [role=gridcell]": { display: "grid" },
  },
});

const DayCell = styled("button", {
  base: {
    height: "36px",
    border: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "&[data-outside]": { color: "var(--z-fg-muted)" },
    "&[data-today]": { boxShadow: "inset 0 0 0 1px var(--z-border-strong)" },
    "&[data-selected]": {
      background: "var(--z-accent)",
      color: "var(--z-on-accent)",
      fontWeight: 650,
    },
    "&:disabled": {
      color: "var(--z-fg-muted)",
      opacity: 0.45,
      cursor: "not-allowed",
      background: "transparent",
    },
    // phones: a full 44 px target
    _phone: { height: "44px", fontSize: "15px" },
  },
});

const Zone = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    "& > span": { unicodeBidi: "isolate" },
  },
});

const Help = styled("span", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
    "&[data-error]": { color: "var(--z-danger)" },
  },
});
