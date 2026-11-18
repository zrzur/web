import { For, Show } from "solid-js";

import { styled } from "styled-system/jsx";

const HINT = "zrzur.signedIn";

/**
 * Remember, where it can be read at once, whether someone is signed in on
 * this device. The saved session lives in a database that answers later; the
 * first thing on screen needs to know sooner.
 */
export function rememberSignedIn(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(HINT, "1");
    else localStorage.removeItem(HINT);
  } catch {
    // private mode: the loading screen shows instead of the frame
  }
}

/**
 * Should the very first screen be the app's frame? On a phone, for someone
 * who was signed in last time, at an address inside the app.
 */
export function phoneFrameFor(pathname: string): "lists" | "page" | undefined {
  let signedIn = false;
  try {
    signedIn = localStorage.getItem(HINT) === "1";
  } catch {
    return;
  }
  if (!signedIn || !window.matchMedia("(max-width: 600px)").matches) return;
  if (pathname === "/" || pathname === "/app") return "lists";
  if (/^\/(server|channel|friends|you)(\/|$)/.test(pathname)) return "page";
}

/**
 * Phones: the frame of the app, nothing in it yet
 * @param props.lists The lists side (rail, list, bar), or a page
 */
export function PhoneFrame(props: { lists: boolean }) {
  return (
    <Ghost data-first-screen={props.lists ? "lists" : "page"} aria-busy="true">
      <Show
        when={props.lists}
        fallback={
          <>
            <GhostTop>
              <i data-round />
              <i data-line style={{ width: "40%" }} />
            </GhostTop>
            <GhostSpace />
            <GhostBox />
          </>
        }
      >
        <GhostLists>
          <GhostRail>
            <For each={[0, 1, 2, 3, 4, 5]}>{() => <i data-tile />}</For>
          </GhostRail>
          <GhostList>
            <i data-line style={{ width: "38%", height: "18px" }} />
            <i data-field />
            <For each={[62, 48, 70, 40, 56, 66]}>
              {(width) => (
                <GhostRow>
                  <i data-round />
                  <i data-line style={{ width: `${width}%` }} />
                </GhostRow>
              )}
            </For>
          </GhostList>
        </GhostLists>
        <GhostBar>
          <i data-me />
          <i data-capsule />
        </GhostBar>
      </Show>
    </Ghost>
  );
}

/** one quiet fill for every placeholder; it does not move or shimmer */
// (with its own fallbacks: this is drawn before the theme has set a single
// variable, and a colour made of a missing variable paints nothing)
const QUIET =
  "color-mix(in srgb, var(--z-fg-primary, #F0F1F8) 6%, transparent)";
const HAIRLINE = "1px solid var(--z-border-subtle, rgb(255 255 255 / 0.06))";

const Ghost = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    zIndex: -1,
    display: "flex",
    flexDirection: "column",
    paddingTop: "var(--z-safe-top, 0px)",
    paddingBottom: "var(--z-safe-bottom, 0px)",
    background: "var(--z-bg-frame, #0D0E16)",
    "& i": { display: "block", flex: "none", background: QUIET },
    "& i[data-line]": { height: "14px", borderRadius: "7px" },
    "& i[data-round]": { width: "44px", height: "44px", borderRadius: "50%" },
  },
});

const GhostLists = styled("div", {
  base: { flex: 1, minHeight: 0, display: "flex" },
});

/** where the server rail is: 72 px, tiles of 46 */
const GhostRail = styled("div", {
  base: {
    flex: "none",
    width: "var(--z-rail-width, 72px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingTop: "14px",
    "& i[data-tile]": { width: "46px", height: "46px", borderRadius: "14px" },
  },
});

/** where the list is: its top edge 8 px down, its title, its field, its rows */
const GhostList = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    marginTop: "8px",
    padding: "22px 16px 0",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    borderTop: HAIRLINE,
    borderInlineStart: HAIRLINE,
    borderStartStartRadius: "var(--z-radius-md, 10px)",
    "& i[data-field]": { height: "36px", borderRadius: "12px" },
  },
});

const GhostRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "52px",
  },
});

/** where the floating bar is: the round button on the rail's side, the capsule */
const GhostBar = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    height: "56px",
    marginBottom: "8px",
    paddingInlineStart: "8px",
    paddingInlineEnd: "12px",
    "& i[data-me]": { width: "56px", height: "56px", borderRadius: "50%" },
    "& i[data-capsule]": { flex: 1, height: "56px", borderRadius: "28px" },
  },
});

/** a page: its top line, room for what it holds, the message box */
const GhostTop = styled("div", {
  base: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    height: "56px",
    paddingInline: "16px",
    borderBottom: HAIRLINE,
    "& i[data-round]": { width: "28px", height: "28px" },
  },
});

const GhostSpace = styled("div", { base: { flex: 1 } });

const GhostBox = styled("i", {
  base: {
    height: "48px",
    margin: "0 12px 12px",
    borderRadius: "14px",
  },
});
