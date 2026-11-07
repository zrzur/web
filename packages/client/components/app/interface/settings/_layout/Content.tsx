import { Accessor, JSX, Setter, Show, createEffect, on } from "solid-js";
import { Motion, Presence } from "solid-motionone";

import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useState } from "@revolt/state";
import { Breadcrumbs, IconButton } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { useMotion } from "@revolt/ui/motion";

import { SettingsList } from "..";
import { useSettingsNavigation } from "../Settings";

/**
 * Content portion of the settings menu
 */
export function SettingsContent(props: {
  onClose?: () => void;
  children: JSX.Element;
  list: Accessor<SettingsList<unknown>>;
  title: (ctx: SettingsList<never>, key: string) => string;
  page: Accessor<string | undefined>;
  ref: Setter<HTMLDivElement | undefined>;
  action: Accessor<(() => JSX.Element) | undefined>;
}) {
  const { navigate } = useSettingsNavigation();
  const { t } = useLingui();
  const { diagDrawer } = useState();
  const motion = useMotion();
  const settings = useState();
  const reduceMotion = () => settings.motion.reduced;
  let column: HTMLDivElement | undefined;

  // the page's one-line description (top-level pages only, not sub-pages)
  const description = () => {
    const page = props.page();
    if (!page || page.includes("/")) return undefined;
    return props
      .list()
      .entries.flatMap((category) => category.entries)
      .find((entry) => entry.id === page)?.description;
  };

  // each settings page animates in when it opens
  createEffect(
    on(props.page, (page) => page && motion.play(column, "settings", "enter"), {
      defer: true,
    }),
  );

  return (
    <div ref={props.ref} use:scrollable={{ class: base }}>
      <Show when={props.page()}>
        <InnerContent class="settings_cont">
          <InnerColumn ref={column}>
            <PhoneBack
              type="button"
              onClick={() => diagDrawer()?.setShown(false)}
            >
              <Icon name="arrow-left" size={20} />
              <Trans>Settings</Trans>
            </PhoneBack>
            <Show when={props.page()}>
              <PageHeader>
                <PageTitle>
                  <Breadcrumbs
                    elements={props.page()!.split("/")}
                    renderElement={(key) =>
                      props.title(props.list() as SettingsList<never>, key)
                    }
                    navigate={(keys) => navigate(keys.join("/"))}
                  />
                </PageTitle>
                <Show when={description()}>
                  <PageDescription>{description()}</PageDescription>
                </Show>
              </PageHeader>
            </Show>
            {props.children}
            <div class={css({ minHeight: "80px" })} />
          </InnerColumn>
        </InnerContent>
      </Show>
      <ActionRail>
        <Show when={props.onClose}>
          <CloseAction class="close">
            <IconButton
              variant="toolbar"
              size="xs"
              aria-label={t`Close settings`}
              aria-keyshortcuts="Escape"
              onPress={props.onClose}
              use:floating={{
                tooltip: {
                  placement: "bottom",
                  content: t`Close settings (Esc)`,
                },
              }}
            >
              {/* outline: the filled Phosphor "x" is an X inside a square */}
              <Icon name="x" size={20} />
            </IconButton>
          </CloseAction>
        </Show>
        <FloatingActions>
          <Presence>
            <Show when={props.action()} keyed>
              {(renderAction) => (
                <Motion.div
                  initial={reduceMotion() ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: {
                      duration: reduceMotion() ? 0 : 0.2,
                      easing: [0.3, 0, 0.8, 0.15],
                    },
                  }}
                  transition={{
                    duration: reduceMotion() ? 0 : 0.3,
                    easing: [0.05, 0.7, 0.1, 1],
                  }}
                  style={{ "transform-origin": "center" }}
                >
                  {renderAction()}
                </Motion.div>
              )}
            </Show>
          </Presence>
        </FloatingActions>
      </ActionRail>
    </div>
  );
}

/**
 * Base styles
 */
const base = css({
  minWidth: 0,
  flex: "1 1 800px",
  flexDirection: "row",
  display: "flex",
  // page panel on the frame, like the main app's channel list + chat
  background: "var(--z-bg-shell)",
  borderTop: "1px solid var(--z-border-subtle)",
  borderInlineStart: "1px solid var(--z-border-subtle)",
  borderStartStartRadius: "10px",

  "& > a": {
    textDecoration: "none",
  },

  _phone: {
    borderRadius: 0,
    borderTop: "none",
    borderInlineStart: "none",
  },

  _tablet: {
    // prevent the fixed action rail from scroll with this element instead of the viewport
    willChange: "auto !important",
  },
});

/**
 * Settings pane
 */
const InnerContent = styled("div", {
  base: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    maxWidth: "920px",
    padding: "32px 40px",
    justifyContent: "stretch",
    zIndex: 1,

    _tablet: { padding: "16px" },
    _phone: { height: "100vh" },
  },
});

/**
 * Pane content column
 */
const InnerColumn = styled("div", {
  base: {
    width: "100%",
    gap: "24px",
    display: "flex",
    flexDirection: "column",
    marginBlockEnd: "40px",
  },
});

/**
 * Phone only: back to the list of settings sections
 */
const PhoneBack = styled("button", {
  base: {
    display: "none",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    padding: "0 12px 0 8px",
    marginInlineStart: "-8px",
    marginBottom: "-8px",
    border: "none",
    borderRadius: "10px",
    background: "none",
    color: "var(--z-fg-muted)",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    "& .z-icon": { _rtl: { transform: "scaleX(-1)" } },
    _hover: { color: "var(--z-fg-primary)" },
    _active: { background: "var(--z-bg-raised)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { display: "inline-flex" },
  },
});

/**
 * Title and the one-line description of the page
 */
const PageHeader = styled("header", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

/**
 * What the page is for, in one short line
 */
const PageDescription = styled("p", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-secondary)",
  },
});

/**
 * Page heading (breadcrumbs for nested pages)
 */
const PageTitle = styled("h1", {
  base: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: "30px",
    color: "var(--z-header-primary, var(--z-fg-primary))",
  },
});

/**
 * Viewport-height rail for settings controls
 */
const ActionRail = styled("div", {
  base: {
    height: "calc(100vh - var(--z-settings-frame-gap, 0px))",
    minWidth: "56px",
    padding: "24px 16px calc(var(--gap-xl) + env(safe-area-inset-bottom))",

    zIndex: 2,
    flexGrow: 1,
    flexShrink: 0,
    alignSelf: "flex-start",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,

    _tablet: {
      position: "fixed",
      insetInlineEnd: 0,
      height: "100dvh",
      padding: "12px",
      paddingBlockEnd: "calc(12px + env(safe-area-inset-bottom))",
      alignItems: "flex-end",
      justifyContent: "flex-end",
      pointerEvents: "none",

      "& > *": {
        pointerEvents: "auto",
      },
    },
  },
});

/**
 * Bottom-end anchor for actions belonging to the current settings page
 */
const FloatingActions = styled("div", {
  base: {
    height: "fit-content",
  },
});

/**
 * Positioning for close button
 */
const CloseAction = styled("div", {
  base: {
    visibility: "visible",

    _tablet: {
      display: "none",
    },
  },
});
