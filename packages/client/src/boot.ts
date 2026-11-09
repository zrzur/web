/**
 * Whether this address opens a sign-in page (`/login…`, also under an
 * `/i/<host>` instance prefix). There the first download also fetches the
 * sign-in code; everywhere else it loads only when needed.
 */
export function opensSignIn(pathname: string) {
  return /^(\/i\/[^/]+)?\/login(\/|$)/.test(pathname);
}

/** Set while the page reloads itself after its files failed to load */
const RELOADED = "zrzur:boot-reloaded";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Words for a page whose files did not load. They cannot come from the
 * message catalogs (those may be what failed), so the three app languages
 * are here.
 */
const FAILED = {
  ar: {
    text: "تعذّر تحميل زرزور. تحقّق من اتصالك بالإنترنت ثم أعد المحاولة.",
    button: "أعد المحاولة",
    dir: "rtl",
  },
  de: {
    text: "Zrzur konnte nicht geladen werden. Prüfe deine Internetverbindung und versuche es erneut.",
    button: "Erneut versuchen",
    dir: "ltr",
  },
  en: {
    text: "Zrzur could not load. Check your internet connection and try again.",
    button: "Try again",
    dir: "ltr",
  },
} as const;

function failedWords(languages: readonly string[]) {
  for (const language of languages) {
    const code = language.split("-")[0].toLowerCase();
    if (code in FAILED) return { code, ...FAILED[code as keyof typeof FAILED] };
  }
  return { code: "en", ...FAILED.en };
}

/** The first download worked: a later failure may reload once again */
export function bootLoaded(storage: Storage | undefined) {
  try {
    storage?.removeItem(RELOADED);
  } catch {
    // storage blocked: nothing to clear
  }
}

/**
 * The app's or the site's files did not load (a new release replaced them,
 * or the connection dropped). Reload once; if that did not help, say so in
 * plain words with a button that tries again.
 */
export function bootFailed(page: {
  storage: Storage | undefined;
  reload: () => void;
  root: HTMLElement | null;
  languages: readonly string[];
}) {
  let reloadedBefore = true;
  try {
    if (page.storage) {
      reloadedBefore = page.storage.getItem(RELOADED) === "1";
      if (!reloadedBefore) page.storage.setItem(RELOADED, "1");
    }
  } catch {
    // storage blocked: never reload in a loop
  }
  if (!reloadedBefore) return page.reload();

  const root = page.root;
  if (!root) return;
  const words = failedWords(page.languages);
  const doc = root.ownerDocument;

  const box = doc.createElement("div");
  box.lang = words.code;
  box.dir = words.dir;
  box.setAttribute("role", "alert");
  box.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:16px;padding:48px 24px;text-align:center;font:inherit;color:var(--z-fg-primary, CanvasText)";

  const text = doc.createElement("p");
  text.textContent = words.text;
  text.style.cssText = "margin:0;max-width:480px;line-height:1.5";

  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = words.button;
  button.style.cssText =
    "min-height:44px;padding:0 20px;border:0;border-radius:var(--z-radius, 8px);font:inherit;cursor:pointer;background:var(--z-accent-fill, ButtonFace);color:var(--z-on-accent, ButtonText)";
  button.addEventListener("click", () => page.reload());

  box.append(text, button);
  root.replaceChildren(box);
}
