import { JSX, Show } from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

/**
 * One titled part of a profile (About me, Links, Roles...). It sits flat on
 * the card: a small label over its content, no box.
 */
export function ProfileSection(props: {
  title?: JSX.Element;
  /** Named when the section has no visible title */
  label?: string;
  /** A small action on the end of the title line */
  action?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <Section aria-label={props.label}>
      <Show when={props.title}>
        <TitleRow>
          <SectionTitle>{props.title}</SectionTitle>
          {props.action}
        </TitleRow>
      </Show>
      {props.children}
    </Section>
  );
}

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    color: "var(--profile-ink-2, var(--z-fg-secondary))",

    // the one rule for the lines between sections: a section that has nothing
    // to show draws nothing, so a line is never skipped or doubled
    "&:not(:first-child)": {
      paddingBlockStart: "12px",
      borderBlockStart: "1px solid var(--profile-line, var(--z-border-subtle))",
    },
  },
});

const TitleRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minWidth: 0,
  },
});

const SectionTitle = styled("h3", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});

/** Sections in a column, at equal space above and below their lines */
export const ProfileCard = styled("div", {
  base: {
    position: "relative",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
});

/** One small chip: a link, a role. The same size wherever it shows. */
export const chip = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: "28px",
    paddingBlock: 0,
    paddingInline: "8px",
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
    background: "var(--profile-chip, var(--z-bg-input))",
    font: "inherit",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 500,
    color: "var(--profile-ink, var(--z-fg-primary))",
    "--z-icon-color": "currentColor",

    "& > :last-child": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& > svg": { flexShrink: 0 },
  },
  variants: {
    press: {
      true: {
        cursor: "pointer",
        transition: "background-color 0.12s ease",
        _hover: {
          background: "var(--profile-chip-hover, var(--z-nav-hover))",
        },
        _active: {
          background: "var(--profile-chip-hover, var(--z-nav-selected))",
        },
        _focusVisible: {
          outline: "2px solid var(--z-focus)",
          outlineOffset: "2px",
        },
        _phone: { minHeight: "44px" },
      },
    },
  },
});

/**
 * The one exception to flat: a creation or a worn item in its own box, in the
 * same theme tint as the chips.
 */
export const itemBox = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    margin: 0,
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--profile-line, var(--z-border-subtle))",
    background: "var(--profile-chip, var(--z-bg-input))",
  },
  variants: {
    tile: {
      true: { flexDirection: "column", gap: "4px", padding: "8px" },
    },
    press: {
      true: {
        width: "100%",
        font: "inherit",
        color: "inherit",
        textAlign: "start",
        cursor: "pointer",
        transition: "background-color 0.12s ease",
        _hover: {
          background: "var(--profile-chip-hover, var(--z-nav-hover))",
        },
        _active: {
          background: "var(--profile-chip-hover, var(--z-nav-selected))",
        },
        _focusVisible: {
          outline: "2px solid var(--z-focus)",
          outlineOffset: "2px",
        },
      },
    },
  },
});

/** Stands in for the sections while they load */
export function ProfileSkeleton() {
  return (
    <Bars aria-hidden="true">
      <i />
      <i />
      <i />
    </Bars>
  );
}

const Bars = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& i": {
      height: "16px",
      borderRadius: "var(--z-radius-sm, 6px)",
      background: "var(--profile-chip, var(--z-bg-input))",
    },
    "& i:first-child": { width: "40%" },
    "& i:last-child": { width: "72%" },
  },
});
