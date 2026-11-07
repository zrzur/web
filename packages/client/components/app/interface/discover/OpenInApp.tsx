import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { brandMarkSrc } from "@revolt/common/lib/brandMark";
import { useState } from "@revolt/state";

import { SITE_LANGUAGES, WEBSITE_URL, appLinks } from "./sites";

const CHOICE_KEY = "zrzur:open-with";

type Choice = "browser" | "desktop";

function savedChoice(): Choice | undefined {
  try {
    const value = window.localStorage.getItem(CHOICE_KEY);
    return value === "browser" || value === "desktop" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Forget the remembered choice, so the next click asks again */
function forgetChoice() {
  try {
    window.localStorage.removeItem(CHOICE_KEY);
  } catch {
    // nothing was saved
  }
}

function saveChoice(choice: Choice) {
  try {
    window.localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // private mode: ask again next time
  }
}

/** Phones and tablets have no desktop app: straight to the browser */
const isTouchDevice = () =>
  window.matchMedia?.("(pointer: coarse)").matches ?? false;

/**
 * From a public site into the app at `path` (the server or design the
 * person chose). The app keeps the path through sign-in, sign-up and the
 * age step, so they land on the same place. On a computer they choose the
 * desktop app or the browser once; phones go to the browser.
 *
 * Returns a function that starts the move, and the dialog to render.
 */
export function useOpenInApp() {
  const { i18n } = useLingui();
  const [target, setTarget] = createSignal<{
    path: string;
    name: string;
    notOpened?: boolean;
  }>();

  const open = (page: string, name: string) => {
    // the app opens in the language the person reads this site in
    const language = SITE_LANGUAGES.find((l) => l.id === i18n().locale)?.id;
    const path = language
      ? `${page}${page.includes("?") ? "&" : "?"}hl=${language}`
      : page;
    const links = appLinks(path);
    const choice = isTouchDevice() ? "browser" : savedChoice();
    if (choice === "browser") return window.location.assign(links.web);
    if (choice === "desktop") {
      // a remembered desktop choice fails silently when the app is not
      // installed: if this page is still in front a moment later, offer
      // the browser and a way to forget the choice
      let left = false;
      const mark = () => (left = true);
      window.addEventListener("blur", mark, { once: true });
      window.addEventListener("pagehide", mark, { once: true });
      window.setTimeout(() => {
        window.removeEventListener("blur", mark);
        window.removeEventListener("pagehide", mark);
        if (!left && document.visibilityState === "visible")
          setTarget({ path, name, notOpened: true });
      }, 2000);
      return window.location.assign(links.desktop);
    }
    setTarget({ path, name });
  };

  const dialog = () => (
    <Show when={target()}>
      {(current) => (
        <OpenDialog
          path={current().path}
          name={current().name}
          notOpened={current().notOpened}
          onClose={() => setTarget(undefined)}
        />
      )}
    </Show>
  );

  return { open, dialog };
}

function OpenDialog(props: {
  path: string;
  name: string;
  notOpened?: boolean;
  onClose: () => void;
}) {
  const state = useState();
  const { t } = useLingui();
  const [remember, setRemember] = createSignal(false);
  // the desktop link was followed (or tried): show the way back
  const [triedDesktop, setTriedDesktop] = createSignal(!!props.notOpened);
  const [remembered, setRemembered] = createSignal(savedChoice() !== undefined);
  const links = () => appLinks(props.path);
  let first: HTMLAnchorElement | undefined;

  const go = (choice: Choice) => {
    if (remember()) saveChoice(choice);
    if (choice === "desktop") setTriedDesktop(true);
  };

  const forget = () => {
    forgetChoice();
    setRemembered(false);
    setRemember(false);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") props.onClose();
  };
  onMount(() => {
    document.addEventListener("keydown", onKey);
    first?.focus();
  });
  onCleanup(() => document.removeEventListener("keydown", onKey));

  return (
    <Portal>
      <Scrim onClick={props.onClose}>
        <Dialog
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-in-app-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header>
            <img
              src={brandMarkSrc(state.theme.activeTheme.darkMode)}
              alt=""
              width={40}
              height={40}
            />
            <h2 id="open-in-app-title" dir="auto">
              <Trans>Open {props.name} in Zrzur</Trans>
            </h2>
          </header>
          <Show when={triedDesktop()}>
            <Notice role="status">
              <Trans>Didn't open? Continue in the browser.</Trans>
            </Notice>
          </Show>
          <p>
            <Trans>
              Continue in your browser, nothing to install. If the desktop app
              is installed, it can open there instead. After you sign in you
              come back here.
            </Trans>
          </p>
          <Primary ref={first} href={links().web} onClick={() => go("browser")}>
            <Trans>Continue in the browser</Trans>
          </Primary>
          <Secondary href={links().desktop} onClick={() => go("desktop")}>
            <Trans>Open the desktop app</Trans>
          </Secondary>
          <Show when={remembered()}>
            <button type="button" class="forget" onClick={forget}>
              <Trans>Forget my choice on this device</Trans>
            </button>
          </Show>
          <label>
            <input
              type="checkbox"
              checked={remember()}
              onChange={(event) => setRemember(event.currentTarget.checked)}
            />
            <Trans>Remember my choice on this device</Trans>
          </label>
          <footer>
            <a href={`${WEBSITE_URL}/download`}>
              <Trans>Download the desktop app</Trans>
            </a>
            <button type="button" onClick={() => props.onClose()}>
              {t`Cancel`}
            </button>
          </footer>
        </Dialog>
      </Scrim>
    </Portal>
  );
}

const Notice = styled("p", {
  base: {
    padding: "8px 12px",
    borderRadius: "10px",
    background: "var(--z-bg-sunken, var(--z-nav-hover))",
    color: "var(--z-fg-primary) !important",
    fontWeight: 600,
  },
});

const Scrim = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "grid",
    placeItems: "center",
    padding: "16px",
    background: "rgb(6 7 12 / 0.72)",
  },
});

