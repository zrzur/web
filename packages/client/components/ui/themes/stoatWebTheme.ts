import { SelectedTheme } from "@revolt/state/stores/Theme";

/**
 * Generate Stoat for Web variables
 * @param theme Theme
 * @returns CSS Variables
 */
export function createStoatWebVariables(theme: SelectedTheme) {
  return {
    // helper variables
    "--unset-fg": "red",
    "--unset-bg": "linear-gradient(to right, red, blue)",

    // message size
    "--message-size": `${theme.messageSize}px`,
    "--message-group-spacing": `${theme.messageGroupSpacing}px`,

    // emoji size
    "--emoji-size": "1.4em",
    "--emoji-size-medium": "36px",
    "--emoji-size-large": "40px",

    // effects
    "--effects-blur-md": theme.blur ? "blur(20px)" : "unset",
    "--effects-invert-black": theme.darkMode ? "invert(100%)" : "invert(0%)",
    "--effects-invert-light": theme.darkMode ? "invert(0%)" : "invert(1000%)",

    // transitions
    "--transitions-fast": "120ms cubic-bezier(0.2, 0, 0, 1)",
    "--transitions-medium": "220ms cubic-bezier(0.2, 0, 0, 1)",

    // brand — Zrzur status palette (brand.md section 4)
    "--brand-presence-online": "var(--z-presence-online, #55DCC8)",
    "--brand-presence-idle": "var(--z-presence-idle, #F3B96B)",
    "--brand-presence-busy": "var(--z-presence-dnd, #F27488)",
    "--brand-presence-focus": "var(--z-presence-focus, #5B9BFF)",
    "--brand-presence-invisible": "var(--z-presence-offline, #7E8299)",

    // font
    // Arabic glyphs come from Zrzur's Arabic face (loaded in LoadTheme); it
    // only covers Arabic, so Latin text keeps the chosen interface font
    "--fonts-primary": `"${theme.interfaceFont}", "IBM Plex Sans Arabic", "IBM Plex Sans Variable", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif`,
    "--fonts-monospace": `"${theme.monospaceFont}", "Jetbrains Mono", sans-serif`,

    // load constants
    ...reduceWithPrefix(themeConstants.borderRadius, "--borderRadius-"),
    ...reduceWithPrefix(themeConstants.gap, "--gap-"),
    ...reduceWithPrefix(themeConstants.layout, "--layout-"),
  };
}

/**
 * Add prefix to all keys in an object
 * @param object Object
 * @param prefix Prefix
 * @returns New object
 */
function reduceWithPrefix(object: Record<string, string>, prefix: string) {
  return Object.entries(object).reduce(
    (d, [k, v]) => ({ ...d, [`${prefix}${k}`]: v }),
    {},
  );
}

const themeConstants = {
  borderRadius: {
    // Zrzur geometry (aligned to --z-radius family; keep keys for compatibility)
    none: "0px",
    xs: "4px",
    sm: "8px",
    md: "10px",
    lg: "12px",
    li: "16px",
    xl: "20px",
    xli: "24px",
    xxl: "32px",
    full: "calc(infinity * 1px)",
    circle: "100%",
  },
  /**
   * @deprecated decide this at a component level
   */
  gap: {
    none: "0",
    xxs: "1px",
    xs: "2px",
    s: "6px",
    sm: "4px",
    md: "8px",
    l: "12px",
    lg: "15px",
    x: "28px",
    xl: "32px",
    xxl: "64px",
  },
  layout: {
    "width-channel-sidebar": "260px",
    "width-member-sidebar": "240px",
    "width-user-context-menu-truncate": "300px",
    "height-header": "56px",
    "height-message-box": "32vh",
    "height-composer-min": "56px",
  },
};
