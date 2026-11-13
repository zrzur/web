import type { Accessor, JSX, Setter } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import {
  Show,
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import { Portal } from "solid-js/web";

import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { Button } from "./Button";

export type SnackbarItem = {
  id: string;
  message: string;
  action?: string;
  closeable?: boolean;
  autoCloseDelay?: number;
  messageLine?: 1 | 2;
  placement?:
    | "top"
    | "top-start"
    | "top-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end";
  onAction?: () => void;
  onClose?: () => void;
  closeOnAction?: boolean;
};

export type ShowSnackbarOptions = Omit<SnackbarItem, "id"> & {
  /**
   * Immediately replace the currently visible snackbar instead of queuing.
   * Use when the new message supersedes outdated information already on screen.
   */
  replaceActive?: boolean;
};

/**
 * Manages a queue of active snackbars
 */
export class SnackbarController {
  items: Accessor<SnackbarItem[]>;
  setItems: Setter<SnackbarItem[]>;

  constructor() {
    const [items, setItems] = createSignal<SnackbarItem[]>([]);
    this.items = items;
    this.setItems = setItems;

    this.show = this.show.bind(this);
    this.dismiss = this.dismiss.bind(this);
  }

  /**
   * Push a new snackbar onto the queue, or immediately replace the active one.
   * Snackbars with an action default to no auto-close; without an action they
   * default to 5 seconds.
   * @returns The id of the new snackbar
   */
  show(opts: ShowSnackbarOptions): string {
    const { replaceActive, ...rest } = opts;
    const id = Math.random().toString(36).slice(2);
    const autoCloseDelay = rest.autoCloseDelay ?? (rest.action ? 0 : 5000);
    const item: SnackbarItem = { ...rest, id, autoCloseDelay };

    if (replaceActive) {
      this.setItems((items) => [item, ...items.slice(1)]);
    } else {
      this.setItems((items) => [...items, item]);
    }

    return id;
  }

  /**
   * Remove a snackbar by id
   */
  dismiss(id: string): void {
    this.setItems((items) => items.filter((item) => item.id !== id));
  }
}

export const SnackbarContext = createContext<SnackbarController>();

/**
 * Access the nearest SnackbarController
 */
export function useSnackbar(): SnackbarController {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used inside SnackbarProvider");
  return ctx;
}

type ProviderProps = {
  controller: SnackbarController;
  children: JSX.Element;
};

/**
 * Provides snackbar context and renders the active toast into the floating portal.
 *
 * Position is controlled by `--snackbar-offset-bottom` (default 80px above chatbar).
 */
export function SnackbarProvider(props: ProviderProps) {
  return (
    <SnackbarContext.Provider value={props.controller}>
      {props.children}
      <Portal mount={document.getElementById("floating")!}>
        <Show when={props.controller.items()[0]} keyed>
          {(item) => (
            <Snackbar
              {...item}
              onClose={() => {
                item.onClose?.();
                props.controller.dismiss(item.id);
              }}
              onAction={() => item.onAction?.()}
            />
          )}
        </Show>
      </Portal>
    </SnackbarContext.Provider>
  );
}

type SnackbarProps = SnackbarItem & {
  onClose: () => void;
  onAction: () => void;
};

/**
 * Zrzur toast — replaces MDUI / Material 3 snackbar.
 */
function Snackbar(props: SnackbarProps) {
  const { t } = useLingui();
  const [visible, setVisible] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    requestAnimationFrame(() => setVisible(true));
    if (props.autoCloseDelay && props.autoCloseDelay > 0) {
      timer = setTimeout(() => {
        setVisible(false);
        setTimeout(props.onClose, 160);
      }, props.autoCloseDelay);
    }
  });

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const placement = () => props.placement ?? "bottom";

  return (
    <ToastHost
      data-placement={placement()}
      style={{
        translate: "0 calc(-1 * var(--snackbar-offset-bottom, 80px))",
      }}
    >
      <Toast
        role="status"
        data-visible={visible() ? "true" : "false"}
        data-lines={props.messageLine ?? 1}
      >
        <Message>{props.message}</Message>
        <Show when={props.action}>
          <Button
            variant="text"
            size="sm"
            shape="square"
            onPress={() => {
              props.onAction();
              if (props.closeOnAction !== false) {
                setVisible(false);
                setTimeout(props.onClose, 160);
              }
            }}
          >
            {props.action}
          </Button>
        </Show>
        <Show when={props.closeable}>
          <CloseBtn
            type="button"
            aria-label={t`Dismiss`}
            onClick={() => {
              setVisible(false);
              setTimeout(props.onClose, 160);
            }}
          >
            <Icon name="x" size={14} />
          </CloseBtn>
        </Show>
      </Toast>
    </ToastHost>
  );
}

const ToastHost = styled("div", {
  base: {
    position: "fixed",
    zIndex: "1100",
    left: "50%",
    bottom: "16px",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    width: "min(420px, calc(100vw - 32px))",
    // phones: above the message box and the tabs, clear of the thumb
    _phone: { bottom: "calc(88px + var(--z-safe-bottom))" },

    '&[data-placement="top"], &[data-placement="top-start"], &[data-placement="top-end"]':
      {
        top: "16px",
        bottom: "auto",
      },
    '&[data-placement="bottom-start"], &[data-placement="top-start"]': {
      // start and end follow the reading direction
      left: "auto",
      insetInlineStart: "16px",
      transform: "none",
    },
    '&[data-placement="bottom-end"], &[data-placement="top-end"]': {
      left: "auto",
      insetInlineEnd: "16px",
      transform: "none",
    },
  },
});

const Toast = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    minHeight: "44px",
    boxSizing: "border-box",
    borderRadius: "10px",
    border: "1px solid var(--z-popover-border)",
    background: "var(--z-popover-bg)",
    color: "var(--z-fg-primary)",
    boxShadow: "var(--z-popover-lift)",
    pointerEvents: "all",
    opacity: 0,
    transform: "translateY(8px)",
    transition:
      "opacity 200ms cubic-bezier(0.2, 0, 0, 1), transform 200ms cubic-bezier(0.2, 0, 0, 1)",
    _motionReduce: { transform: "none", transition: "opacity 200ms ease" },

    '&[data-visible="true"]': {
      opacity: 1,
      transform: "translateY(0)",
    },

    '&[data-lines="2"]': {
      alignItems: "flex-start",
    },
  },
});

const Message = styled("span", {
  base: {
    flex: 1,
    fontSize: "13px",
    lineHeight: "20px",
    minWidth: 0,
  },
});

const CloseBtn = styled("button", {
  base: {
    width: "24px",
    height: "24px",
    _phone: {
      width: "44px",
      height: "44px",
      marginBlock: "-8px",
      marginInlineEnd: "-8px",
    },
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    flexShrink: 0,

    _hover: {
      background: "color-mix(in srgb, var(--z-fg-primary) 8%, transparent)",
      color: "var(--z-fg-primary)",
    },
  },
});