const Dialog = styled("div", {
  base: {
    width: "min(400px, 100%)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    borderRadius: "14px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    boxShadow: "0 12px 32px rgb(0 0 0 / 0.45)",
    "& header": { display: "flex", alignItems: "center", gap: "12px" },
    "& h2": {
      margin: 0,
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
    },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
    },
    "& label": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      minHeight: "32px",
      fontSize: "13px",
      color: "var(--z-fg-secondary)",
      "& input": {
        width: "18px",
        height: "18px",
        accentColor: "var(--z-accent-fill)",
      },
    },
    "& .forget": {
      minHeight: "44px",
      border: 0,
      borderRadius: "10px",
      background: "transparent",
      color: "var(--dz-mark)",
      font: "inherit",
      fontSize: "13px",
      cursor: "pointer",
      "&:hover": { background: "var(--z-nav-hover)" },
      "&:focus-visible": { outline: "2px solid var(--z-focus)" },
    },
    "& footer": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      "& a": { fontSize: "13px", color: "var(--dz-mark)" },
      "& button": {
        height: "36px",
        paddingInline: "12px",
        border: 0,
        borderRadius: "10px",
        background: "transparent",
        color: "var(--z-fg-secondary)",
        font: "inherit",
        fontSize: "14px",
        cursor: "pointer",
        "&:hover": { background: "var(--z-nav-hover)" },
        "&:focus-visible": { outline: "2px solid var(--z-focus)" },
      },
    },
  },
});

const button = {
  height: "44px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
  "&:focus-visible": {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "2px",
  },
} as const;

const Primary = styled("a", {
  base: {
    ...button,
    background: "var(--z-accent-fill)",
    color: "var(--z-on-accent)",
    "&:hover": { background: "var(--z-accent-hover)" },
    "&:active": { background: "var(--z-accent-pressed)" },
  },
});

const Secondary = styled("a", {
  base: {
    ...button,
    border: "1px solid var(--z-border-strong, #4A4E6A)",
    color: "var(--z-fg-primary)",
    "&:hover": { background: "var(--z-nav-hover)" },
  },
});
