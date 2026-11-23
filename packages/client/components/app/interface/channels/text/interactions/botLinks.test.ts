import { describe, expect, it } from "vitest";

import {
  botStartState,
  markStarted,
  startOf,
  startPlace,
  validStartPayload,
  waitForStart,
  waitingPayload,
} from "./botLinks";

describe("bot links", () => {
  it("accept the payloads the server accepts", () => {
    expect(validStartPayload("spring-sale_2")).toBe(true);
    expect(validStartPayload("x".repeat(64))).toBe(true);
    expect(validStartPayload("x".repeat(65))).toBe(false);
    expect(validStartPayload("has space")).toBe(false);
    expect(validStartPayload("عربي")).toBe(false);
    expect(validStartPayload("")).toBe(false);
    expect(validStartPayload(null)).toBe(false);
  });

  it("open the conversation with ?start, and keep only a valid payload", () => {
    expect(startOf("?start=ref-1")).toEqual({ payload: "ref-1" });
    expect(startOf("?start")).toEqual({});
    expect(startOf("?start=")).toEqual({});
    expect(startOf("?start=bad%20one")).toEqual({});
    expect(startOf("?permissions=8")).toBeUndefined();
    expect(startOf("")).toBeUndefined();
  });

  it("wait for Start until it is pressed, then are used up", () => {
    waitForStart("C1", "ref-1");
    waitForStart("C2");
    expect(waitingPayload("C1")).toBe("ref-1");
    expect(waitingPayload("C2")).toBeUndefined();
    expect(botStartState.waiting.C2).toBe("");

    markStarted("C1");
    expect(waitingPayload("C1")).toBeUndefined();
    expect(botStartState.waiting.C1).toBeUndefined();
    expect(botStartState.started.C1).toBe(true);

    // a new link for the same conversation waits again
    waitForStart("C1", "ref-2");
    expect(botStartState.started.C1).toBeUndefined();
    expect(waitingPayload("C1")).toBe("ref-2");
  });
});

describe("where Start shows", () => {
  const bot = { id: "B1", bot: { owner: "O" }, relationship: "None" };
  const client = (on: boolean, messages: { channelId: string }[]) =>
    ({
      configured: () => true,
      configuration: { features: { bot_dms: on } },
      messages: {
        find: (test: (m: { channelId: string }) => boolean) =>
          messages.find(test),
      },
    }) as never;
  const channel = (id: string) =>
    ({ id, type: "DirectMessage", recipient: bot }) as never;

  it("never in more than one place", () => {
    // empty: the card; with messages and a link waiting: the bar only
    expect(startPlace(client(true, []), channel("E1"))).toBe("card");
    waitForStart("H1", "ref");
    expect(startPlace(client(true, [{ channelId: "H1" }]), channel("H1"))).toBe(
      "bar",
    );
    // with messages and no link: nowhere
    expect(
      startPlace(client(true, [{ channelId: "H2" }]), channel("H2")),
    ).toBeUndefined();
    // pressed in this session: nowhere
    markStarted("E2");
    expect(startPlace(client(true, []), channel("E2"))).toBeUndefined();
  });

  it("nowhere with bots in DMs off, or for a stopped bot", () => {
    expect(startPlace(client(false, []), channel("E3"))).toBeUndefined();
    const stopped = {
      id: "S1",
      type: "DirectMessage",
      recipient: { ...bot, relationship: "Blocked" },
    } as never;
    expect(startPlace(client(true, []), stopped)).toBeUndefined();
  });
});
