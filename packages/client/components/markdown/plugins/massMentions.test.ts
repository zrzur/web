import { describe, expect, it } from "vitest";

import { RE_MENTION, mentionTarget } from "./mentionTokens";

/** What each mention in a line points at */
const mentionsIn = (content: string) =>
  content
    .split(RE_MENTION)
    .filter((_, index) => index % 2)
    .map(mentionTarget);

describe("@everyone and @here", () => {
  it("draws @here as the mention of those online, like @online", () => {
    expect(mentionsIn("hi @here and @everyone")).toEqual([
      "online",
      "everyone",
    ]);
    expect(mentionsIn("old @online")).toEqual(["online"]);
  });

  it("still reads people and roles", () => {
    expect(
      mentionsIn("<@01FD58YK5W7QRV5H3D64KTQYX3> <%01FD58YK5W7QRV5H3D64KTQYX3>"),
    ).toEqual([
      "user:01FD58YK5W7QRV5H3D64KTQYX3",
      "role:01FD58YK5W7QRV5H3D64KTQYX3",
    ]);
  });
});
