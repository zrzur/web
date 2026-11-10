import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";
import { css } from "styled-system/css";

import {
  Settings,
  SettingsConfigurations,
} from "@revolt/app/interface/settings";
import { useState } from "@revolt/state";
import { DialogProps } from "@revolt/ui";
import { SlideDrawer } from "@revolt/ui/components/navigation/SlideDrawer";

import { Modals } from "../types";

/**
 * Modal to display server information
 */
export function SettingsModal(
  props: DialogProps & Modals & { type: "settings" },
) {
  const { setDiagDrawer } = useState();
  // eslint-disable-next-line solid/reactivity
  const config = SettingsConfigurations[props.config];

  //Drawer slider for mobile
  let rootRef, sDrawer: SlideDrawer | undefined;
  const [contRef, setContRef] = createSignal<HTMLDivElement>();
  createEffect(
    on(contRef, (cont) => {
      if (!cont || sDrawer) return;
      sDrawer = new SlideDrawer(
        cont,
        rootRef!,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Boolean(props.initialPage || (props.context as any)?.page),
      );
      setDiagDrawer(sDrawer);
    }),
  );
  onCleanup(() => {
    sDrawer?.delete();
    setDiagDrawer((sDrawer = undefined));
  });

  return (
    <Portal mount={document.getElementById("floating")!}>
      <div
        style={{
          "z-index": 100,
          position: "fixed",
          width: "100%",
          height: "100vh",
          left: 0,
          top: 0,
          "pointer-events": "none",
        }}
      >
        <Presence>
          <Show when={props?.show}>
            <Motion.div
              ref={rootRef}
              class={settingsOverlay}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{
                duration: 0.3,
                easing: [0.17, 0.67, 0.58, 0.98],
              }}
            >
              <Settings
                initialPage={props.initialPage}
                onClose={props.onClose}
                modalId={props.modalId}
                render={config.render}
                title={config.title}
                resolve={config.resolve}
                list={config.list}
                context={props.context}
                contentRef={setContRef}
              />
            </Motion.div>
          </Show>
        </Presence>
      </div>
    </Portal>
  );
}

const settingsOverlay =
  "settings_overlay " +
  css({
    display: "flex",
    height: "100%",
    pointerEvents: "all",
    color: "var(--z-fg-primary)",
    // same frame as the main app: sidebar sits on the frame colour, the page
    // is a panel with a rounded top-start corner below a small top gap
    background: "var(--z-bg-frame)",
    paddingTop: "var(--z-settings-frame-gap)",
    // settings cover the whole screen, outside #root: keep clear of the
    // status bar / notch and, in landscape, of the side cut-outs
    // (physical sides on purpose: the cut-outs do not mirror in Arabic)
    paddingLeft: "var(--z-safe-left)",
    paddingRight: "var(--z-safe-right)",
    // same gap as the main app's top bar
    "--z-settings-frame-gap":
      "calc(var(--z-titlebar-height, 32px) + var(--z-safe-top))",

    _phone: {
      "--z-settings-frame-gap": "var(--z-safe-top)",
    },
  });
