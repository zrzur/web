import { describe, expect, it } from "vitest";

import { getBotLink, getInviteLink } from "./inviteLink";
import { parseOwnLink } from "./ownLink";

const BOT = "01M70R4TN68KPSV0TYV7GV6K6E";
const opts = {
  inviteOrigin: "https://zrzur.cc",
  appOrigins: ["https://app.zrzur.com"],
};
const parse = (href: string, o = opts) => parseOwnLink(href, o);

describe("parseOwnLink: short invite origin", () => {
  it("reads zrzur.cc/{code} as an invite", () => {
    expect(parse("https://zrzur.cc/Dm8w7T5p")).toEqual({
      kind: "invite",
      code: "Dm8w7T5p",
      path: "/invite/Dm8w7T5p",
    });
  });

  it("reads custom server links joined by single hyphens", () => {
    expect(parse("https://zrzur.cc/arab-gamers")).toMatchObject({
      kind: "invite",
      code: "arab-gamers",
    });
    expect(parse("https://zrzur.cc/arab--gamers")).toBeNull();
    expect(parse("https://zrzur.cc/-arab")).toBeNull();
  });

  it("reads zrzur.cc/b/{id} as a bot, with or without permissions", () => {
    expect(parse(`https://zrzur.cc/b/${BOT}`)).toEqual({
      kind: "bot",
      id: BOT,
      path: `/bot/${BOT}`,
    });
    expect(parse(`https://zrzur.cc/b/${BOT}?permissions=8`)).toEqual({
      kind: "bot",
      id: BOT,
      permissions: 8,
      path: `/bot/${BOT}?permissions=8`,
    });
    // the server accepts a trailing slash on the bot form
    expect(parse(`https://zrzur.cc/b/${BOT}/`)).toMatchObject({ id: BOT });
  });

  it("ignores permissions that are not a positive whole number", () => {
    for (const bad of ["0", "-1", "abc", "1.5", "1e400", ""]) {
      const link = parse(`https://zrzur.cc/b/${BOT}?permissions=${bad}`);
      expect(link).toEqual({ kind: "bot", id: BOT, path: `/bot/${BOT}` });
    }
  });

  it("ignores a query and fragment on an invite, and case in the host", () => {
    expect(parse("https://ZRZUR.CC/Dm8w7T5p?ref=x#top")).toMatchObject({
      code: "Dm8w7T5p",
    });
    expect(parse("https://www.zrzur.cc/Dm8w7T5p")).toMatchObject({
      code: "Dm8w7T5p",
    });
  });

  it("accepts http as well as https on our own hosts", () => {
    expect(parse("http://zrzur.cc/Dm8w7T5p")).toMatchObject({
      code: "Dm8w7T5p",
    });
    expect(parse("http://app.zrzur.com/invite/Dm8w7T5p")).toMatchObject({
      code: "Dm8w7T5p",
    });
  });

  it("knows zrzur.cc even when another invite origin is configured", () => {
    const own = {
      inviteOrigin: "https://chat.example.org/join",
      appOrigins: [],
    };
    expect(parse("https://zrzur.cc/Dm8w7T5p", own)).toMatchObject({
      code: "Dm8w7T5p",
    });
    // a configured origin with a path: {origin}/{code} and {origin}/b/{id}
    expect(parse("https://chat.example.org/join/Ab12", own)).toMatchObject({
      code: "Ab12",
    });
    expect(parse(`https://chat.example.org/join/b/${BOT}`, own)).toMatchObject({
      id: BOT,
    });
    expect(parse("https://chat.example.org/Ab12", own)).toBeNull();
  });

  it("only takes the forms the short domain serves", () => {
    // zrzur.cc answers /invite/{code} and /{code}/ with 404
    expect(parse("https://zrzur.cc/invite/Dm8w7T5p")).toBeNull();
    expect(parse("https://zrzur.cc/Dm8w7T5p/")).toBeNull();
    expect(parse("https://zrzur.cc/Dm8w7T5p/extra")).toBeNull();
    expect(parse(`https://zrzur.cc/b/${BOT}/extra`)).toBeNull();
    expect(parse("https://zrzur.cc/")).toBeNull();
    expect(parse("https://zrzur.cc/p/Ab12Cd")).toBeNull();
  });
});

