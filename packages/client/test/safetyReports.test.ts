import { Api } from "@zrzur/sdk";
import type { Client } from "@zrzur/sdk/solid";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ReportTargetSpec,
  actionsFor,
  nextStatuses,
  safetyApi,
  safetyErrorType,
} from "../components/app/interface/safety/safetyApi";

// the real HTTP client of the SDK, over the stubbed global fetch
const client = {
  api: new Api({ baseURL: "http://127.0.0.1:1", authentication: { session: "test" } }),
} as unknown as Client;

function capture(response: unknown = { _id: "r", reference: "ZR-1" }) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(response), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

// what each entry point in the client passes to the report dialog
const entryPoints: [string, ReportTargetSpec][] = [
  ["message menu", { kind: "Message", id: "M1" }],
  ["user menu", { kind: "User", id: "U1", messageId: "M1" }],
  [
    "bot via user menu",
    { kind: "Bot", id: "B1", messageId: "M1", serverId: "S1" },
  ],
  ["server menu", { kind: "Server", id: "S1" }],
  ["channel menu", { kind: "Channel", id: "C1" }],
  ["attachment", { kind: "Attachment", id: "F1", messageId: "M1" }],
  ["webhook", { kind: "Webhook", id: "W1", messageId: "M1" }],
  ["community design card", { kind: "CommunityItem", id: "I1" }],
  ["Discover server", { kind: "DiscoverServer", id: "S1" }],
  ["Discover bot", { kind: "DiscoverBot", id: "B1" }],
];

describe("report requests", () => {
  it.each(entryPoints)("%s sends its own kind and id", async (_, target) => {
    const calls = capture();
    await safetyApi.report(
      client,
      { ...target, label: "shown only" },
      {
        category: "Spam",
      },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://127.0.0.1:1/safety/reports");
    expect(calls[0].init.method).toBe("POST");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.target).toEqual({
      kind: target.kind,
      id: target.id,
      message_id: target.messageId,
      server_id: target.serverId,
    });
    // display data never leaves the client
    expect(JSON.stringify(body)).not.toContain("shown only");
    expect(body.category).toBe("Spam");
  });

  it("does not retry a report on rate limits", async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{"type":"TooManyReports","max":30}', {
          status: 429,
          headers: { "X-Ratelimit-Reset-After": "10" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const failure = await safetyApi
      .report(client, { kind: "User", id: "U1" }, { category: "Spam" })
      .catch((error) => error);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(safetyErrorType(failure)).toBe("TooManyReports");
  });

  it("encodes ids in paths", async () => {
    const calls = capture();
    await safetyApi.appeal(client, "a/b", "This was a misunderstanding.");
    expect(calls[0].url).toBe(
      "http://127.0.0.1:1/safety/standing/a%2Fb/appeal",
    );
  });
});

describe("review helpers", () => {
  it("offers only actions that fit the target", () => {
    expect(actionsFor("Message")).toContain("RemoveMessage");
    expect(actionsFor("User")).not.toContain("RemoveMessage");
    expect(actionsFor("Bot")).toContain("DisableBot");
    expect(actionsFor("Bot")).not.toContain("SuspendAccount");
    expect(actionsFor("CommunityItem")).toEqual([
      "Warning",
      "SuspendCommunityItem",
    ]);
  });

  it("never offers decisions with consequences as a status", () => {
    for (const status of [
      "Submitted",
      "Queued",
      "UnderReview",
      "MoreInfoRequired",
      "Escalated",
      "ActionTaken",
      "NoViolation",
      "Duplicate",
      "Closed",
      "Appealed",
      "AppealResolved",
    ] as const) {
      expect(nextStatuses(status)).not.toContain("ActionTaken");
      expect(nextStatuses(status)).not.toContain("AppealResolved");
    }
  });
});
