/**
 * When the "install the app" sheet may show by itself: once, from the second
 * visit, and not again for 30 days after it was closed. The row on the You
 * page is always there, so nothing is lost by closing it.
 */

/** Local storage key: `{ visits, dismissedAt }` */
export const INSTALL_OFFER_KEY = "zrzur:install-offer";
/** Session storage key: this visit has been counted */
export const INSTALL_VISIT_KEY = "zrzur:install-visit";

export const MIN_VISITS = 2;
export const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export interface OfferState {
  visits: number;
  dismissedAt?: number;
}

type Store = Pick<Storage, "getItem" | "setItem">;

export function readOffer(store: Store | undefined): OfferState {
  try {
    const saved = JSON.parse(store?.getItem(INSTALL_OFFER_KEY) ?? "null");
    if (saved && typeof saved.visits === "number")
      return {
        visits: saved.visits,
        dismissedAt:
          typeof saved.dismissedAt === "number" ? saved.dismissedAt : undefined,
      };
  } catch {
    // unreadable or blocked storage: start again
  }
  return { visits: 0 };
}

function write(store: Store | undefined, state: OfferState) {
  try {
    store?.setItem(INSTALL_OFFER_KEY, JSON.stringify(state));
  } catch {
    // private mode: the sheet may show again next time, nothing worse
  }
}

/** Count this visit once per browser session; returns the state after it */
export function recordVisit(
  store: Store | undefined,
  session: Store | undefined,
): OfferState {
  const state = readOffer(store);
  try {
    if (session?.getItem(INSTALL_VISIT_KEY)) return state;
    session?.setItem(INSTALL_VISIT_KEY, "1");
  } catch {
    return state;
  }
  const next = { ...state, visits: state.visits + 1 };
  write(store, next);
  return next;
}

/** The sheet was closed (by any button): leave the person alone for a while */
export function recordDismissed(store: Store | undefined, now: number) {
  write(store, { ...readOffer(store), dismissedAt: now });
}

export function shouldOffer(state: OfferState, now: number): boolean {
  if (state.visits < MIN_VISITS) return false;
  if (state.dismissedAt === undefined) return true;
  return now - state.dismissedAt >= DISMISS_MS;
}
