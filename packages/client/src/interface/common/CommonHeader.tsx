import { JSX, Match, Switch } from "solid-js";

import { arrow_back as MdArrowBack } from "@revolt/ui/icons/legacy";

import { useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";

import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Wrapper for header icons which adds the chevron on the
 * correct side for toggling sidebar (if on desktop) and
 * the hamburger icon to open sidebar (if on mobile).
 */
export function HeaderIcon(props: {
  children: JSX.Element;
  onToggle?: () => void;
  expanded?: boolean;
  /**
   * Full pages without the sidebar: the chevron goes back instead
   */
  onBack?: () => void;
}) {
  const state = useState();
  const { t } = useLingui();

  const expanded = () =>
    props.expanded ??
    state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true);

  return (
    <button
      type="button"
      aria-label={props.onBack ? t`Back` : t`Toggle main sidebar`}
      aria-expanded={props.onBack ? undefined : expanded()}
      class={container}
      onClick={() => {
        if (props.onBack) {
          props.onBack();
          return;
        }
        if (props.onToggle) {
          props.onToggle();
          return;
        }
        const ad = state.appDrawer();
        if (ad) ad.setShown(false);
        else
          state.layout.toggleSectionState(
            LAYOUT_SECTIONS.PRIMARY_SIDEBAR,
            true,
          );
      }}
      use:floating={{
        tooltip: {
          placement: "bottom",
          content: props.onBack ? t`Back` : t`Toggle main sidebar`,
        },
      }}
    >
      <Switch
        fallback={
          <>
            <Icon name="caret-right" size={20} />
            {props.children}
          </>
        }
      >
        <Match when={props.onBack}>
          <Icon name="caret-left" size={20} />
          {props.children}
        </Match>
        <Match when={!props.onToggle && state.appDrawer()}>
          <MdArrowBack />
        </Match>
        <Match when={expanded()}>
          <Icon name="caret-left" size={20} />
          {props.children}
        </Match>
      </Switch>
    </button>
  );
}

const container = css({
  // phones: a 44 px tap target (phone rules)
  _phone: { minWidth: "44px", minHeight: "44px" },
  border: "none",
  background: "transparent",
  color: "inherit",
  padding: "4px",
  borderRadius: "6px",
  _focusVisible: { outline: "2px solid var(--z-focus)" },
  display: "flex",
  cursor: "pointer",
  alignItems: "center",
  gap: "2px",
  marginInlineStart: "-6px",
  "--z-icon-color": "var(--z-icon-muted)",

  // sidebar-toggle chevron stays quiet until the user reaches for it
  "& > svg": {
    color: "var(--z-fg-muted)",
    opacity: 0.45,
    transition: "opacity 0.12s ease",
  },
  "&:hover > svg": {
    opacity: 1,
  },
  // RTL: the sidebar sits on the right, so the chevron and back arrow mirror
  "[dir='rtl'] &": {
    "& > svg": { scale: "-1 1" },
  },
});
