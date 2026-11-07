import { JSX, Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { Button } from "./Button";
import { useUnsavedChanges } from "./UnsavedChanges";

/*
 * Form building blocks shared by every settings page that edits something
 * (Profile, server Overview, roles, emojis, permissions), so they all look
 * and behave the same: fields on a padded panel, image pickers as rows, and
 * one sticky save bar that only appears when there is something to save.
 */

/**
 * The padded body of a SettingsSection. A section gives its content no
 * padding, because rows bring their own: anything that is not a row goes in
 * here. `settings-box-padding.mjs` fails on what sits too close to the border.
 */
export const SettingsFormPanel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
  },
});

/** [image picker] [title / explanation] row inside a SettingsSection */
export function SettingsMediaRow(props: {
  picker: JSX.Element;
  title: JSX.Element;
  description?: JSX.Element;
}) {
  return (
    <MediaRow>
      {props.picker}
      <MediaText>
        <strong>{props.title}</strong>
        <Show when={props.description}>
          <span>{props.description}</span>
        </Show>
      </MediaText>
    </MediaRow>
  );
}

/**
 * Identity block: the icon picker on the left with the fields it belongs to
 * (name, description…) beside it, like Discord's overview pages. Stacks on
 * narrow screens.
 */
export function SettingsIdentityPanel(props: {
  picker: JSX.Element;
  caption?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <Identity>
      <IdentityMedia>
        {props.picker}
        <Show when={props.caption}>
          <span>{props.caption}</span>
        </Show>
      </IdentityMedia>
      <IdentityFields>{props.children}</IdentityFields>
    </Identity>
  );
}

/**
 * Sticky bar at the bottom of the settings scroller while changes are
 * pending: "Unsaved changes · Reset · Save changes", or the error
 */
export function SettingsSaveBar(props: {
  show: boolean;
  saving?: boolean;
  error?: string;
  canSave?: boolean;
  onReset: () => void;
  /** Omit when the bar sits inside a <form> (Save submits it) */
  onSave?: () => void;
  saveLabel?: JSX.Element;
}) {
  const { t } = useLingui();
  // switching page or closing settings is held back while this is dirty;
  // when that happens the bar nudges and says why
  const attention = useUnsavedChanges(() => props.show || !!props.saving);
  const [nudge, setNudge] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      attention,
      () => {
        setNudge(true);
        clearTimeout(timer);
        timer = setTimeout(() => setNudge(false), 2400);
      },
      { defer: true },
    ),
  );
  onCleanup(() => clearTimeout(timer));

  return (
    <Show when={props.show || props.saving || props.error}>
      <Bar
        role="region"
        aria-label={t`Unsaved changes`}
        data-attention={nudge() || undefined}
      >
        <BarText
          data-error={!!props.error}
          data-attention={(nudge() && !props.error) || undefined}
          aria-live="polite"
        >
          <Show
            when={props.error}
            fallback={
              <Show when={nudge()} fallback={<Trans>Unsaved changes</Trans>}>
                <Icon name="warning-circle" size={18} />
                <Trans>Save or reset your changes first.</Trans>
              </Show>
            }
          >
            <Icon name="warning-circle" size={18} />
            {props.error}
          </Show>
        </BarText>
        <Button
          variant="text"
          size="md"
          shape="square"
          isDisabled={props.saving}
          onPress={props.onReset}
        >
          <Trans>Reset</Trans>
        </Button>
        <Button
          type={props.onSave ? "button" : "submit"}
          size="md"
          shape="square"
          isDisabled={props.saving || props.canSave === false}
          onPress={props.onSave}
        >
          <Show
            when={props.saving}
            fallback={props.saveLabel ?? <Trans>Save changes</Trans>}
          >
            <Trans>Saving…</Trans>
          </Show>
        </Button>
      </Bar>
    </Show>
  );
}

const MediaRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "14px",
    flexWrap: "wrap",

    "& + &": {
      borderTop: "1px solid var(--z-border-subtle)",
    },
  },
});

const MediaText = styled("div", {
  base: {
    flex: "1 1 180px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",

    "& strong": {
      fontSize: "14px",
      fontWeight: 500,
      lineHeight: "20px",
      color: "var(--z-fg-primary)",
    },
  },
});

const Identity = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "start",
    gap: "24px",
    padding: "16px",

    "@media (max-width: 560px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "16px",
    },
  },
});

const IdentityMedia = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    width: "120px",
    paddingTop: "4px",

    "& > span": {
      fontSize: "11px",
      lineHeight: "15px",
      textAlign: "center",
      color: "var(--z-fg-muted)",
    },

    "@media (max-width: 560px)": {
      width: "auto",
      flexDirection: "row",
      "& > span": { textAlign: "start" },
    },
  },
});

const IdentityFields = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
});

const Bar = styled("div", {
  base: {
    position: "sticky",
    bottom: "16px",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingBlock: "10px",
    paddingInline: "16px 10px",
    borderRadius: "10px",
    border: "1px solid var(--z-popover-border)",
    background: "var(--z-popover-bg)",
    boxShadow: "var(--z-popover-lift)",
    transition: "border-color 0.15s ease",

    // phones: the message takes a row, the buttons sit under it, so long
    // languages (German) never push text under a button
    _phone: {
      flexWrap: "wrap",
      justifyContent: "flex-end",
      "& > button": { flexShrink: 0 },
    },

    // leaving was held back: warning edge and a short shake
    "&[data-attention]": {
      borderColor: "var(--z-warning, #F3B96B)",
      animation: "zNudge 0.36s ease",
    },
    _motionReduce: { "&[data-attention]": { animation: "none" } },
  },
});

const BarText = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "var(--z-fg-secondary)",
    _phone: { flexBasis: "100%" },

    "&[data-error='true']": {
      color: "var(--z-danger)",
      "--z-icon-color": "var(--z-danger)",
    },
    "&[data-attention]": {
      color: "var(--z-warning, #F3B96B)",
      "--z-icon-color": "var(--z-warning, #F3B96B)",
    },
  },
});
