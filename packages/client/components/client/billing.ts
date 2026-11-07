import type { API as APITypes__, WithoutNull as WithoutNull__ } from "@zrzur/sdk/solid";
import { withoutNull } from "@zrzur/sdk/solid";
import { createSignal } from "solid-js";

import type { Client } from "@zrzur/sdk/solid";

// relative so unit tests (no path aliases) can load this module

/**
 * Zrzur Plus, feathers (server supercharges), gifts and Discover
 * promotion, served by the Zrzur API under `/billing`.
 *
 * Payments happen on the payment provider's hosted checkout page; this app
 * never sees card details. Whether something was paid is always asked from
 * the Zrzur API (which asks the provider), never taken from the return
 * address. When the server reports billing as unavailable, nothing here is
 * shown and no perks apply; when checkout is locked (live payments not open
 * yet) the store shows that instead of a pay button.
 */

/** Badge bit the server sets while Plus is active and not hidden */
export const PLUS_BADGE = 2048;

export type PlanLimits = WithoutNull__<APITypes__.PlanLimits>;

export type SuperchargeLevel = {
  level: number;
  supercharges: number;
  server_emoji: number;
  /** bytes */
  attachments: number;
  /** bits per second */
  voice_bitrate: number;
  video_resolution: [number, number];
  video_framerate: number;
  /** this level unlocks a custom invite link (zrzur.cc/<name>) */
  vanity_invite?: boolean;
};

export type CatalogProduct = WithoutNull__<APITypes__.CatalogProduct>;

export type BillingPlans = WithoutNull__<APITypes__.BillingPlans>;

export type PlusSource = WithoutNull__<APITypes__.PlusSource>;

export type SubscriptionStatus = WithoutNull__<APITypes__.SubscriptionStatus>;

export type PlusSubscription = WithoutNull__<APITypes__.PlusSubscription>;

export type Supercharge = WithoutNull__<APITypes__.Supercharge>;

export type BillingOverview = WithoutNull__<APITypes__.BillingOverview>;

export type ServerSuperchargeInfo = WithoutNull__<APITypes__.ServerSuperchargeInfo>;

/** A server's supercharge state as sent on the server object */
export type ServerSuperchargeState = { count: number; level: number };

/** Discover boost tiers, smallest first */
export type BoostKind = "Boost" | "SuperBoost" | "MegaBoost";

export type DiscoverBoostOffer = WithoutNull__<APITypes__.DiscoverBoostOffer>;

export type DiscoverPromotionStatus = WithoutNull__<APITypes__.DiscoverPromotionStatus>;

/** What an order buys; the server always sets the price */
export type OrderProduct = WithoutNull__<APITypes__.OrderProduct>;

export type OrderStatus = WithoutNull__<APITypes__.OrderStatus>;

export type Order = WithoutNull__<APITypes__.Order>;

export type OrderCheckout = WithoutNull__<APITypes__.OrderCheckout>;

/** Still waiting for the payer or the provider */
export function orderOpen(status: OrderStatus) {
  return (
    status === "Created" ||
    status === "Pending" ||
    status === "RequiresAction" ||
    status === "Processing"
  );
}

