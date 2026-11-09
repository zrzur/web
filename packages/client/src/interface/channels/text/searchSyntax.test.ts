import { describe, expect, it } from "vitest";

import {
  type SearchResolver,
  parseSearch,
  replaceToken,
  tokenAt,
  toSearchRequest,
} from "./searchSyntax";

const ALICE = "01HAAAAAAAAAAAAAAAAAAAAAAA";
const BOB = "01HBBBBBBBBBBBBBBBBBBBBBBB";
const GENERAL = "01HCCCCCCCCCCCCCCCCCCCCCCC";
const MSG = "01HDDDDDDDDDDDDDDDDDDDDDDD";

const resolver: SearchResolver = {
  user: (name) =>
    ({ alice: ALICE, bob: BOB, "bob smith": BOB })[name.toLowerCase()],
  channel: (name) =>
    ({ general: GENERAL, "off topic": BOB })[name.toLowerCase()],
};

const request = (input: string) =>
  toSearchRequest(parseSearch(input), resolver);

/** local midnight of a day, as the API's ISO string */
const day = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d).toISOString();

describe("parseSearch", () => {
  it("keeps plain words and takes known keywords out", () => {
    const parsed = parseSearch("hello from:alice world has:image");
    expect(parsed.words).toBe("hello world");
    expect(parsed.tokens.map((t) => [t.key, t.value])).toEqual([
      ["from", "alice"],
      ["has", "image"],
    ]);
  });

  it("reads quoted values and keywords in any case", () => {
    const parsed = parseSearch('IN:"off topic" From:@Bob');
    expect(parsed.tokens.map((t) => [t.key, t.value])).toEqual([
      ["in", "off topic"],
      ["from", "Bob"],
    ]);
    expect(parsed.words).toBe("");
  });

  it("leaves unknown keywords and web addresses as words", () => {
    expect(parseSearch("note:x https://zrzur.com").words).toBe(
      "note:x https://zrzur.com",
    );
  });

  it("works next to Arabic words", () => {
    const parsed = parseSearch("مرحبا from:alice");
    expect(parsed.words).toBe("مرحبا");
    expect(parsed.tokens[0].value).toBe("alice");
  });
});

describe("toSearchRequest", () => {
  it("turns people into ids, several from: into a list", () => {
    const { params, problems } = request("from:alice from:bob mentions:alice");
    expect(params.authors).toEqual([ALICE, BOB]);
    expect(params.mentions).toBe(ALICE);
    expect(problems).toEqual([]);
  });

  it("accepts a user id as it is", () => {
    expect(request(`from:${BOB}`).params.authors).toEqual([BOB]);
  });

  it("says which name it does not know", () => {
    const { problems, params } = request("from:nobody");
    expect(problems).toEqual([
      { key: "from", value: "nobody", reason: "unknown-user" },
    ]);
    expect(params.authors).toBeUndefined();
  });

  it("collects has: values and refuses unknown ones", () => {
    const { params, problems } = request("has:image has:link has:cats");
    expect(params.has).toEqual(["image", "link"]);
    expect(problems[0].reason).toBe("bad-has");
  });

  it("reads days in local time: before, after and during", () => {
    expect(request("before:2026-11-09").params.before_date).toBe(
      day(2026, 11, 9),
    );
    expect(request("after:2026-11-09").params.after_date).toBe(
      day(2026, 11, 10),
    );
    const during = request("during:2026-11-09").params;
    expect(during.after_date).toBe(day(2026, 11, 9));
    expect(during.before_date).toBe(day(2026, 11, 10));
  });

  it("reads Arabic-Indic digits in dates", () => {
    expect(request("before:٢٠٢٦-١١-٠٩").params.before_date).toBe(
      day(2026, 11, 9),
    );
  });

  it("takes a message id as a bound", () => {
    expect(request(`before:${MSG}`).params.before).toBe(MSG);
    expect(request(`after:${MSG}`).params.after).toBe(MSG);
  });

  it("refuses a date it cannot read", () => {
    expect(request("before:soon").problems[0].reason).toBe("bad-date");
    expect(request("during:2026-13-40").problems[0].reason).toBe("bad-date");
  });

  it("makes in: a server-wide search of those channels", () => {
    const { params, serverWide } = request('in:general in:"off topic" hi');
    expect(serverWide).toBe(true);
    expect(params.channels).toEqual([GENERAL, BOB]);
    expect(params.query).toBe("hi");
    expect(request("in:#nowhere").problems[0].reason).toBe("unknown-channel");
  });

  it("reads pinned: yes and no", () => {
    expect(request("pinned:true").params.pinned).toBe(true);
    expect(request("pinned:no").params.pinned).toBe(false);
    expect(request("pinned:maybe").problems[0].reason).toBe("bad-pinned");
  });

  it("is empty when nothing is asked", () => {
    expect(request("   ").empty).toBe(true);
    expect(request("from:").empty).toBe(true);
    expect(request("has:file").empty).toBe(false);
  });
});

describe("autocomplete helpers", () => {
  it("finds the keyword and the part typed under the caret", () => {
    expect(tokenAt("hi from:al", 10)).toMatchObject({
      key: "from",
      partial: "al",
      start: 3,
      end: 10,
    });
    expect(tokenAt("hi fr", 5)).toMatchObject({ key: null, partial: "fr" });
    expect(tokenAt("", 0)).toMatchObject({ key: null, partial: "" });
  });

  it("replaces the token and puts the caret after a space", () => {
    expect(replaceToken("hi from:al", 3, 10, "from:alice")).toEqual({
      text: "hi from:alice ",
      caret: 14,
    });
  });
});

describe("review fixes", () => {
  it("reads quoted names after @ and #", () => {
    const parsed = parseSearch('from:@"John Doe" in:#"off topic"');
    expect(parsed.tokens.map((t) => [t.key, t.value])).toEqual([
      ["from", "John Doe"],
      ["in", "off topic"],
    ]);
  });

  it("ends an unclosed quote before the next filter", () => {
    const parsed = parseSearch('from:"John Doe has:image');
    expect(parsed.tokens.map((t) => [t.key, t.value])).toEqual([
      ["from", "John Doe"],
      ["has", "image"],
    ]);
  });

  it("says when a second mentions: is not used", () => {
    const { params, problems } = request("mentions:alice mentions:bob");
    expect(params.mentions).toBe(ALICE);
    expect(problems).toEqual([
      { key: "mentions", value: "bob", reason: "one-only" },
    ]);
  });

  it("says when there are more from: than the server takes", () => {
    const ids = Array.from(
      { length: 11 },
      (_, i) => `01H${String(i).padStart(23, "0")}`,
    );
    const { params, problems } = request(
      ids.map((id) => `from:${id}`).join(" "),
    );
    expect(params.authors).toHaveLength(10);
    expect(problems[0].reason).toBe("too-many");
  });

  it("cuts long words by characters, not halves of emoji, and says so", () => {
    const words = "😀".repeat(70);
    const result = request(words);
    expect([...result.params.query!]).toHaveLength(64);
    expect(result.params.query).toBe("😀".repeat(64));
    expect(result.truncated).toBe(true);
    expect(request("short").truncated).toBe(false);
  });

  it("gives one plain problem for in: outside a server", () => {
    const result = toSearchRequest(parseSearch("in:general hi"), {
      ...resolver,
      inServer: false,
    });
    expect(result.serverWide).toBe(false);
    expect(result.problems).toEqual([
      { key: "in", value: "general", reason: "no-server" },
    ]);
  });
});
