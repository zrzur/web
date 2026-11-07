import { createEffect, createMemo } from "solid-js";

import { useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { useState } from "@revolt/state";

import {
  createMaterialColourVariables,
  createMduiColourTriplets,
  createStoatWebVariables,
} from ".";
import { SlideState } from "../components/navigation/SlideDrawer";
import { Masks } from "./Masks";
import { FONTS, MONOSPACE_FONTS, loadArabicFont } from "./fonts";
import { LEGACY_COLOUR_KEYS } from "./legacyColourKeys";
import { themeAccessibilityCss, themeLibraryVariables } from "./themeLibrary";
import { createZrzurSemanticVariables } from "./zrzurTheme";

const LEGACY_VARIABLES = Object.fromEntries(
  LEGACY_COLOUR_KEYS.map((k) => [
    `--colours-${k}`,
    k.includes("background") ? "var(--unset-bg)" : "var(--unset-fg)",
  ]),
);

const ACCESSIBILITY_STYLE = "zrzur-theme-accessibility";

/**
 * Component for loading theme variables into root
 */
export function LoadTheme() {
  const state = useState();
  const { lifecycle } = useClientLifecycle();

  const bannerShown = createMemo(() =>
    [
      State.Connecting,
      State.Disconnected,
      State.Reconnecting,
      State.Offline,
    ].includes(lifecycle.state()),
  );

  const getCssProps = createMemo(() => {
    const activeTheme = state.theme.activeTheme;

    return {
      // create unset variables to indicate where colours need replacing
      ...LEGACY_VARIABLES,
      // mount Stoat for Web variables
      ...createStoatWebVariables(activeTheme),
      // mount --md-sys-color variables (Zrzur Unified Dark by default)
      ...createMaterialColourVariables(activeTheme, "--md-sys-color-"),
      // mount --mdui-color triplet variables
      ...createMduiColourTriplets(activeTheme, "--mdui-color-"),
      // mount semantic --z-* design tokens
      ...createZrzurSemanticVariables(activeTheme),
      // a picked library theme replaces the derived tokens with its own
      ...themeLibraryVariables(activeTheme),
    };
  });

  //Load fonts & update CSS props on body
  createEffect(() => {
    FONTS[state.theme.interfaceFont].load();
    MONOSPACE_FONTS[state.theme.monospaceFont].load();
    // Arabic always gets Zrzur's Arabic face (fetched only when needed)
    loadArabicFont();

    const cssProps = getCssProps();
    for (const [key, value] of Object.entries(cssProps))
      document.body.style.setProperty(key, value);
  });

  // the reading aids of a theme such as High Contrast
  createEffect(() => {
    const css = themeAccessibilityCss(state.theme.activeTheme);
    let style = document.getElementById(ACCESSIBILITY_STYLE);
    if (!css) return style?.remove();
    if (!style) {
      style = document.createElement("style");
      style.id = ACCESSIBILITY_STYLE;
      document.head.appendChild(style);
    }
    style.textContent = css;
  });

  //Set PWA theme color
  createEffect(() => {
    const drawerShown =
      state.appDrawer()?.state === SlideState.SHOWN ||
      state.diagDrawer()?.state === SlideState.SHOWN;

    const color =
      getCssProps()[
        bannerShown()
          ? "--md-sys-color-primary-container"
          : drawerShown
            ? "--md-sys-color-surface-container-low"
            : "--md-sys-color-surface-container-high"
      ];

    for (const meta of document.head.querySelectorAll("meta[name=theme-color]"))
      (meta as HTMLMetaElement).content = color;
  });

  return <Masks />;
}