/** A fresh idempotency key: one per purchase attempt */
export function newOrderKey() {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Hosts the app may send a buyer to (the provider's own pages) */
const PROVIDER_HOSTS = [
  "checkout.stripe.com",
  "billing.stripe.com",
  "invoice.stripe.com",
  "pay.stripe.com",
  // PayPal's checkout, subscription approval and automatic-payments pages
  "www.paypal.com",
  "www.sandbox.paypal.com",
];

/** Payment providers this app knows how to offer */
export type PaymentMethod = "stripe" | "paypal";
const KNOWN_METHODS: PaymentMethod[] = ["stripe", "paypal"];

/**
 * Ways a buyer can pay right now, preferred first. Empty for simulated
 * payments (nothing to choose) or when purchases are closed.
 */
export function paymentMethods(
  plans: Pick<BillingPlans, "provider" | "providers"> | undefined,
): PaymentMethod[] {
  const names = plans?.providers ?? (plans?.provider ? [plans.provider] : []);
  return names.filter((name): name is PaymentMethod =>
    KNOWN_METHODS.includes(name as PaymentMethod),
  );
}

/**
 * Whether an address from the API is a provider page we may open. Anything
 * else is refused, so a tampered answer can't send buyers elsewhere.
 */
export function isProviderUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" && PROVIDER_HOSTS.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/** Open a provider page outside the app (new tab, or the browser in the
 * desktop app) */
export function openProviderPage(url: string) {
  if (!isProviderUrl(url)) throw JSON.stringify({ type: "BadCheckout" });
  window.open(url, "_blank", "noopener,noreferrer");
}

/** What a purchase led to */
export type PurchaseResult =
  /** paid and delivered (simulated payments) */
  | { kind: "done"; order: Order }
  /** the buyer pays at the provider; follow the order until it settles */
  | { kind: "checkout"; order: Order; url: string };

/**
 * Buy something: create the order (the same key always finds the same
 * order, and an open checkout for the same thing is continued, so retries
 * and reloads never buy twice). With a payment provider the buyer is sent
 * to its checkout page and the order is followed from the API; with the
 * built-in test provider (local development) the app confirms it and
 * nothing is charged.
 */
export async function purchase(
  client: Client,
  product: OrderProduct,
  key: string,
  provider?: PaymentMethod,
): Promise<PurchaseResult> {
  // one order per way of paying: trying PayPal after closing the card
  // page starts a PayPal order instead of finding the card one
  const { order, checkout_url } = await billingApi.createOrder(
    client,
    product,
    provider ? `${key}-${provider}` : key,
    provider,
  );

  if (order.provider !== "test") {
    if (order.status === "Paid") return { kind: "done", order };
    if (!orderOpen(order.status) || !isProviderUrl(checkout_url)) {
      throw JSON.stringify({ type: "OrderCancelled" });
    }
    openProviderPage(checkout_url);
    return { kind: "checkout", order, url: checkout_url };
  }

  const paid =
    order.status === "Pending"
      ? await billingApi.payOrder(client, order._id)
      : order;
  if (paid.status === "Refunded") {
    throw JSON.stringify({ type: "Refunded", failure: paid.failure });
  }
  if (paid.status === "Cancelled") {
    throw JSON.stringify({ type: "OrderCancelled" });
  }
  await refreshBilling(client);
  return { kind: "done", order: paid };
}

/**
 * Follow an order until it settles, asking the API (which asks the
 * provider) every few seconds. Resolves with the last state seen; stops
 * early when `signal` aborts.
 */
export async function followOrder(
  client: Client,
  id: string,
  onUpdate: (checkout: OrderCheckout) => void,
  signal: AbortSignal,
  timeoutMs = 15 * 60_000,
) {
  const started = Date.now();
  let delay = 2000;
  let last: OrderCheckout | undefined;
  while (!signal.aborted && Date.now() - started < timeoutMs) {
    try {
      last = await billingApi.order(client, id, true);
      onUpdate(last);
      if (!orderOpen(last.order.status) && last.order.status !== "Paid") break;
      if (last.order.status === "Paid" && last.order.fulfilled !== false) {
        await refreshBilling(client);
        break;
      }
    } catch {
      // network trouble: keep asking, a bit slower
      delay = Math.min(delay * 2, 15_000);
    }
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, delay);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve(undefined);
      });
    });
    delay = Math.min(delay + 1000, 6000);
  }
  return last;
}

/** Order id the provider sent the buyer back with, if any (and remove it
 * from the address so a reload doesn't show it again) */
