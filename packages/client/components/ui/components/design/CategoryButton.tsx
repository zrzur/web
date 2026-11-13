import {
  ComponentProps,
  For,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  splitProps,
} from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { OverflowingText } from "../utils";

import { Radio2 } from "./Radio";
import { typography } from "./Text";

/**
 * Permissible actions
 */
type Action =
  | "chevron"
  | "collapse"
  | "external"
  | "edit"
  | "copy"
  | JSX.Element;

export interface Props {
  readonly icon?: JSX.Element | "blank";
  readonly children?: JSX.Element;
  readonly description?: JSX.Element;

  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly action?: Action | Action[];

  readonly roundedIcon?: boolean;
  readonly iconBackground?: boolean;

  readonly variant?: "filled" | "tonal" | "tertiary" | "tertiaryAlt";

  readonly ignoreClick?: boolean;
  readonly expanded?: boolean;
}

/**
 * Category Button
 */
export function CategoryButton(props: Props) {
  return (
    <Base
      class="z-cat-row"
      variant={props.variant}
      isLink={!!props.onClick}
      disabled={props.disabled}
      aria-disabled={props.disabled}
      aria-expanded={props.expanded}
      role={props.onClick ? "button" : undefined}
      tabIndex={props.onClick && !props.disabled ? 0 : undefined}
      onKeyDown={(e: KeyboardEvent) => {
        if (!props.onClick || props.disabled || props.ignoreClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
      onClick={(e: Event) => {
        // Disable action when button is disabled
        if (props.disabled || props.ignoreClick) return;

        // Prevent propagation when action is called
        e.preventDefault();
        props.onClick?.();
      }}
    >
      <Show when={props.icon !== "blank"}>
        <IconWrapper
          rounded={props.roundedIcon}
          transparent={props.iconBackground === false}
        >
          {props.icon}
        </IconWrapper>
      </Show>

      <Show when={props.icon === "blank"}>
        <BlankIconWrapper />
      </Show>

      <Content>
        <Show when={props.children}>
          <OverflowingText>{props.children}</OverflowingText>
        </Show>
        <Show when={props.description}>
          <Description>{props.description}</Description>
        </Show>
      </Content>
      <For each={Array.isArray(props.action) ? props.action : [props.action]}>
        {(action) => (
          <Switch fallback={action}>
            <Match when={action === "chevron"}>
              <Action>
                <Icon name="caret-right" size={18} />
              </Action>
            </Match>
            <Match when={action === "collapse"}>
              <Action>
                <Icon name="caret-down" size={18} />
              </Action>
            </Match>
            <Match when={action === "external"}>
              <Action>
                <Icon name="arrow-square-out" size={18} />
              </Action>
            </Match>
            <Match when={action === "copy"}>
              <Action>
                <Icon name="copy" size={18} />
              </Action>
            </Match>
          </Switch>
        )}
      </For>
    </Base>
  );
}

/**
 * Base container for button
 */
const Base = styled("a", {
  base: {
    position: "relative",

    gap: "12px",
    minHeight: "48px",
    flexShrink: 0,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    // text stays 12 px or more from the border, as in SettingsRow
    padding: "11px 14px",
    // a standalone row is its own small panel; inside a Group it becomes a plain row
    borderRadius: "10px",
    // same surface as the settings panels (SettingsSection)
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-bg-raised)",

    userSelect: "none",
    cursor: "pointer",
    transition: "background-color 0.1s ease",

    display: "flex",
    alignItems: "center",
    flexDirection: "row",

    color: "var(--color)",
    fill: "var(--color)",
    "--color": "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-neutral)",

    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
  },
  variants: {
    variant: {
      // all variants are neutral desktop rows; "filled" marks emphasis only
      filled: {
        "--z-icon-color": "var(--z-icon-active)",
      },
      tonal: {},
      tertiary: {
        border: "none",
        background: "transparent",
        boxShadow: "none",
        borderRadius: "6px",
        minHeight: "40px",
      },
      tertiaryAlt: {
        border: "none",
        boxShadow: "none",
        borderRadius: "6px",
        minHeight: "40px",
        background: "var(--z-nav-selected)",
        "--z-icon-color": "var(--z-icon-active)",
      },
    },
    isLink: {
      true: {
        cursor: "pointer",
        _hover: {
          background: "var(--z-nav-selected)",
        },
      },
      false: {
        cursor: "initial",
      },
    },
    disabled: {
      true: {
        cursor: "not-allowed",
        opacity: 0.55,
      },
    },
  },
  defaultVariants: {
    variant: "tonal",
  },
});

/**
 * Title and description styles
 */
const Content = styled("div", {
  base: {
    display: "flex",
    flexGrow: 1,
    minWidth: 0,
    flexDirection: "column",

    fontWeight: 500,
    fontSize: "14px",
    lineHeight: "20px",
    gap: "2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

/**
 * Icon column: a plain role-coloured glyph (no tinted icon box)
 */
const IconWrapper = styled("div", {
  base: {
    color: "var(--z-icon-color)",
    fill: "currentColor",

    width: "20px",
    height: "20px",
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",

    // custom images (avatars, server icons) keep their own shape
    "& img": { borderRadius: "6px" },

    // plain icons stand on their own, like SettingsRow
    "&:has(> .z-icon, > [data-icon-mark])": {
      width: "24px",
      height: "24px",
    },
  },
  variants: {
    rounded: {
      true: {},
      false: {},
    },
    transparent: {
      true: {},
    },
  },
  defaultVariants: {
    rounded: true,
  },
});

/**
 * Category button icon wrapper for the blank state
 */
const BlankIconWrapper = styled(IconWrapper, {
  base: {
    background: "transparent",
  },
});

/**
 * Description shown below title
 */
const Description = styled("span", {
  base: {
    ...typography.raw({ class: "label" }),

    fontSize: "13px",
    fontWeight: 400,
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    textWrap: "wrap",

    "& a:hover": {
      textDecoration: "underline",
    },
  },
});

/**
 * Container for action icons
 */
const Action = styled("div", {
  base: {
    width: "24px",
    height: "24px",
    flexShrink: 0,
    "--z-icon-color": "var(--z-icon-muted)",

    display: "grid",
    placeItems: "center",
  },
});

/**
 * Group a set of category buttons on ONE shared panel with hairline dividers
 */
CategoryButton.Group = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: 0,

    borderRadius: "10px",
    overflow: "hidden",
    // same surface as the settings panels (SettingsSection)
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-bg-raised)",

    "& > div": { border: "none", borderRadius: 0 },
    "& .z-cat-row": {
      border: "none",
      borderRadius: 0,
      background: "transparent",
      boxShadow: "none",
    },
    // hairline between consecutive rows (also when a row is wrapped)
    "& > * + *, & > .z-cat-row + .z-cat-row": {
      boxShadow: "inset 0 1px 0 var(--z-border-subtle)",
    },
  },
});

type CollapseProps = Omit<
  ComponentProps<typeof CategoryButton>,
  "onClick" | "children"
> & {
  children?: JSX.Element;
  title?: JSX.Element;

  scrollable?: boolean;
};

/**
 * Category button with collapsed children
 */
CategoryButton.Collapse = (props: CollapseProps) => {
  const [_, remote] = splitProps(props, ["action", "children"]);

  const [opened, setOpened] = createSignal(false);
  let column: HTMLDivElement | undefined;

  //Toggle the opened state and scroll to the beginning of contents
  const toggleOpened = () => {
    const open = !opened();
    if (open) column?.scroll({ top: 0 });
    setOpened(open);
  };

  return (
    <Details
      class={opened() ? "open" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpened(false);
          (
            e.currentTarget.querySelector(
              "summary [role=button]",
            ) as HTMLElement | null
          )?.focus();
        }
      }}
    >
      <summary>
        <CategoryButton
          {...remote}
          action={[props.action, "collapse"].flat()}
          onClick={toggleOpened}
          expanded={opened()}
        >
          {props.title}
        </CategoryButton>
      </summary>
      <Switch
        fallback={
          <div
            class={innerColumn({ static: true })}
            ref={column!}
            hidden={!opened()}
            data-category-options=""
          >
            {props.children}
          </div>
        }
      >
        <Match when={props.scrollable}>
          <div
            ref={column!}
            hidden={!opened()}
            data-category-options=""
            use:scrollable={{ class: innerColumn() }}
          >
            {props.children}
          </div>
        </Match>
      </Switch>
    </Details>
  );
};

