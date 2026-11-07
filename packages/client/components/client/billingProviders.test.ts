import { describe, expect, it } from "vitest";

import { isProviderUrl, paymentMethods } from "./billing";

describe("paymentMethods", () => {
  it("lists real providers the buyer can choose, preferred first", () => {
    expect(paymentMethods({ providers: ["stripe", "paypal"] })).toEqual([
      "stripe",
      "paypal",
    ]);
  });

  it("offers no choice for simulated payments or nothing", () => {
    expect(paymentMethods({ providers: ["test"] })).toEqual([]);
    expect(paymentMethods({ providers: [] })).toEqual([]);
    expect(paymentMethods(undefined)).toEqual([]);
  });

  it("falls back to the single provider of older servers", () => {
    expect(paymentMethods({ provider: "stripe" })).toEqual(["stripe"]);
    expect(paymentMethods({ provider: "test" })).toEqual([]);
  });

  it("ignores providers this app doesn't know", () => {
    expect(paymentMethods({ providers: ["stripe", "mystery"] })).toEqual([
      "stripe",
    ]);
  });
});

describe("isProviderUrl", () => {
  it("accepts Stripe and PayPal payment pages over https", () => {
    expect(isProviderUrl("https://checkout.stripe.com/c/pay/cs_1")).toBe(true);
    expect(
      isProviderUrl("https://www.paypal.com/checkoutnow?token=ORDER1"),
    ).toBe(true);
    expect(
      isProviderUrl(
        "https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=I-1",
      ),
    ).toBe(true);
  });

  it("refuses look-alikes and plain http", () => {
    for (const url of [
      "http://www.paypal.com/checkoutnow",
      "https://www.paypal.com.evil.example/x",
      "https://paypal.com@evil.example/x",
      "https://evilpaypal.com/x",
      "javascript:alert(1)",
    ])
      expect(isProviderUrl(url), url).toBe(false);
  });
});