export function takeReturnedOrder(): string | undefined {
  try {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("billing_order");
    if (!id) return undefined;
    url.searchParams.delete("billing_order");
    url.searchParams.delete("billing_return");
    window.history.replaceState(window.history.state, "", url.toString());
    // ids are `{user}-{key}`: refuse anything else
    return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

// taken as soon as the app loads, before routing can drop the address
let returnedOrder: string | undefined =
  typeof window !== "undefined" ? takeReturnedOrder() : undefined;

/** The order the buyer came back from the payment page with, once */
export function consumeReturnedOrder() {
  const id = returnedOrder;
  returnedOrder = undefined;
  return id;
}

export const billingApi = {
  createOrder: (
    client: Client,
    product: OrderProduct,
    key: string,
    provider?: PaymentMethod,
  ) =>
    client.api
      .post("/billing/orders", {
        product,
        idempotency_key: key,
        ...(provider ? { provider } : {}),
      })
      .then(withoutNull),
  order: (client: Client, id: string, refresh = false) =>
    client.api
      .get(
        `/billing/orders/${encodeURIComponent(id)}${refresh ? "?refresh=true" : ""}`,
      )
      .then(withoutNull),
  payOrder: (client: Client, id: string) =>
    client.api.post(`/billing/orders/${id}/pay`).then(withoutNull),
  cancelOrder: (client: Client, id: string) =>
    client.api.delete(`/billing/orders/${id}`).then(withoutNull),
  portal: (client: Client) =>
    client.api.post("/billing/portal").then(withoutNull),
  orders: (client: Client) =>
    client.api.get("/billing/orders").then(withoutNull),
  plans: (client: Client) => client.api.get("/billing/plans").then(withoutNull),
  overview: (client: Client) =>
    client.api.get("/billing/@me").then(withoutNull),
  editPlus: (
    client: Client,
    body: { hide_badge?: boolean; cancel_at_period_end?: boolean },
  ) => client.api.patch("/billing/plus", body).then(withoutNull),
  supercharge: (
    client: Client,
    body: { server: string; supercharge?: string },
  ) => client.api.post("/billing/supercharges", body).then(withoutNull),
  editSupercharge: (
    client: Client,
    id: string,
    body: { cancel_at_period_end?: boolean; unplace?: boolean },
  ) => client.api.patch(`/billing/supercharges/${id}`, body).then(withoutNull),
  server: (client: Client, id: string) =>
    client.api.get(`/billing/servers/${id}`).then(withoutNull),
  botPromotion: (client: Client, bot: string) =>
    client.api.get(`/billing/discover/bots/${bot}`).then(withoutNull),
  promotion: (client: Client, server: string) =>
    client.api.get(`/billing/discover/${server}`).then(withoutNull),
};

const [plans, setPlans] = createSignal<BillingPlans>();
const [overview, setOverview] = createSignal<BillingOverview>();

/** Prices and perks, once loaded (undefined until then) */
export const billingPlans = plans;

/** Your Plus and supercharges, once loaded */
export const billingOverview = overview;

/** Whether billing is on for this server (store and perks) */
export const billingAvailable = () => !!plans()?.available;

/**
 * Whether purchases can be started right now. Older servers don't send
 * the field; there it follows `available`.
 */
export const checkoutAvailable = () => {
  const current = plans();
  if (!current?.available) return false;
  return current.checkout_available ?? true;
};

/** Whether you have Plus right now */
export function plusActive() {
  const end = overview()?.plus?.current_period_end;
  return billingAvailable() && !!end && new Date(end).getTime() > Date.now();
}

/** Plus limits while you have Plus */
export function activePlusLimits(): PlanLimits | undefined {
  return plusActive() ? plans()?.plus : undefined;
}

/** Remember a fresh overview returned by a billing call */
export function storeOverview(next: BillingOverview) {
  setOverview(next);
}

let loading: Promise<void> | undefined;

/** Load plans, then your overview if billing is available */
export function refreshBilling(client: Client) {
  loading ??= (async () => {
    try {
      const next = await billingApi.plans(client);
      setPlans(next);
      if (next.available) setOverview(await billingApi.overview(client));
      else setOverview(undefined);
    } catch {
      // older servers have no billing routes: treat as unavailable
      setPlans(undefined);
      setOverview(undefined);
    } finally {
      loading = undefined;
    }
  })();
  return loading;
}

/** Forget billing state (on sign out) */
export function resetBilling() {
  setPlans(undefined);
  setOverview(undefined);
}

/** Voice bitrate of calls without a supercharge level (bits per second) */
export const BASE_VOICE_BITRATE = 64_000;

/** Voice bitrate for a call in a server at this level */
export function voiceBitrateFor(level: number | undefined) {
  return levelPerks(level)?.voice_bitrate ?? BASE_VOICE_BITRATE;
}

/** Level perks of a server, or undefined at level 0 */
export function levelPerks(level: number | undefined) {
  if (!level) return undefined;
  return plans()?.levels.find((entry) => entry.level === level);
}

/** Lowest level that unlocks a custom invite link (undefined: none does) */
export function vanityLevel() {
  return plans()?.levels.find((entry) => entry.vanity_invite);
}

/** Supercharges still needed for the next level (undefined at the top) */
export function nextLevel(count: number) {
  return plans()?.levels.find((entry) => entry.supercharges > count);
}

/** Format minor units as a price, e.g. 499 → $4.99 */
export function formatPrice(minor: number, currency: string, locale?: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
    }).format(minor / 100);
  } catch {
    return (minor / 100).toFixed(2);
  }
}

/** Format a byte size in MB, e.g. 25000000 → 25 MB */
export function formatMegabytes(bytes: number, locale?: string) {
  return `${new Intl.NumberFormat(locale).format(Math.round(bytes / 1_000_000))} MB`;
}
