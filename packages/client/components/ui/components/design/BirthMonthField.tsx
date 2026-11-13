import { useLingui } from "@lingui/solid/macro";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  on,
  onCleanup,
  untrack,
} from "solid-js";

import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { birthDateProblem, matchMonth, yearDigits } from "./birthMonth";

type Props = {
  /** Field label */
  label?: string;
  /** Short line under the field */
  helper?: string;
  /** Inline validation message; marks the field invalid */
  error?: string | false;
  /** Selected month (1-12) */
  month?: number;
  /** Selected year */
  year?: number;
  disabled?: boolean;
  /** Called when either part changes; 0 means not chosen (or not a full year) */
  onChange?: (value: { month: number; year: number }) => void;
};

/**
 * Month and year of birth, named `birth-month` and `birth-year` so they can
 * live inside a form. The day is never asked, and nothing here checks the
 * minimum age: the server decides that.
 *
 * - Month: a select-only combobox (WAI-ARIA pattern) in the field style,
 *   operable with arrows, Home/End, Enter/Space, Escape and type-ahead.
 * - Year: typed digits with the numeric keyboard on phones, instead of a
 *   list of 121 years.
 *
 * The year input carries a custom validity message for impossible dates
 * (future, or older than the server accepts), so a surrounding <Form>
 * shows it like any other field error.
 */
