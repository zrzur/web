import { For, JSX, Show, createUniqueId } from "solid-js";

import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

/**
 * A titled group of settings rows on ONE shared panel surface
 * (hairline dividers between rows, never a card per row)
 */
export function SettingsSection(props: {
  title?: JSX.Element;
  description?: JSX.Element;
  /**
   * Optional element at the end of the title line (e.g. a status or link)
   */
  aside?: JSX.Element;
  children: JSX.Element;
}) {
  const titleId = createUniqueId();

  return (
    <Section aria-labelledby={props.title ? titleId : undefined}>
      <Show when={props.title || props.aside}>
        <SectionHead>
          <SectionTitle id={titleId}>{props.title}</SectionTitle>
          {props.aside}
        </SectionHead>
      </Show>
      <Show when={props.description}>
        <SectionDescription>{props.description}</SectionDescription>
      </Show>
      <Panel data-settings-card>{props.children}</Panel>
    </Section>
  );
}

/**
 * One desktop settings row:
 * [icon] [title / description] ........ [secondary] [control]
 *
 * `control` receives ids so the control can reference the visible label.
 */
export function SettingsRow(props: {
  icon?: JSX.Element;
  title: JSX.Element;
  description?: JSX.Element;
  /**
   * Secondary action in a fixed column before the control (e.g. a preview
   * button), so it lines up across rows regardless of label length
   */
  secondary?: JSX.Element;
  control?: (ids: { labelId: string; descriptionId?: string }) => JSX.Element;
  /**
   * Whole-row click, for rows whose control is a toggle
   */
  onClick?: () => void;
  disabled?: boolean;
  /**
   * Destructive rows (danger zone)
   */
  danger?: boolean;
  /**
   * Row opens something (a page, a dialog): focusable, Enter/Space
   * activate it, and a chevron is drawn when there is no control
   */
  navigational?: boolean;
}) {
  const labelId = createUniqueId();
  const descriptionId = createUniqueId();

  const activate = () => !props.disabled && props.onClick?.();

  return (
    <Row
      data-clickable={!!props.onClick && !props.disabled}
      data-disabled={!!props.disabled}
      data-danger={!!props.danger}
      role={props.navigational ? "button" : undefined}
      tabIndex={props.navigational && !props.disabled ? 0 : undefined}
      aria-labelledby={props.navigational ? labelId : undefined}
      aria-describedby={
        props.navigational && props.description ? descriptionId : undefined
      }
      aria-disabled={props.navigational ? !!props.disabled : undefined}
      onClick={activate}
      onKeyDown={(e) => {
        if (
          props.navigational &&
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          activate();
        }
      }}
    >
      <Show when={props.icon}>
        <RowIcon aria-hidden="true" data-row-icon>
          {props.icon}
        </RowIcon>
      </Show>
      <RowText>
        <RowTitle id={labelId} data-row-title>
          {props.title}
        </RowTitle>
        <Show when={props.description}>
          <RowDescription id={descriptionId}>
            {props.description}
          </RowDescription>
        </Show>
      </RowText>
      <Show when={props.secondary}>
        <RowSecondary onClick={(e) => e.stopPropagation()}>
          {props.secondary}
        </RowSecondary>
      </Show>
      <Show
        when={props.control}
        fallback={
          <Show when={props.navigational}>
            <RowChevron aria-hidden="true" data-row-chevron>
              <Icon name="caret-right" size={16} />
            </RowChevron>
          </Show>
        }
      >
        <RowControl>
          {props.control!({
            labelId,
            descriptionId: props.description ? descriptionId : undefined,
          })}
        </RowControl>
      </Show>
    </Row>
  );
}

/**
 * One choice out of a few (join mode, verification level): selectable
 * cards, the radio at the start, then the name and what it does. A real
 * radio group, so arrow keys move between the choices.
 */
