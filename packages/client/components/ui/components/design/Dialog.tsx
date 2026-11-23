import type { JSX } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import {
  For,
  Show,
  createEffect,
  createUniqueId,
  on,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js";
import { Portal } from "solid-js/web";

import { styled } from "styled-system/jsx";

import { type IconName, Icon } from "@revolt/ui/icons/Icon";
import { MotionPresence, useMotion } from "@revolt/ui/motion";

import Breakpoint from "../../../common/Breakpoint";

import { backCloses } from "@revolt/common/lib/backCloses";
import { PageBoundary } from "../utils/PageBoundary";
import { Button } from "./Button";
import { typography } from "./Text";
import { sheetSwipe } from "./sheetSwipe";

export interface DialogProps {
  show: boolean;
  onClose: () => void;
  /** Id of the rendering modal, for ModalController.guardClose */
  modalId?: string;
}

export interface DialogAction {
  text: JSX.Element;
  onClick?: () => void | Promise<unknown> | true | false;
  isDisabled?: boolean;
  /** Shows a spinner and blocks the action while true */
  isLoading?: boolean;
  /**
   * Visual weight. When omitted the last action is primary (destructive in
   * a danger dialog) and the others are neutral secondary buttons.
   */
  variant?:
    | "primary"
    | "secondary"
    | "destructive"
    | "success"
    | "text"
    // a secondary button with a warning label (Report)
    | "warning";
}

/**
 * What a dialog is about. The tone picks the icon shown inside the main
 * action (the trash in Delete) and makes the confirm button red in a
 * danger dialog. The surface itself stays neutral.
 */
export type DialogTone =
  | "danger"
  | "create"
  | "invite"
  | "edit"
  | "settings"
  | "security"
  | "warning"
  | "success"
  | "info"
  | "premium";

/** Default icon of each tone (iconName overrides it) */
const TONE_ICON: Record<DialogTone, IconName> = {
  danger: "trash",
  create: "plus",
  invite: "user-plus",
  edit: "pencil-simple",
  settings: "sliders-horizontal",
  security: "shield-check",
  warning: "warning",
  success: "check-circle",
  info: "info",
  premium: "sparkle",
};

type Props = DialogProps & {
  /** @deprecated dialogs show no header icon any more; use `tone` */
  icon?: JSX.Element;
  /** What the dialog is about: sets the icon in the main action */
  tone?: DialogTone;
  /** A more specific icon for the tone (e.g. "sign-out" for leaving) */
  iconName?: IconName;
  title?: JSX.Element;
  /** Short supporting copy under the title */
  description?: JSX.Element;
  /** Compact creation form layout, using the current Zrzur theme. */
  appearance?: "creation";
  /**
   * Phones: a page that fills the screen (centred title, no grab mark)
   * instead of a sheet. For a flow with several steps or a long list.
   */
  phonePage?: boolean;
  children: JSX.Element;
  actions?: DialogAction[];
  isDisabled?: boolean;

  /** Inline error shown above the footer (instead of a second error modal) */
  error?: JSX.Element;

  /**
   * Ignore clicks on the backdrop, e.g. while a form has unsaved input.
   * Escape, the close button and Cancel still work.
   */
  persistent?: boolean;

  scrimBackground?: string;

  minWidth?: number;
  padding?: number;

  /**
   * Semantic width:
   * sm 420 (confirmations), md 500 (forms), lg 600, xl 760
   */
  size?: "sm" | "md" | "lg" | "xl";

  /** Show top-right close control */
  showClose?: boolean;

  /** No padding and clipped corners: the body lays itself out edge to edge */
  bare?: boolean;

  /** Explicit width in px (overrides size) */
  width?: number;

  /**
   * The actions come at the end of the body and scroll with it, in one row
   * that never wraps (a long form: the person reads to the end, then
   * decides; owner, 2026-11-20). Without it they stay on the bottom edge.
   */
  actionsAtEnd?: boolean;
};

const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Zrzur dialog: the one desktop modal shell for every app overlay.
 *
 * [title ............ x]
 * [description]
 * [body, scrolls on its own when tall]
 * [inline error]
 * [            secondary  primary]
 */
export function Dialog(props: Props) {
  const { t } = useLingui();
  const motion = useMotion();
  const titleId = createUniqueId();
  const descriptionId = createUniqueId();
  let dialogElement: HTMLDivElement | undefined;
  let sheetElement: HTMLDivElement | undefined;
  let scrimElement: HTMLDivElement | undefined;

  // phones: the dialog is a sheet that rises from the bottom edge and can be
  // pulled down by its handle or header to close
  const phone = window.matchMedia(Breakpoint.phone).matches;

  // the dimmed page behind the dialog has its own animation settings
  createEffect(
    on(
      () => !!props.show,
      (show) =>
        motion.play(scrimElement, "backdrop", show ? "enter" : "exit", {
          backdrop: true,
        }),
    ),
  );

  // phones: Back closes the dialog and leaves the page under it alone
  backCloses(
    () => !!props.show && !props.persistent,
    () => props.onClose(),
  );

  // phones: the sheet closes by a pull down from anywhere on it, unless its
  // content is scrolled away from the top (sheetSwipe.ts); a sheet that
  // must be answered (persistent) does not move
  const swipe = sheetSwipe(
    () => sheetElement,
    () => props.onClose(),
    () => phone && !props.persistent,
  );
  createEffect(() => {
    if (!props.show) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        dialogElement?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter(
        (element) =>
          element.getClientRects().length > 0 && !element.closest("[inert]"),
      );
    // land on the first text field, so the dialog opens ready to type;
    // without one the dialog itself takes focus (it draws no ring), so no
    // select, button or X lights up just because the dialog opened
    const initialFocus = () => {
      // bare dialogs (profiles) are read first, not typed into
      if (untrack(() => props.bare)) return dialogElement;
      return (
        focusable().find((el) =>
          el.matches(
            "textarea, input:not([type=checkbox], [type=radio], [type=file], [type=range], [type=color], [type=button], [type=submit])",
          ),
        ) ?? dialogElement
      );
    };
    queueMicrotask(() => {
      if (
        untrack(() => props.show) &&
        dialogElement &&
        !dialogElement.contains(document.activeElement)
      ) {
        // a click that opened the dialog must not leave text selected in it
        window.getSelection()?.removeAllRanges();
        // no scrolling: a phone sheet is still rising from under the edge
        // when it takes the focus, and the browser scrolled the page behind
        // it to follow (the sheet then rested 3 px above the bottom edge)
        initialFocus()?.focus({ preventScroll: true });
      }
    });
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      );
      if (dialogs[dialogs.length - 1] !== dialogElement) return;
      // the select trigger of this dialog whose menu is open, if any
      const openTrigger = dialogElement?.querySelector<HTMLElement>(
        '[aria-haspopup="menu"][aria-expanded="true"]',
      );
      // an open select menu owns Escape (it closes itself first)
      if (e.key === "Escape" && openTrigger) return;
      // any inner control that is showing a confirmation owns Escape too
      if (
        e.key === "Escape" &&
        dialogElement?.querySelector("[data-owns-escape]")
      )
        return;
      // Tab out of the menu (it lives in #floating, outside the dialog):
      // step back to its trigger, then run the normal trap from there
      if (
        e.key === "Tab" &&
        openTrigger &&
        (document.activeElement as HTMLElement | null)?.closest(
          "[data-floating-menu]",
        )
      )
        openTrigger.focus();
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
      } else if (e.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          e.preventDefault();
          dialogElement?.focus({ preventScroll: true });
        } else if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialogElement?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialogElement?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    onCleanup(() => {
      document.removeEventListener("keydown", onKey, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    });
  });

  const actions = () => props.actions ?? [];
  const actionVariant = (action: DialogAction, index: number) => {
    if (action.variant) return action.variant;
    const list = actions();
    if (index === list.length - 1)
      return props.tone === "danger" ? "destructive" : "primary";
    return "secondary";
  };

  const buttonVariant = (v: ReturnType<typeof actionVariant>) => {
    if (v === "primary") return "filled" as const;
    if (v === "destructive") return "_error" as const;
    if (v === "success") return "success" as const;
    if (v === "secondary" || v === "warning") return "tonal" as const;
    return "text" as const;
  };

  /*
   * The tone's icon rides inside the dialog's main action (the last
   * primary / destructive / success button), next to its label: the
   * trash in Delete, the plus in Create, the person in Invite.
   */
  const actionIcon = (action: DialogAction, index: number) => {
    if (!props.tone || action.isLoading) return;
    if (index !== actions().length - 1) return;
    const variant = actionVariant(action, index);
    if (variant === "text" || variant === "secondary" || variant === "warning")
      return;
    return (
      <Icon
        name={props.iconName ?? TONE_ICON[props.tone]}
        size={16}
        styleVariant="outline"
      />
    );
  };

  /** The buttons of the actions, in the order given */
  const actionButtons = () => (
    <For each={actions()}>
      {(action, index) => (
        <Button
          variant={buttonVariant(actionVariant(action, index()))}
          size="md"
          shape="square"
          aria-busy={action.isLoading || undefined}
          onPress={() => {
            if (action.isDisabled || action.isLoading) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = action.onClick?.() as any;
            if (value instanceof Promise) {
              value.then(props.onClose).catch(() => {});
            } else if (value !== false) {
              props.onClose();
            }
          }}
          isDisabled={
            action.isDisabled ||
            action.isLoading ||
            props.isDisabled
          }
        >
          <Show when={action.isLoading}>
            <Spinner aria-hidden="true" />
          </Show>
          {actionIcon(action, index())}
          <Show
            when={action.variant === "warning"}
            fallback={action.text}
          >
            <WarningLabel>{action.text}</WarningLabel>
          </Show>
        </Button>
      )}
    </For>
  );

  return (
    <Portal mount={document.getElementById("floating")!}>
      <Dialog.Scrim
        ref={scrimElement}
        sheet
        show={props.show}
        onClick={() => {
          if (!props.persistent) props.onClose();
        }}
        style={{
          "--background": props.scrimBackground
            ? `url('${props.scrimBackground}'), var(--z-scrim, rgba(6, 8, 12, 0.7))`
            : "var(--z-scrim, rgba(6, 8, 12, 0.7))",
          // motion settings drive the fade (see the effect above)
          "animation-name": "none",
          "transition-duration": `${motion.duration("backdrop", "exit")}ms`,
        }}
      >
        <MotionPresence when={props.show} area="modals" sheet={phone}>
          <div
            ref={dialogElement}
            class="dialog z-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={props.title ? titleId : undefined}
            aria-describedby={props.description ? descriptionId : undefined}
            tabIndex={-1}
            style={{
              width: "100%",
              display: "grid",
              "place-items": "center",
            }}
          >
            <Container
              ref={sheetElement}
              onTouchStart={swipe.onTouchStart}
              onTouchMove={swipe.onTouchMove}
              onTouchEnd={swipe.onTouchEnd}
              onTouchCancel={swipe.onTouchCancel}
              data-creation={props.appearance === "creation"}
              data-phone-page={props.phonePage ? "true" : undefined}
              size={props.size ?? "md"}
              data-size={props.size ?? "md"}
              bare={props.bare}
              style={{
                "min-width": props.minWidth
                  ? `min(${props.minWidth}px, calc(100vw - 32px))`
                  : undefined,
                padding: props.padding ? `${props.padding}px` : undefined,
                "--z-dialog-width": props.width
                  ? `${props.width}px`
                  : props.appearance === "creation" && !props.size
                    ? "440px"
                    : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Grabber data-sheet-drag aria-hidden="true" />
              <Show when={props.title || props.description}>
                <Header data-dialog-header data-sheet-drag>
                  <HeaderText>
                    <Show when={props.title}>
                      <Title id={titleId}>{props.title}</Title>
                    </Show>
                    <Show when={props.description}>
                      <Description id={descriptionId}>
                        {props.description}
                      </Description>
                    </Show>
                  </HeaderText>
                </Header>
              </Show>

              <Show when={props.showClose !== false && props.title}>
                <CloseBtn
                  type="button"
                  data-dialog-close
                  aria-label={t`Close`}
                  title={t`Close (Esc)`}
                  onClick={props.onClose}
                >
                  <Icon name="x" size={18} />
                </CloseBtn>
              </Show>

              <Body class={typography()} data-dialog-body>
                {/* a part inside the window that could not be downloaded
                    says so here: the window and what was typed stay */}
                <PageBoundary>{props.children}</PageBoundary>
                <Show when={actions().length && props.actionsAtEnd}>
                  <Actions data-dialog-actions data-at-end>
                    {actionButtons()}
                  </Actions>
                </Show>
              </Body>

              <Show when={props.error}>
                <ErrorBanner role="alert">
                  <Icon name="warning-circle" size={18} />
                  <span>{props.error}</span>
                </ErrorBanner>
              </Show>

              <Show when={actions().length && !props.actionsAtEnd}>
                <Actions data-dialog-actions>{actionButtons()}</Actions>
              </Show>
            </Container>
          </div>
        </MotionPresence>
      </Dialog.Scrim>
    </Portal>
  );
}

/**
 * Full-screen scrim shown below dialogs
 */
Dialog.Scrim = (
  props: Omit<
    Parameters<typeof Scrim>[0] & Parameters<typeof ScrimSurface>[0],
    "class"
  >,
) => {
  const [local, remote] = splitProps(props, [
    "children",
    "padding",
    "overflow",
    "sheet",
  ]);

  return (
    <Scrim {...remote} class="dialog_scrim">
      <ScrimSurface {...local} />
    </Scrim>
  );
};

const Scrim = styled("div", {
  base: {
    top: 0,
    left: 0,
    right: 0,
    bottom: "var(--z-screen-bottom, 0px)",
    position: "fixed",
    zIndex: "998",
    maxHeight: "100%",
    paddingBottom: "env(keyboard-inset-height)",

    animationName: "scrimFadeIn",
    animationDuration: "0.12s",
    animationFillMode: "forwards",
    transition: "var(--transitions-medium) all",
  },
  variants: {
    show: {
      false: {
        animationName: "unset",
        pointerEvents: "none",
        background: "transparent",
        // the surface inside takes clicks while open; a closed dialog that
        // stays mounted must not leave an invisible layer over the page
        "& > *": { pointerEvents: "none" },
      },
    },
    dark: {
      true: {
        "--background": "rgba(0, 0, 0, 0.88)",
      },
      false: {
        "--background": "rgba(6, 8, 12, 0.7)",
      },
    },
  },
  defaultVariants: {
    show: true,
    dark: false,
  },
});

const ScrimSurface = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    display: "grid",
    userSelect: "none",
    placeItems: "center",
    pointerEvents: "all",
  },
  variants: {
    padding: {
      true: {
        padding: "32px 24px",
        _phone: { padding: "16px" },
      },
    },
    overflow: {
      true: {
        overflowY: "auto",
      },
    },
    sheet: {
      true: {
        // the sheet sits on top of the on-screen keyboard while typing
        _phone: {
          alignItems: "end",
          padding: "0 !important",
          paddingBottom:
            "max(var(--keyboard-inset, 0px), env(keyboard-inset-height, 0px)) !important",
        },
      },
    },
  },
  defaultVariants: {
    padding: true,
    overflow: true,
  },
});