export type CategorySelectOption = Omit<
  ComponentProps<typeof CategoryButton>,
  "onClick" | "children"
> &
  (
    | {
        title: JSX.Element;
        shortDesc?: JSX.Element;
      }
    | {
        title?: JSX.Element;
        shortDesc: JSX.Element;
      }
  );

type SelectProps<T extends string> = Omit<
  ComponentProps<typeof CategoryButton>,
  "onClick" | "children" | "description"
> & {
  title?: JSX.Element;
  options: { [k in T]: CategorySelectOption };
  value?: T;
  onUpdate: (v: T) => void;
};

/**
 * Select dropdown with options from a dictionary
 */
CategoryButton.Select = <T extends string>(props: SelectProps<T>) => {
  const [_, remote] = splitProps(props, [
    "action",
    "options",
    "value",
    "onUpdate",
  ]);

  const [opened, setOpened] = createSignal(false);
  let column: HTMLDivElement | undefined, lastVal: T;

  const opts = createMemo(() => Object.keys(props.options) as T[]);

  const [value, setValue] = createSignal(undefined as unknown as T);

  //Update if props.value changes, but don't run onUpdate
  createRenderEffect(() => {
    //@ts-expect-error Type check breaks
    setValue((lastVal = props.value ?? opts()[0]));
  });

  //Send user input to onUpdate
  createEffect(() => {
    const val = value();
    if (val !== lastVal) props.onUpdate((lastVal = val));
  });

  //Toggle the opened state and scroll to the beginning of contents
  const toggleOpened = () => {
    const open = !opened();
    setOpened(open);
    if (open && column) {
      const item = column.children[opts().indexOf(value())] as
        | HTMLElement
        | undefined;
      if (item)
        column.scrollTop = Math.max(
          0,
          item.offsetTop -
            column.offsetTop -
            column.clientHeight / 2 +
            item.offsetHeight / 2,
        );
    }
  };

  return (
    <Details
      class={opened() ? "open" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpened(false);
          (
            e.currentTarget.querySelector(
              "summary [role=button]",
            ) as HTMLElement | null
          )?.focus();
        }
      }}
    >
      <summary>
        <CategoryButton
          {...remote}
          description={(() => {
            const opt = props.options[value()];
            if (opt) return opt.shortDesc ?? opt.description ?? opt.title;
          })()}
          action={[props.action, "collapse"].flat()}
          onClick={toggleOpened}
          expanded={opened()}
        >
          {props.title}
        </CategoryButton>
      </summary>
      <div
        ref={column!}
        hidden={!opened()}
        data-category-options=""
        use:scrollable={{ class: innerColumn() }}
      >
        <For each={opts()}>
          {(val) => (
            <CategoryButton
              icon="blank"
              variant={value() === val ? "tertiaryAlt" : "tertiary"}
              action={<Radio2.Option checked={value() === val} />}
              onClick={() => {
                setValue(() => val);
                setOpened(false);
              }}
              {...props.options[val]}
            >
              {props.options[val].title ?? props.options[val].shortDesc}
            </CategoryButton>
          )}
        </For>
      </div>
    </Details>
  );
};

