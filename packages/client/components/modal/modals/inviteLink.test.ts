import { describe, expect, it } from "vitest";

import {
  getBotLink,
  getInviteLink,
  isInviteCode,
  parseInviteCode,
} from "./inviteLink";

describe("getInviteLink", () => {
  const inst = {
    href: (path: string) => `https://app.zrzur.com${path}`,
  };

  it("uses VITE_INVITE_ORIGIN short form without /invite/", () => {
    expect(getInviteLink("Ab12Cd", inst, "https://zrzur.cc")).toBe(
      "https://zrzur.cc/Ab12Cd",
    );
  });

  it("falls back to app /invite/{code} when origin unset", () => {
    expect(getInviteLink("Ab12Cd", inst, "")).toBe(
      "https://app.zrzur.com/invite/Ab12Cd",
    );
  });

  it("rejects non-http invite origins", () => {
    expect(getInviteLink("x", inst, "javascript:alert(1)")).toBe(
      "https://app.zrzur.com/invite/x",
    );
  });
});

describe("parseInviteCode", () => {
  it("reads the code from a short zrzur.cc link", () => {
    expect(parseInviteCode("https://zrzur.cc/Ab12Cd")).toBe("Ab12Cd");
  });

  it("reads the code from an app /invite/ link", () => {
    expect(parseInviteCode("https://app.zrzur.com/invite/Ab12Cd")).toBe(
      "Ab12Cd",
    );
  });

  it("accepts a bare code", () => {
    expect(parseInviteCode("  Ab12Cd ")).toBe("Ab12Cd");
  });

  it("reads the code from the configured invite origin", () => {
    expect(
      parseInviteCode(
        "http://localhost:5173/s/Ab12Cd",
        "http://localhost:5173/s",
      ),
    ).toBe("Ab12Cd");
  });

  it("does not treat the retired zarzour.cc host as an invite host", () => {
    expect(parseInviteCode("https://zarzour.cc/Ab12Cd")).toBe("");
  });

  it("rejects input that is not a code, so it never reaches the API path", () => {
    expect(parseInviteCode("../../users/@me")).toBe("");
    expect(parseInviteCode("https://zrzur.cc/Ab12%2F..%2Fusers")).toBe("");
  });
});

describe("parseInviteCode short links as people paste them", () => {
  it.each([
    "https://zrzur.cc/Ab12Cd/",
    "https://zrzur.cc/Ab12Cd?utm_source=chat",
    "https://zrzur.cc/Ab12Cd#join",
    "https://www.zrzur.cc/Ab12Cd",
    "http://zrzur.cc/Ab12Cd",
    "https://app.zrzur.com/invite/Ab12Cd/",
  ])("reads the code from %s", (link) => {
    expect(parseInviteCode(link)).toBe("Ab12Cd");
  });

  it("does not take a deeper path on the short host as a code", () => {
    expect(parseInviteCode("https://zrzur.cc/p/Ab12Cd")).toBe("");
  });
});

describe("isInviteCode", () => {
  it("accepts plain codes and ids", () => {
    expect(isInviteCode("Ab12Cd")).toBe(true);
    expect(isInviteCode("01HZY3J5Q8M2K4N6P7R9S0T1VW")).toBe(true);
  });

  it("rejects anything that could change the API path", () => {
    for (const bad of ["", "../users/@me", "a/b", "a%2Fb", "a?b", "a b"])
      expect(isInviteCode(bad)).toBe(false);
  });
});

describe("custom invite links (zrzur.cc/<name>)", () => {
  it("accepts names with single hyphens, in any case", () => {
    expect(isInviteCode("arab-gamers")).toBe(true);
    expect(isInviteCode("ARAB-gamers")).toBe(true);
    expect(parseInviteCode("https://zrzur.cc/arab-gamers", "")).toBe(
      "arab-gamers",
    );
  });

  it("refuses hyphens at the edges, double hyphens and long names", () => {
    for (const bad of ["-a", "a-", "a--b", "../x", "a".repeat(33)])
      expect(isInviteCode(bad)).toBe(false);
  });
});

describe("getBotLink", () => {
  const inst = { href: (path: string) => `https://app.zrzur.com${path}` };
  const id = "01M7CXZ4VSXCT95SEFEFGS07HD";

  it("uses the short origin: zrzur.cc/b/{id}", () => {
    expect(getBotLink(id, inst, undefined, "https://zrzur.cc")).toBe(
      `https://zrzur.cc/b/${id}`,
    );
  });

  it("keeps the permissions the Developer Portal chose", () => {
    expect(getBotLink(id, inst, 8192, "https://zrzur.cc/")).toBe(
      `https://zrzur.cc/b/${id}?permissions=8192`,
    );
  });

  it("leaves out zero, negative and unsafe permissions", () => {
    for (const bad of [0, -1, Number.MAX_SAFE_INTEGER + 2, Number.NaN]) {
      expect(getBotLink(id, inst, bad, "https://zrzur.cc")).toBe(
        `https://zrzur.cc/b/${id}`,
      );
    }
  });

  it("falls back to the app's /bot/{id} without a short origin", () => {
    expect(getBotLink(id, inst, 8, "")).toBe(
      `https://app.zrzur.com/bot/${id}?permissions=8`,
    );
  });

  it("never builds a link on a non-web origin", () => {
    expect(getBotLink(id, inst, undefined, "javascript:alert(1)")).toBe(
      `https://app.zrzur.com/bot/${id}`,
    );
  });
});