const Container = styled("div", {
  base: {
    position: "relative",
    // compact by default (owner review 2026-11-01: windows felt too big)
    padding: "20px",
    width: "min(100%, var(--z-dialog-width, 440px))",
    maxWidth: "calc(100vw - 32px)",
    // the body scrolls instead of the whole dialog, so the title and the
    // footer actions stay reachable on short windows
    // never the full window height: tall content scrolls inside (owner review)
    maxHeight: "min(calc(100dvh - 96px), 640px)",
    borderRadius: "14px",
    border: "1px solid var(--z-popover-border, var(--z-border-strong))",
    // floating surface language shared with menus and popovers
    boxShadow: "var(--z-popover-lift)",
    userSelect: "text",

    display: "flex",
    flexDirection: "column",

    color: "var(--z-fg-primary)",
    background:
      "var(--z-dialog-bg, var(--z-popover-bg, var(--z-bg-modal, var(--z-bg-raised))))",
    // inside a dialog everything is as on the Settings page: its boxes,
    // dividers, labels, icons and buttons (owner, 2026-11-20); the window
    // keeps only its own border and shadow, as it floats

    "&[data-creation='true']": {
      boxSizing: "border-box",
      width: "min(100%, var(--z-dialog-width, 440px))",
      padding: "20px",
      borderRadius: "14px",
      // a creation form shows whole where the window allows it, so its last
      // row is not cut in half at the fold
      maxHeight: "min(calc(100dvh - 96px), 720px)",
      "& [data-dialog-header]": { marginBlockEnd: "20px" },
      "& .z-text-field": { width: "100%", minWidth: 0 },
      "& [data-dialog-actions]": {
        marginBlockStart: "20px",
        paddingBlockStart: "20px",
        borderTop: "1px solid var(--z-border-subtle)",
        gap: "12px",
      },
      "@media (max-width: 479px)": {
        padding: "16px",
        maxHeight: "calc(100dvh - 32px)",
      },
    },

    // phones: a sheet on the bottom edge, full width, rounded on top only
    _phone: {
      width: "100% !important",
      minWidth: "0 !important",
      maxWidth: "100%",
      maxHeight:
        "calc(100dvh - 40px - var(--z-safe-top) - max(var(--keyboard-inset, 0px), env(keyboard-inset-height, 0px))) !important",
      // everything but a short confirmation fills the screen below a strip
      // at the top; the body grows and the actions stay on the bottom edge
      "&:not([data-size='sm'])": {
        height:
          "calc(100dvh - 48px - var(--z-safe-top) - max(var(--keyboard-inset, 0px), env(keyboard-inset-height, 0px)))",
        "& > [data-dialog-body]": { flex: "1 1 auto" },
      },
      paddingTop: "28px !important",
      paddingInline: "16px !important",
      paddingBottom: "calc(16px + var(--z-safe-bottom)) !important",
      // the same corners as the menus' sheet, and no line on any side: a
      // top-only border thins out round the corners (owner, 2026-11-17)
      borderRadius: "20px 20px 0 0 !important",
      border: "none !important",
      // a body that lays itself out to the sheet's edges
      "&:has([data-sheet-edge])": { padding: "0 !important" },
      // a page: the whole screen under the status bar, square corners, the
      // title in the middle; the body grows so its last block can sit on
      // the bottom edge
      "&[data-phone-page='true']": {
        height:
          "calc(100dvh - var(--z-safe-top) - max(var(--keyboard-inset, 0px), env(keyboard-inset-height, 0px))) !important",
        maxHeight:
          "calc(100dvh - var(--z-safe-top) - max(var(--keyboard-inset, 0px), env(keyboard-inset-height, 0px))) !important",
        paddingTop: "12px !important",
        borderRadius: "0 !important",
        "& > [data-sheet-drag][aria-hidden='true']": { display: "none" },
        "& [data-dialog-header]": {
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          paddingBlock: "36px 8px",
        },
        "& [data-dialog-header] h2": { fontSize: "22px", lineHeight: 1.3 },
        "& > [data-dialog-body]": {
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
        },
        "& > [data-dialog-body] > *": { flex: "1 1 auto" },
      },
    },
  },
  variants: {
    size: {
      sm: {
        "--z-dialog-width": "380px",
      },
      md: {
        "--z-dialog-width": "440px",
      },
      lg: {
        "--z-dialog-width": "520px",
      },
      xl: {
        "--z-dialog-width": "680px",
      },
    },
    bare: {
      true: {
        padding: 0,
        overflow: "hidden",
        "& > [data-dialog-body]": {
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
});

/**
 * Phone sheet: the strip along the top edge that pulls the sheet down to
 * close. Nothing is drawn (owner, 2026-11-17: no bar on the sheets); a sheet
 * also closes by its X, by a tap outside it and by Back.
 */
const Grabber = styled("div", {
  base: {
    display: "none",
    _phone: {
      display: "block",
      position: "absolute",
      top: 0,
      insetInline: 0,
      height: "16px",
      zIndex: 2,
    },
  },
});

/**
 * Title
 * One line on what happens
 */
const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    paddingInlineEnd: "36px",
    marginBlockEnd: "20px",
  },
  variants: {
    withIcon: {
      true: {},
    },
  },
});

const HeaderText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    flex: 1,
  },
});