/**
 * Column with inner content
 */
const innerColumn = cva({
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "6px",
    maxHeight: "min(340px, 50dvh)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    minWidth: 0,
    "&[hidden]": { display: "none" },
    "& > *": { flexShrink: 0, minWidth: 0 },
    "& > .z-cat-row": {
      borderRadius: "6px",
      boxShadow: "none",
      minHeight: "44px",
    },
    "& > .z-cat-row:has(input:checked)": {
      background: "var(--z-nav-selected)",
    },

    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
  },
  variants: {
    static: {
      true: {
        maxHeight: "none",
        overflow: "visible",
      },
    },
  },
});

/**
 * Parent base component
 */
const Details = styled("div", {
  base: {
    minWidth: 0,
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "10px",
    overflow: "hidden",
    background: "color-mix(in srgb, var(--z-bg-sidebar) 70%, var(--z-bg-chat))",
    "& > summary": { listStyle: "none" },
    "& > summary > .z-cat-row": {
      border: "none",
      borderRadius: 0,
      background: "transparent",
      boxShadow: "none",
    },
    "& > summary::marker, & > summary::-webkit-details-marker": {
      display: "none",
    },
    "& > summary svg": { transition: "transform 0.15s ease" },
    "&.open > summary > .z-cat-row > div:last-child svg": {
      transform: "rotate(180deg)",
    },
    "&.open > [data-category-options]": {
      borderTop: "1px solid var(--z-border-subtle)",
    },
    "@media (prefers-reduced-motion: reduce)": {
      "& > summary svg": { transition: "none" },
    },
  },
});
