import { describe, expect, it } from "vitest";

import { filterWebhooks } from "./webhookFilter";

const hooks = [
  { id: "a", creatorId: "bot" },
  { id: "b", creatorId: "person" },
  { id: "c", creatorId: "gone" },
];
const isBot = (id: string) => id === "bot";

describe("webhooks by who made them", () => {
  it("shows all, only the ones bots made, or only people's", () => {
    expect(filterWebhooks(hooks, "all", isBot).map((h) => h.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(filterWebhooks(hooks, "bots", isBot).map((h) => h.id)).toEqual([
      "a",
    ]);
    // a maker we cannot look up counts as a person
    expect(filterWebhooks(hooks, "people", isBot).map((h) => h.id)).toEqual([
      "b",
      "c",
    ]);
  });
});
