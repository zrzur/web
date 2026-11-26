import { describe, expect, it } from "vitest";

import { showsVerifiedServer } from "./verifiedServer";

const server = (self: boolean) =>
  ({ owner: { self } }) as Parameters<typeof showsVerifiedServer>[0];

describe("Server settings → Verified Server", () => {
  it("shows only to the owner, and only while applications are open", () => {
    expect(showsVerifiedServer(server(true), true)).toBe(true);
    expect(showsVerifiedServer(server(true), false)).toBe(false);
    expect(showsVerifiedServer(server(false), true)).toBe(false);
    expect(
      showsVerifiedServer(
        { owner: undefined } as Parameters<typeof showsVerifiedServer>[0],
        true,
      ),
    ).toBe(false);
  });
});