describe("parseOwnLink: app forms", () => {
  it("reads /invite/{code} and /bot/{id} on the app", () => {
    expect(parse("https://app.zrzur.com/invite/Dm8w7T5p")).toEqual({
      kind: "invite",
      code: "Dm8w7T5p",
      path: "/invite/Dm8w7T5p",
    });
    expect(parse(`https://app.zrzur.com/bot/${BOT}?permissions=3`)).toEqual({
      kind: "bot",
      id: BOT,
      permissions: 3,
      path: `/bot/${BOT}?permissions=3`,
    });
    expect(parse(`https://app.zrzur.com/b/${BOT}`)).toMatchObject({ id: BOT });
  });

  it("knows the beta app and the configured app origins", () => {
    expect(parse("https://beta.zrzur.com/invite/Ab12")).toMatchObject({
      code: "Ab12",
    });
    const local = {
      inviteOrigin: "https://zrzur.cc",
      appOrigins: ["http://127.0.0.1:31191"],
    };
    expect(parse("http://127.0.0.1:31191/invite/Ab12", local)).toMatchObject({
      code: "Ab12",
    });
    // another port is another site
    expect(parse("http://127.0.0.1:9999/invite/Ab12", local)).toBeNull();
  });

  it("reads the /i/{host} prefix for one of our hosts only", () => {
    expect(
      parse("https://app.zrzur.com/i/app.zrzur.com/invite/Ab12"),
    ).toMatchObject({ code: "Ab12", path: "/invite/Ab12" });
    expect(
      parse(`https://app.zrzur.com/i/app.zrzur.com/bot/${BOT}`),
    ).toMatchObject({ id: BOT });
    expect(
      parse("https://app.zrzur.com/i/evil.example/invite/Ab12"),
    ).toBeNull();
  });

  it("allows a trailing slash on app forms but no extra segments", () => {
    expect(parse("https://app.zrzur.com/invite/Ab12/")).toMatchObject({
      code: "Ab12",
    });
    expect(parse("https://app.zrzur.com/invite/Ab12/x")).toBeNull();
    expect(parse(`https://app.zrzur.com/bot/${BOT}/x`)).toBeNull();
    expect(parse("https://app.zrzur.com/x/invite/Ab12")).toBeNull();
  });

  it("does not read app pages as short invites when the app is the short origin", () => {
    const same = {
      inviteOrigin: "http://127.0.0.1:31191",
      appOrigins: ["http://127.0.0.1:31191"],
    };
    expect(parse("http://127.0.0.1:31191/Ab12", same)).toMatchObject({
      code: "Ab12",
    });
    for (const page of ["friends", "discover", "settings", "you", "dev"]) {
      expect(parse(`http://127.0.0.1:31191/${page}`, same)).toBeNull();
    }
  });
});

describe("parseOwnLink: everything else stays a normal link", () => {
  it.each([
    "https://zrzur.cc.evil.com/Dm8w7T5p",
    "https://evilzrzur.cc/Dm8w7T5p",
    "https://zrzur.cc@evil.com/Dm8w7T5p",
    "https://evil.com/zrzur.cc/Dm8w7T5p",
    "https://app.zrzur.com.evil.com/invite/Ab12",
    "https://zrzur.com/invite/Ab12",
    "https://zarzour.cc/Dm8w7T5p",
    "ftp://zrzur.cc/Dm8w7T5p",
    "javascript:alert(1)//zrzur.cc/Ab12",
    "https://zrzur.cc/Ab12%2F..%2Fusers",
    "https://zrzur.cc/Ab_12",
    "https://app.zrzur.com/invite/Ab_12",
    "https://app.zrzur.com/invite/" + "a".repeat(33),
    "https://zrzur.cc/b/01M70R4TN68KPSV0TYV7GV6K6", // 25 characters
    "https://zrzur.cc/b/01M70R4TN68KPSV0TYV7GV6K6EX", // 27 characters
    "https://zrzur.cc/b/01m70r4tn68kpsv0tyv7gv6k6e", // not a ULID's case
    "https://zrzur.cc/b/01M70R4TN68KPSV0TYV7GV6KIL", // I and L are not ULID
    "https://app.zrzur.com/bot/not-a-bot",
    "https://app.zrzur.com/friends",
    "not a url",
    "",
  ])("%s", (href) => {
    expect(parse(href)).toBeNull();
  });

  it("accepts URL objects too", () => {
    expect(parseOwnLink(new URL("https://zrzur.cc/Ab12"), opts)).toMatchObject({
      code: "Ab12",
    });
  });
});

describe("parseOwnLink reads every link the app makes", () => {
  const inst = { href: (path: string) => `https://app.zrzur.com${path}` };

  it("short and app invite links", () => {
    for (const origin of ["https://zrzur.cc", ""]) {
      const href = getInviteLink("Dm8w7T5p", inst, origin);
      expect(parse(href)).toMatchObject({ kind: "invite", code: "Dm8w7T5p" });
    }
  });

  it("short and app bot links, with permissions", () => {
    for (const origin of ["https://zrzur.cc", ""]) {
      const href = getBotLink(BOT, inst, 8, origin);
      expect(parse(href)).toMatchObject({
        kind: "bot",
        id: BOT,
        permissions: 8,
      });
    }
  });
});