const CloseBtn = styled("button", {
  base: {
    position: "absolute",
    top: "16px",
    insetInlineEnd: "16px",
    width: "32px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "50%",
    background: "transparent",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    transition: "background-color 120ms ease, color 120ms ease",
    _motionReduce: { transition: "none" },
    // phones: no X on a sheet (owner, 2026-11-17). It closes by a pull
    // down, a tap outside it, Escape or Back. The button stays in the tree,
    // out of sight, so a screen reader and a keyboard still find "Close".
    _phone: {
      top: "8px",
      insetInlineEnd: "4px",
      width: "44px",
      height: "44px",
      opacity: 0,
      pointerEvents: "none",
      "&:focus-visible": { opacity: 1, pointerEvents: "auto" },
    },

    _hover: {
      color: "var(--z-fg-primary)",
      background: "var(--z-float-hover)",
    },
    "&:active": { background: "var(--z-float-button-hover)" },

    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
  },
});

const Title = styled("h2", {
  base: {
    ...typography.raw({ class: "headline", size: "small" }),
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: "26px",
    color: "var(--z-header-primary, var(--z-fg-primary))",
    overflowWrap: "anywhere",
  },
});

const Description = styled("p", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-secondary)",
  },
});

const Body = styled("div", {
  base: {
    minHeight: 0,
    flexShrink: 1,
    overflowY: "auto",
    // room for focus rings of full-width fields
    marginInline: "-3px",
    paddingInline: "3px",
    paddingBlock: "3px",
    marginBlock: "-3px",
    overscrollBehavior: "contain",
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    lineHeight: "24px",
  },
});

