import { describe, expect, it } from "vitest";

import {
  BASE_VOICE_BITRATE,
  PLUS_BADGE,
  checkoutAvailable,
  formatMegabytes,
  formatPrice,
  isProviderUrl,
  newOrderKey,
  orderOpen,
  plusActive,
  voiceBitrateFor,
} from "../components/client/billing";

describe("billing helpers", () => {
  it("formats prices from minor units", () => {
    expect(formatPrice(499, "USD", "en")).toBe("$4.99");
    expect(formatPrice(1299, "USD", "de")).toContain("12,99");
  });

  it("falls back when the currency is unknown", () => {
    expect(formatPrice(250, "", "en")).toBe("$2.50");
  });

  it("formats sizes in MB", () => {
    expect(formatMegabytes(100_000_000, "en")).toBe("100 MB");
    expect(formatMegabytes(25_000_000, "en")).toBe("25 MB");
  });

  it("makes order keys the server accepts", () => {
    const key = newOrderKey();
    expect(key).toMatch(/^[A-Za-z0-9]{16,64}$/);
    expect(newOrderKey()).not.toBe(key);
  });

  it("uses the base voice bitrate without plans or a level", () => {
    expect(voiceBitrateFor(undefined)).toBe(BASE_VOICE_BITRATE);
    expect(voiceBitrateFor(0)).toBe(BASE_VOICE_BITRATE);
  });

  it("gives no perks before billing is loaded", () => {
    expect(plusActive()).toBe(false);
  });

  it("matches the server's badge bit", () => {
    expect(PLUS_BADGE).toBe(2048);
  });
});

describe("payment pages", () => {
  it("only opens the payment provider's own https pages", () => {
    expect(isProviderUrl("https://checkout.stripe.com/c/pay/cs_test_1")).toBe(
      true,
    );
    expect(isProviderUrl("https://billing.stripe.com/p/session/x")).toBe(true);
    expect(isProviderUrl("https://invoice.stripe.com/i/x")).toBe(true);
    for (const bad of [
      undefined,
      "",
      "http://checkout.stripe.com/c/pay/x",
      "https://checkout.stripe.com.evil.example/x",
      "https://evil.example/?u=https://checkout.stripe.com",
      "javascript:alert(1)",
      "https://user@evil.example",
      "not a url",
    ]) {
      expect(isProviderUrl(bad)).toBe(false);
    }
  });

  it("knows which orders are still waiting", () => {
    for (const open of [
      "Created",
      "Pending",
      "RequiresAction",
      "Processing",
    ] as const) {
      expect(orderOpen(open)).toBe(true);
    }
    for (const closed of [
      "Paid",
      "Failed",
      "Cancelled",
      "Refunded",
      "PartiallyRefunded",
      "Disputed",
    ] as const) {
      expect(orderOpen(closed)).toBe(false);
    }
  });

  it("keeps checkout closed before billing is loaded", () => {
    expect(checkoutAvailable()).toBe(false);
  });
});
