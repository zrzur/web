import { type JSX, For, Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { askToInstall, installWay } from "@revolt/pwa/installPrompt";
import { recordDismissed } from "@revolt/pwa/offerRules";
import { Dialog, DialogProps } from "@revolt/ui";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Put Zrzur on the home screen. A sheet on phones.
 *
 * Android:                          iPhone / iPad:
 * [icon] Install Zrzur              [icon] Add Zrzur to your home screen
 *  - no browser bar                  1 Tap Share            [share]
 *  - notifications                   2 Add to Home Screen   [+]
 *  - opens faster                    3 Tap Add              [check]
 * [Install]                         [Got it]
 * [Not now]
 *
 * Android opens the browser's own install window; on iOS a page cannot
 * install itself, so the steps are all we can show.
 */
export function InstallAppModal(
  props: DialogProps & Modals & { type: "install_app" },
) {
  // the way at the moment the sheet opened: installing clears it, and the
  // sheet must not change under the person's finger
  const way = installWay() ?? "ios";
  const [busy, setBusy] = createSignal(false);

  // closed by any button, the handle, Escape or the backdrop: do not offer
  // it again by itself for a while (the row on the You page stays)
  const close = () => {
    recordDismissed(localStore(), Date.now());
    props.onClose();
  };

  const reasons: { icon: IconName; text: () => JSX.Element }[] = [
    {
      icon: "device-mobile",
      text: () => <Trans>No browser bar, like any app</Trans>,
    },
    {
      icon: "bell",
      text: () => <Trans>Notifications for messages and mentions</Trans>,
    },
    { icon: "lightning", text: () => <Trans>Opens faster every time</Trans> },
  ];

  const steps: { icon: IconName; text: () => JSX.Element }[] = [
    {
      icon: "upload-simple",
      text: () => <Trans>Tap the Share button in the browser's bar</Trans>,
    },
    {
      icon: "plus-square",
      text: () => <Trans>Choose “Add to Home Screen”</Trans>,
    },
    {
      icon: "check",
      text: () => <Trans>Tap “Add”, then open Zrzur from its icon</Trans>,
    },
  ];

  return (
    <Dialog
      size="sm"
      show={props.show}
      onClose={close}
      title={
        <Show
          when={way === "prompt"}
          fallback={<Trans>Add Zrzur to your home screen</Trans>}
        >
          <Trans>Install Zrzur on your phone</Trans>
        </Show>
      }
      description={
        <Show
          when={way === "prompt"}
          fallback={<Trans>Three steps in your browser.</Trans>}
        >
          <Trans>Opens from your home screen, in full screen.</Trans>
        </Show>
      }
      actions={
        way === "prompt"
          ? [
              { text: <Trans>Not now</Trans>, variant: "text" },
              {
                text: <Trans>Install</Trans>,
                isLoading: busy(),
                onClick: async () => {
                  setBusy(true);
                  try {
                    await askToInstall();
                  } finally {
                    setBusy(false);
                  }
                },
              },
            ]
          : [{ text: <Trans>Got it</Trans>, variant: "secondary" }]
      }
    >
      <Show
        when={way === "prompt"}
        fallback={
          <Steps data-install-steps>
            <For each={steps}>
              {(step, index) => (
                <Step>
                  <StepNumber aria-hidden="true">{index() + 1}</StepNumber>
                  <span>{step.text()}</span>
                  <Glyph aria-hidden="true">
                    <Icon name={step.icon} size={20} />
                  </Glyph>
                </Step>
              )}
            </For>
          </Steps>
        }
      >
        <Reasons data-install-reasons>
          <For each={reasons}>
            {(reason) => (
              <li>
                <Icon name={reason.icon} size={22} />
                <span>{reason.text()}</span>
              </li>
            )}
          </For>
        </Reasons>
      </Show>
    </Dialog>
  );
}

const Reasons = styled("ul", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-primary)",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      "--z-icon-color": "var(--z-accent-text, var(--z-accent))",
    },
  },
});

const Steps = styled("ol", {
  base: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    fontSize: "15px",
    lineHeight: "24px",
    color: "var(--z-fg-primary)",
  },
});

const Step = styled("li", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    paddingBlock: "12px",
    borderBottom: "1px solid var(--z-border-subtle)",
    "&:last-child": { borderBottom: "none" },
    "& > span:nth-child(2)": { flex: 1, minWidth: 0 },
  },
});

const StepNumber = styled("span", {
  base: {
    flexShrink: 0,
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: "14px",
    fontWeight: 600,
    background: "var(--z-float-button, var(--z-bg-raised))",
  },
});

const Glyph = styled("span", {
  base: {
    flexShrink: 0,
    width: "40px",
    height: "40px",
    borderRadius: "var(--z-radius-md, 10px)",
    display: "grid",
    placeItems: "center",
    background: "var(--z-float-button, var(--z-bg-raised))",
    "--z-icon-color": "var(--z-fg-primary)",
  },
});