export function BirthMonthField(props: Props) {
  const { t, i18n } = useLingui();
  const id = createUniqueId();
  const legendId = `${id}-legend`;
  const listId = `${id}-list`;
  const buttonId = `${id}-month`;

  // starting values; later changes from the parent arrive through the effects below
  const [month, setMonth] = createSignal(untrack(() => props.month ?? 0));
  const [year, setYear] = createSignal(
    untrack(() => (props.year ? String(props.year) : "")),
  );
  const [open, setOpen] = createSignal(false);
  // highlighted option while the list is open (0-11)
  const [active, setActive] = createSignal(0);

  createEffect(
    on(
      () => props.month,
      (value) => value !== undefined && setMonth(value),
      { defer: true },
    ),
  );
  createEffect(
    on(
      () => props.year,
      (value) => value !== undefined && setYear(value ? String(value) : ""),
      { defer: true },
    ),
  );

  // month names in the UI language, worked out once per language
  const monthNames = createMemo(() => {
    const format = new Intl.DateTimeFormat(i18n().locale, {
      month: "long",
      timeZone: "UTC",
    });
    return Array.from({ length: 12 }, (_, index) =>
      format.format(new Date(Date.UTC(2000, index, 1))),
    );
  });

  let button: HTMLButtonElement | undefined;
  let list: HTMLUListElement | undefined;
  let yearInput: HTMLInputElement | undefined;

  const fullYear = () => (/^\d{4}$/.test(year()) ? Number(year()) : 0);

  /** Same rules as the server's parser: 4 digits, not in the future, not too old */
  function checkDate() {
    if (!yearInput) return;
    const problem = birthDateProblem(year(), month(), new Date());
    yearInput.setCustomValidity(
      problem === "format"
        ? t`Enter the year with 4 digits, for example 1994.`
        : problem === "range"
          ? t`Check the month and year of birth.`
          : "",
    );
  }

  function emit() {
    checkDate();
    props.onChange?.({ month: month(), year: fullYear() });
  }

  function choose(index: number) {
    setMonth(index + 1);
    setOpen(false);
    emit();
  }

  function openList(at = month() ? month() - 1 : 0) {
    if (props.disabled) return;
    setActive(Math.max(0, Math.min(11, at)));
    setOpen(true);
  }

  // keep the highlighted option in view
  createEffect(() => {
    if (!open()) return;
    const option = list?.children[active()] as HTMLElement | undefined;
    option?.scrollIntoView({ block: "nearest" });
  });

  // close when the pointer goes down anywhere else
  createEffect(() => {
    if (!open()) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!button?.contains(target) && !list?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    onCleanup(() =>
      document.removeEventListener("pointerdown", onPointer, true),
    );
  });

  // type-ahead: letters typed in quick succession pick the matching month
  let typed = "";
  let typedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(typedTimer));

  function typeAhead(key: string) {
    clearTimeout(typedTimer);
    typed += key.toLocaleLowerCase();
    typedTimer = setTimeout(() => (typed = ""), 600);
    const current = open() ? active() : month() ? month() - 1 : 0;
    return matchMonth(monthNames(), typed, current);
  }

  function onKeyDown(event: KeyboardEvent) {
    const isOpen = open();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen || event.altKey) return openList();
        setActive((index) => Math.min(11, index + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen && event.altKey) return choose(active());
        if (!isOpen) return openList();
        setActive((index) => Math.max(0, index - 1));
        return;
      case "Home":
        event.preventDefault();
        return isOpen ? setActive(0) : openList(0);
      case "End":
        event.preventDefault();
        return isOpen ? setActive(11) : openList(11);
      case "PageDown":
        if (!isOpen) return;
        event.preventDefault();
        return setActive((index) => Math.min(11, index + 4));
      case "PageUp":
        if (!isOpen) return;
        event.preventDefault();
        return setActive((index) => Math.max(0, index - 4));
      case "Enter":
      case " ":
        event.preventDefault();
        return isOpen ? choose(active()) : openList();
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        return;
      case "Tab":
        if (isOpen) choose(active());
        return;
      default:
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          const match = typeAhead(event.key);
          if (match === undefined) return;
          event.preventDefault();
          if (isOpen) setActive(match);
          else {
            setMonth(match + 1);
            emit();
          }
        }
    }
  }

  const describedBy = () =>
    props.error ? `${id}-error` : props.helper ? `${id}-helper` : undefined;

  return (
    <Fieldset aria-labelledby={props.label ? legendId : undefined}>
      <Show when={props.label}>
        <Legend id={legendId}>{props.label}</Legend>
      </Show>
      <Row>
        <Control
          data-invalid={!!props.error}
          data-disabled={!!props.disabled}
          data-open={open()}
        >
          <MonthButton
            ref={button}
            id={buttonId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open()}
            aria-controls={listId}
            aria-activedescendant={open() ? `${id}-m${active()}` : undefined}
            // name = "Month of birth" + the chosen month, so both are read out
            aria-labelledby={`${id}-mlabel ${id}-mvalue`}
            aria-invalid={props.error ? true : undefined}
            aria-describedby={describedBy()}
            aria-required="true"
            disabled={props.disabled}
            data-empty={!month()}
            onClick={() => (open() ? setOpen(false) : openList())}
            onKeyDown={onKeyDown}
            onBlur={(event) => {
              if (!list?.contains(event.relatedTarget as Node | null))
                setOpen(false);
            }}
          >
            <MonthLabel id={`${id}-mlabel`}>{t`Month of birth`}</MonthLabel>
            <span id={`${id}-mvalue`}>
              {month() ? monthNames()[month() - 1] : t`Month`}
            </span>
          </MonthButton>
          <Icon name="caret-down" size={16} />
          <input
            type="hidden"
            name="birth-month"
            value={month() ? String(month()) : ""}
            data-required="true"
            data-focus={buttonId}
          />
          <Show when={open()}>
            <List
              ref={list}
              id={listId}
              role="listbox"
              aria-label={t`Month of birth`}
              tabIndex={-1}
            >
              <For each={monthNames()}>
                {(name, index) => (
                  <li
                    id={`${id}-m${index()}`}
                    role="option"
                    aria-selected={month() === index() + 1}
                    data-active={active() === index()}
                    // keep focus on the combobox while clicking
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerMove={() => setActive(index())}
                    onClick={() => {
                      choose(index());
                      button?.focus();
                    }}
                  >
                    {name}
                    <Show when={month() === index() + 1}>
                      <Icon name="check-circle" size={16} />
                    </Show>
                  </li>
                )}
              </For>
            </List>
          </Show>
        </Control>
        <Control data-invalid={!!props.error} data-disabled={!!props.disabled}>
          <input
            ref={yearInput}
            name="birth-year"
            type="text"
            inputMode="numeric"
            autocomplete="bday-year"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            disabled={props.disabled}
            placeholder={t`Year`}
            aria-label={t`Year of birth`}
            aria-invalid={props.error ? true : undefined}
            aria-describedby={describedBy()}
            value={year()}
            onInput={(event) => {
              // digits only (also converts Arabic-Indic digits)
              const digits = yearDigits(event.currentTarget.value);
              if (digits !== event.currentTarget.value)
                event.currentTarget.value = digits;
              setYear(digits);
              emit();
            }}
          />
        </Control>
      </Row>
      <Show
        when={props.error}
        fallback={
          <Show when={props.helper}>
            <Helper id={`${id}-helper`}>{props.helper}</Helper>
          </Show>
        }
      >
        <ErrorText id={`${id}-error`} role="alert">
          <Icon name="warning-circle" size={14} />
          {props.error}
        </ErrorText>
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

/** Same look as the text field label */
const Legend = styled("legend", {
  base: {
    padding: 0,
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: 650,
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
    transition: "color var(--z-motion-fast, 120ms) ease",
  },
});

const Row = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
    gap: "8px",
  },
});

