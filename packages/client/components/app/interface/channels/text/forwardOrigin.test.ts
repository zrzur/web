import { describe, expect, it } from "vitest";

import { originLink } from "./forwardOrigin";

const origin = {
  channel: "C1",
  server: "S1",
  message: "M1",
  sent_at: "2026-11-09T12:00:00Z",
};

describe("originLink", () => {
  it("links to the original message when the reader knows its channel", () => {
    const link = originLink(origin, (id) =>
      id === "C1"
        ? {
            path: "/server/S1/channel/C1",
            type: "TextChannel",
            displayName: "general",
            server: { name: "Book Club" },
          }
        : undefined,
    );
    expect(link).toEqual({
      path: "/server/S1/channel/C1/M1",
      place: "#general · Book Club",
    });
  });

  it("names a direct message or group by its name only", () => {
    const link = originLink(origin, () => ({
      path: "/channel/C1",
      type: "DirectMessage",
      displayName: "layla",
    }));
    expect(link).toEqual({ path: "/channel/C1/M1", place: "layla" });
  });

  it("gives no link when the origin names no place (DMs, groups, other names)", () => {
    const lookups: string[] = [];
    const link = originLink({ message: "M1" }, (id) => {
      lookups.push(id);
      return undefined;
    });
    expect(link).toBeUndefined();
    expect(lookups).toEqual([]);
  });

  it("gives no link when the reader can't open the channel", () => {
    expect(originLink(origin, () => undefined)).toBeUndefined();
  });
});
