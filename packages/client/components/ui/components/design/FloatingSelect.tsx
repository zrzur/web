import { useFloating } from "solid-floating-ui";
import {
  JSX,
  Show,
  children as accessChildren,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";
import { Portal } from "solid-js/web";

import { autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";
import { MotionPresence } from "@revolt/ui/motion";

import { readItemValue } from "./floatingSelectValue";

type FloatingSelectPropsLabel =
  | { required: true; label: string }
  | { required?: false; label?: string };

type FloatingSelectProps = FloatingSelectPropsLabel & {
  value?: string;
  disabled?: boolean;
  variant?: "filled" | "outlined";
  children: JSX.Element;
  onChange?: (event: {
    currentTarget: { value: string; textContent: string | null };
  }) => void;
  onOpened?: () => void;
  /** Lets a `<label for>` name the trigger */
  id?: string;
  /** Names the trigger when there is no visible label */
  "aria-label"?: string;
  /** Extra styles for the trigger (for example, to match a field beside it) */
  class?: string;
};

/**
 * Compact Zrzur select — popover menu, no Material underline field.
 */
export function FloatingSelect(props: FloatingSelectProps) {
  const [local, others] = splitProps(props, [
    "value",
    "label",
    "required",
    "disabled",
    "variant",
    "children",
    "onChange",
    "onOpened",
  ]);

  const [isOpen, setIsOpen] = createSignal(false);
  const [anchor, setAnchor] = createSignal<HTMLButtonElement>();
  const [dropdown, setDropdown] = createSignal<HTMLDivElement>();

  const childrenAccessor = accessChildren(() => local.children);

  const selectedText = () => {
    const items = childrenAccessor.toArray() as HTMLElement[];
    const selected = items.find((item) => readItemValue(item) === local.value);
    return selected?.textContent?.trim() || "";
  };

  const position = useFloating(anchor, dropdown, {
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements, availableHeight, availableWidth }) {
          Object.assign(elements.floating.style, {
            width: `${Math.min(rects.reference.width, availableWidth)}px`,
            maxWidth: `${availableWidth}px`,
            "--z-select-max-height": `${Math.max(0, availableHeight)}px`,
          });
        },
      }),
    ],
  });

  function handleClickOutside(e: MouseEvent) {
    if (!isOpen()) return;
    const target = e.target as Node;
    if (anchor()?.contains(target) || dropdown()?.contains(target)) {
      return;
    }
    setIsOpen(false);
  }

  const items = () =>
    Array.from(
      dropdown()?.querySelectorAll<HTMLElement>(
        '[role="menuitem"], button[data-value]',
      ) ?? [],
    ).filter((el) => !(el as HTMLButtonElement).disabled);

  function focusItem(index: number) {
    const list = items();
    if (!list.length) return;
    list[(index + list.length) % list.length]?.focus();
  }

  function open(focusEdge?: "first" | "last") {
    if (local.disabled) return;
    setIsOpen(true);
    // the menu mounts synchronously; focus the selected item (or an edge)
    queueMicrotask(() => {
      const list = items();
      if (!list.length) return;
      const selected = list.findIndex(
        (item) => readItemValue(item) === local.value,
      );
      if (focusEdge === "last") focusItem(list.length - 1);
      else if (focusEdge === "first") focusItem(0);
      else focusItem(selected >= 0 ? selected : 0);
    });
  }

  function close(returnFocus = true) {
    setIsOpen(false);
    if (returnFocus) anchor()?.focus();
  }

  // Escape closes this menu only: capture phase, before any dialog sees it
  function handleEscape(e: KeyboardEvent) {
    if (!isOpen() || e.key !== "Escape") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close();
  }

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape, true);
    if (props.onOpened) createEffect(() => isOpen() && props.onOpened?.());
  });
  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleEscape, true);
  });

  function handleMenuKey(e: KeyboardEvent) {
    const list = items();
    const current = list.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(current < 0 ? list.length - 1 : current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(list.length - 1);
        break;
      case "Tab":
        // leave the menu; a Dialog may already have moved focus on, else
        // Tab continues from the trigger
        close(!!dropdown()?.contains(document.activeElement));
        break;
    }
  }

  function handleTriggerKey(e: KeyboardEvent) {
    if (local.disabled || isOpen()) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      open();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      open("last");
    }
  }

  function handleItemClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const menuItem = target.closest(
      '[role="menuitem"], mdui-menu-item, button[data-value]',
    ) as HTMLElement | null;
    if (!menuItem) return;
    const value = readItemValue(menuItem);
    if (value != null && local.onChange) {
      local.onChange({
        currentTarget: {
          value,
          textContent: menuItem.textContent,
        },
      });
    }
    close();
  }

  return (
    <>
      <Field>
        <Show when={local.label}>
          <FieldLabel>
            {local.label}
            {local.required && " *"}
          </FieldLabel>
        </Show>
        <SelectTrigger
          ref={setAnchor}
          type="button"
          open={isOpen()}
          aria-haspopup="menu"
          aria-expanded={isOpen()}
          disabled={local.disabled}
          onClick={() => (isOpen() ? close(false) : open())}
          onKeyDown={handleTriggerKey}
          {...others}
        >
          <SelectValue>{selectedText() || "—"}</SelectValue>
          <Icon name="caret-down" size={16} />
        </SelectTrigger>
      </Field>

      <Portal mount={document.getElementById("floating")!}>
        {/* MotionPresence always unmounts after the exit, even when the menu
            closes in the same frame it opened */}
        <MotionPresence when={isOpen()} area="popouts">
          <div
            ref={setDropdown}
            style={{
              position: position.strategy,
              top: `${position.y ?? 0}px`,
              left: `${position.x ?? 0}px`,
              "z-index": "1000",
            }}
          >
            <DropdownMenu
              role="menu"
              onClick={handleItemClick}
              data-floating-menu
              onKeyDown={handleMenuKey}
            >
              {local.children}
            </DropdownMenu>
          </div>
        </MotionPresence>
      </Portal>
    </>
  );
}