/**
 * What an action is about to touch, shown as a small card in the body:
 * [icon] Name
 *        what goes with it
 */
export const DialogSubject = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    "--z-icon-color": "var(--z-fg-muted)",
    color: "var(--z-fg-muted)",

    "& > div": {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      gap: "2px",
    },
    "& strong": {
      fontSize: "15px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const ErrorBanner = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginBlockStart: "16px",
    padding: "8px 12px",
    borderRadius: "var(--z-box-radius)",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    "--z-icon-color": "var(--z-danger)",

    "& > .z-icon": { marginBlockStart: "0px" },
  },
});

const WarningLabel = styled("span", {
  base: { color: "var(--z-float-warning, var(--z-danger))" },
});

const Actions = styled("div", {
  base: {
    gap: "8px",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    marginBlockStart: "20px",
    // phones: full-width buttons, the primary on top of the others
    _phone: {
      flexDirection: "column-reverse",
      alignItems: "stretch",
      "& > button": { width: "100%" },
    },
    // at the end of a long form: one row in the given order, never wrapped;
    // on phones the buttons share the row
    "&[data-at-end]": {
      flexWrap: "nowrap",
      marginBlockStart: "24px",
      paddingBlockStart: "20px",
      borderTop: "1px solid var(--z-border-subtle)",
      "& > button": { flex: "none", whiteSpace: "nowrap" },
      _phone: {
        flexDirection: "row",
        alignItems: "center",
        gap: "8px",
        paddingBlockEnd: "4px",
        "& > button": {
          width: "auto",
          flex: "1 1 auto",
          minWidth: 0,
          paddingInline: "8px",
          fontSize: "14px",
        },
        // the words carry the buttons here: no icon beside them
        "& > button .z-icon": { display: "none" },
      },
    },
  },
});

const Spinner = styled("span", {
  base: {
    width: "14px",
    height: "14px",
    // the button's own 8 px gap sets it apart from the label
    flexShrink: 0,
    borderRadius: "50%",
    border: "2px solid currentColor",
    borderInlineEndColor: "transparent",
    animation: "spin 0.7s linear infinite",
    "@media (prefers-reduced-motion: reduce)": {
      animationDuration: "1.6s",
    },
  },
});