export function SettingsChoices<T extends string>(props: {
  /** Short label of the group, read out by screen readers */
  label: JSX.Element;
  value: T;
  options: { value: T; title: JSX.Element; description: JSX.Element }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = createUniqueId();

  return (
    <Choices aria-disabled={props.disabled}>
      <ChoicesLegend>{props.label}</ChoicesLegend>
      <For each={props.options}>
        {(option) => (
          <Choice
            data-checked={props.value === option.value}
            data-disabled={!!props.disabled}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={props.value === option.value}
              disabled={props.disabled}
              onChange={() => props.onChange(option.value)}
            />
            <ChoiceText>
              <RowTitle>{option.title}</RowTitle>
              <RowDescription>{option.description}</RowDescription>
            </ChoiceText>
          </Choice>
        )}
      </For>
    </Choices>
  );
}

const Choices = styled("fieldset", {
  base: {
    border: "none",
    margin: 0,
    padding: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const ChoicesLegend = styled("legend", {
  base: {
    padding: "0 2px 8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-section-label, var(--z-fg-muted))",
  },
});

const Choice = styled("label", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    minHeight: "44px",
    padding: "14px 16px",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    border: "1px solid var(--z-card-border, var(--z-border-soft))",
    background: "var(--z-card-bg)",
    cursor: "pointer",
    transition: "background-color 120ms ease, border-color 120ms ease",
    _motionReduce: { transition: "none" },
    _hover: { background: "var(--z-nav-hover)" },

    // the current choice is raised, never tinted (brand.md §6); the radio's
    // own colour says which
    "&[data-checked='true']": {
      borderColor: "var(--z-border-strong)",
      background: "var(--z-nav-selected)",
    },
    "&:has(input:focus-visible)": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[data-disabled='true']": { opacity: 0.5, cursor: "default" },

    "& input": {
      flexShrink: 0,
      width: "20px",
      height: "20px",
      margin: "0",
      marginBlockStart: "1px",
      accentColor: "var(--z-accent)",
      cursor: "inherit",
    },
  },
});

const ChoiceText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

/**
 * Small state label for settings rows (Enabled / Not set up / Loading…)
 */
export const SettingsStatus = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "20px",
    paddingInline: "8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    // the dot carries the state; the word stays readable on its tint
    color: "var(--z-fg-primary)",
    background: "color-mix(in srgb, var(--z-fg-primary) 7%, transparent)",

    "&::before": {
      content: "''",
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "currentColor",
    },
  },
  variants: {
    tone: {
      neutral: {},
      success: {
        color: "var(--z-status-success)",
        background:
          "color-mix(in srgb, var(--z-status-success) 12%, transparent)",
      },
      warning: {
        color: "var(--z-status-warning)",
        background:
          "color-mix(in srgb, var(--z-status-warning) 12%, transparent)",
      },
    },
  },
  defaultVariants: { tone: "neutral" },
});

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const SectionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
    paddingInline: "2px",
  },
});

const SectionTitle = styled("h3", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-section-label, var(--z-fg-secondary))",
  },
});

const SectionDescription = styled("p", {
  base: {
    margin: "0 2px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    unicodeBidi: "plaintext",
  },
});

/**
 * Shared group surface: one step darker than the page, hairline border
 */
const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--z-shape-card, calc(var(--z-radius, 10px) + 4px))",
    // free content inside a settings card: token card surface + 16px feel via rows
    border:
      "1px solid var(--z-card-border, var(--z-btn-surface-border, color-mix(in srgb, var(--z-fg-primary) 8%, transparent)))",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
  },
});

const Row = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    // a wide control (segmented, swatches) drops below the text on narrow
    // screens instead of squeezing the title
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",
    rowGap: "8px",
    minHeight: "52px",
    // text and controls stay 12 px or more from the border of the card
    paddingBlock: "12px",
    paddingInlineStart: "16px",
    paddingInlineEnd: "16px",
    transition: "background-color 120ms ease",
    _motionReduce: { transition: "none" },

    // inset hairline between rows (starts after the icon column)
    "& + &::before": {
      content: "''",
      position: "absolute",
      top: 0,
      insetInlineStart: "16px",
      insetInlineEnd: "16px",
      height: "1px",
      background: "var(--z-border-subtle)",
    },

    "&[data-clickable='true']": {
      cursor: "pointer",
    },
    "&[data-clickable='true']:hover": {
      background: "var(--z-nav-hover)",
    },
    "&[data-clickable='true']:active": {
      background: "var(--z-nav-selected)",
    },
    "&:focus-visible": {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    "&[data-disabled='true']": {
      opacity: 0.5,
    },
    // icon.css makes icons inside [data-danger] inherit `color`, so the
    // semantic red has to be the inherited colour, not only the variable
    "&[data-danger='true'] [data-row-icon]": {
      "--z-icon-color": "var(--z-icon-danger)",
      color: "var(--z-icon-danger)",
    },
    "&[data-danger='true'] [data-row-title]": {
      color: "var(--z-danger)",
    },
  },
});

const RowIcon = styled("div", {
  base: {
    flexShrink: 0,
    // icons are 20px; avatars and flags may be a little wider
    minWidth: "20px",
    display: "grid",
    placeItems: "center",
    "--z-icon-color": "var(--z-icon-neutral)",

    // plain icons stand on their own, no tile; the slot keeps rows aligned
    // (avatars and flags keep their own shape)
    "&:has(> .z-icon, > [data-icon-mark])": {
      width: "24px",
      height: "24px",
    },
  },
});

const RowText = styled("div", {
  base: {
    flex: "1 1 160px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

const RowTitle = styled("div", {
  base: {
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const RowDescription = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    // each line takes its own direction, so an English fallback inside an
    // RTL page keeps its punctuation where it belongs
    unicodeBidi: "plaintext",
  },
});

const RowSecondary = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
});

const RowChevron = styled("div", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    "--z-icon-color": "var(--z-icon-muted)",
    // RTL: the chevron icon mirrors itself (see styles.css)
  },
});

const RowControl = styled("div", {
  base: {
    flexShrink: 0,
    maxWidth: "100%",
    marginInlineStart: "auto",
    display: "flex",
    alignItems: "center",
  },
});