/** Same well as the text field, so all fields read as one kind of control */
const Control = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    minHeight: "44px",
    borderRadius: "calc(var(--z-radius, 10px))",
    background: "var(--z-field-bg)",
    border:
      "1px solid var(--z-field-border, color-mix(in srgb, var(--z-fg-primary) 10%, transparent))",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    transition:
      "border-color var(--z-motion-fast, 120ms) ease, box-shadow var(--z-motion-base, 220ms) var(--z-ease-standard, ease)",
    _motionReduce: { transition: "none" },

    _hover: {
      borderColor:
        "var(--z-field-border-hover, color-mix(in srgb, var(--z-fg-primary) 18%, transparent))",
    },
    "&:focus-within, &[data-open='true']": {
      borderColor: "var(--z-accent)",
      // the shared field focus: a crisp ring, no coloured glow
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "&[data-invalid='true']": { borderColor: "var(--z-danger)" },
    "&[data-disabled='true']": { opacity: 0.55, boxShadow: "none" },

    "& > .z-icon": {
      position: "absolute",
      insetInlineEnd: "12px",
      pointerEvents: "none",
      transition: "transform var(--z-motion-fast, 120ms) ease",
    },
    "&[data-open='true'] > .z-icon": { transform: "rotate(180deg)" },

    "& > input": {
      width: "100%",
      minWidth: 0,
      minHeight: "42px",
      paddingInline: "14px",
      border: "none",
      borderRadius: "inherit",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      caretColor: "var(--z-accent)",
      font: "inherit",
      fontSize: "15px",
      fontVariantNumeric: "tabular-nums",
      _phone: { fontSize: "16px", minHeight: "44px", marginBlock: "-1px" },
      "&::placeholder": { color: "var(--z-fg-muted)" },
      "&:disabled": { cursor: "not-allowed" },
    },
  },
});

const MonthButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
    minHeight: "42px",
    paddingInline: "14px 36px",
    border: "none",
    borderRadius: "inherit",
    outline: "none",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "15px",
    textAlign: "start",
    cursor: "pointer",
    // phones: a full 44 px target, drawn over the control's 1 px border
    _phone: { fontSize: "16px", minHeight: "44px", marginBlock: "-1px" },
    "&[data-empty='true']": { color: "var(--z-fg-muted)" },
    "&:disabled": { cursor: "not-allowed" },
    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

/** Spoken part of the combobox name, not shown (the legend shows it) */
const MonthLabel = styled("span", {
  base: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
});

const List = styled("ul", {
  base: {
    position: "absolute",
    zIndex: 10,
    top: "calc(100% + 4px)",
    insetInline: 0,
    // wider than the month column on narrow screens isn't needed: names fit
    maxHeight: "264px",
    overflowY: "auto",
    margin: 0,
    padding: "4px",
    listStyle: "none",
    background: "var(--z-popover-bg, var(--z-bg-raised))",
    border: "1px solid var(--z-popover-border, var(--z-border-subtle))",
    borderRadius: "var(--z-radius, 10px)",
    boxShadow: "var(--z-popover-lift)",
    color: "var(--z-fg-primary)",
    animation: "authHintIn 120ms cubic-bezier(0.2, 0, 0, 1)",
    _motionReduce: { animation: "none" },

    "& li": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      minHeight: "36px",
      paddingInline: "10px",
      borderRadius: "var(--z-radius-sm, 6px)",
      fontSize: "15px",
      cursor: "pointer",
      _phone: { minHeight: "44px", fontSize: "16px" },
      "--z-icon-color": "var(--z-accent-text, var(--z-accent))",
    },
    "& li[data-active='true']": { background: "var(--z-nav-hover)" },
    "& li[aria-selected='true']": { fontWeight: 600 },
  },
});

const Helper = styled("div", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

const ErrorText = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    "--z-icon-color": "currentColor",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 500,
    color: "var(--z-danger)",
  },
});
