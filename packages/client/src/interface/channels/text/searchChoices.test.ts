import { describe, expect, it } from "vitest";

import {
  addFilter,
  dayValue,
  removeFilter,
  removeKey,
  writeFilter,
} from "./searchChoices";
import { parseSearch } from "./searchSyntax";

describe("searchChoices: filters picked from the sheet are written as typed ones", () => {
  it("writes a filter the way the search reads it back", () => {
    expect(writeFilter("has", "image")).toBe("has:image");
    const written = writeFilter("from", "Lina Omar");
    expect(parseSearch(written).tokens[0]).toMatchObject({
      key: "from",
      value: "Lina Omar",
    });
  });

  it("adds a filter after the words, once", () => {
    const one = addFilter("party", "has", "image");
    expect(one).toBe("party has:image");
    expect(addFilter(one, "has", "IMAGE")).toBe(one);
    expect(addFilter("", "from", "omar")).toBe("from:omar");
  });

  it("removes one filter and keeps the words and the others", () => {
    const query = "party has:image from:omar tonight has:link";
    expect(removeFilter(query, "has", "image")).toBe(
      "party from:omar tonight has:link",
    );
    expect(removeFilter(query, "from", "omar")).toBe(
      "party has:image tonight has:link",
    );
    expect(removeFilter(query, "has", "video")).toBe(query);
  });

  it("removes every filter of a kind", () => {
    expect(removeKey("a during:2026-11-09 b during:2026-11-10", "during")).toBe(
      "a b",
    );
  });

  it("writes a day the search accepts", () => {
    const now = new Date(2026, 10, 18, 9, 30);
    expect(dayValue(0, now)).toBe("2026-11-18");
    expect(dayValue(1, now)).toBe("2026-11-17");
    expect(dayValue(18, now)).toBe("2026-10-31");
  });
});