const Field = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    width: "100%",
  },
});

const FieldLabel = styled("label", {
  base: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const SelectTrigger = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    width: "100%",
    minHeight: "36px",
    paddingBlock: "7px",
    paddingInline: "12px 10px",
    borderRadius: "8px",
    // same recessed surface as text fields
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-muted)",
    cursor: "pointer",
    textAlign: "start",
    fontSize: "14px",
    fontFamily: "inherit",
    transition: "border-color 0.12s ease, box-shadow 0.12s ease",

    "&:hover": {
      borderColor: "color-mix(in srgb, var(--z-fg-muted) 45%, transparent)",
    },

    "&:focus-visible": {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "2px",
      borderColor: "var(--z-accent)",
    },

    _phone: { minHeight: "44px", fontSize: "16px" },
  },
  variants: {
    open: {
      true: {
        borderColor: "var(--z-accent)",
        // open reads like a focused field: the same crisp ring
        boxShadow: "var(--z-field-focus-shadow)",
      },
    },
    disabled: {
      true: {
        cursor: "not-allowed",
        opacity: 0.45,
      },
    },
  },
});

const SelectValue = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const DropdownMenu = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxHeight: "min(340px, 50dvh, var(--z-select-max-height, 50dvh))",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    overscrollBehavior: "contain",
    "& > *": { flexShrink: 0, minWidth: 0 },
    overflowY: "auto",
    scrollbarWidth: "thin",
    borderRadius: "12px",
    padding: "6px",
    background: "var(--z-popover-bg)",
    color: "var(--z-fg-primary)",
    border: "1px solid var(--z-popover-border)",
    boxShadow: "var(--z-popover-lift)",
  },
});
