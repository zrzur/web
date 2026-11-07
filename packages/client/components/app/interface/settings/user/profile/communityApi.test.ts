import { Api } from "@zrzur/sdk";
import type { Client } from "@zrzur/sdk/solid";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CommunityItem,
  artFit,
  can,
  checkCommunityFile,
  communityApi,
  communityErrorType,
  communityParams,
  creatorHandle,
  creatorName,
  effectProblem,
  isRankRefusal,
  kindOf,
  mayCreate,
  maySeeStudio,
  parseTags,
  studioBuckets,
} from "./communityApi";

// the real HTTP client of the SDK, over the stubbed global fetch
const client = {
  api: new Api({
    baseURL: "http://127.0.0.1:14702",
    authentication: { session: "token" },
  }),
} as unknown as Client;

function respond(status: number, body?: unknown) {
  const fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const item = (
  status: CommunityItem["status"],
  pending?: CommunityItem["status"],
): CommunityItem =>
  ({
    _id: `${status}-${pending ?? ""}`,
    kind: "Decoration",
    name: "x",
    creator_id: "u",
    file: { _id: "f" },
    status,
    revision: 1,
    popularity: 0,
    pending: pending ? { status: pending } : undefined,
  }) as CommunityItem;

afterEach(() => vi.unstubAllGlobals());

describe("communityParams", () => {
  it("maps filters to sort and favourites", () => {
    expect(communityParams("all", "")).toEqual({
      query: undefined,
      sort: undefined,
      favourites: undefined,
      limit: 60,
      offset: undefined,
    });
    expect(communityParams("popular", "  ring ").sort).toBe("popular");
    expect(communityParams("popular", "  ring ").query).toBe("ring");
    expect(communityParams("favourites", "").favourites).toBe(true);
    expect(communityParams("new", "", 60).offset).toBe(60);
  });
});

describe("artFit", () => {
  it("advises on the shape of an image without blocking it", () => {
    expect(artFit("decorations", 1024, 1024)).toBeUndefined();
    expect(artFit("decorations", 800, 600)).toBe("square");
    expect(artFit("nameplates", 1024, 192)).toBeUndefined();
    expect(artFit("nameplates", 1024, 512)).toBe("wide");
    expect(artFit("nameplates", 1600, 100)).toBe("wide");
  });
});

describe("helpers", () => {
  it("names creators and checks permissions", () => {
    const creator = {
      _id: "1",
      username: "sara",
      discriminator: "0001",
      verified: true,
    };
    expect(creatorName(creator)).toBe("sara");
    expect(creatorName({ ...creator, display_name: "سارة" })).toBe("سارة");
    expect(creatorHandle(creator)).toBe("@sara#0001");
    expect(can({ permissions: ["cosmetics.review"] }, "cosmetics.review")).toBe(
      true,
    );
    expect(can({ permissions: [] }, "cosmetics.submit")).toBe(false);
    expect(can(undefined, "cosmetics.submit")).toBe(false);
  });

  it("checks files before uploading", () => {
    expect(checkCommunityFile({ type: "image/svg+xml", size: 10 })).toBe(
      "type",
    );
    expect(checkCommunityFile({ type: "text/html", size: 10 })).toBe("type");
    expect(checkCommunityFile({ type: "image/png", size: 3_000_000 })).toBe(
      "size",
    );
    expect(checkCommunityFile({ type: "image/webp", size: 1000 })).toBe(
      undefined,
    );
  });

  it("parses tags in Latin and Arabic text", () => {
    expect(parseTags("Fire, ice  fire،نار")).toEqual(["fire", "ice", "نار"]);
  });

  it("reads error types", () => {
    expect(
      communityErrorType(JSON.stringify({ type: "MissingPlatformPermission" })),
    ).toBe("MissingPlatformPermission");
    expect(communityErrorType("not json")).toBe(undefined);
  });

  it("tells a refusal over the rank from other failures", () => {
    expect(isRankRefusal({ type: "MissingPlatformPermission" })).toBe(true);
    expect(isRankRefusal({ type: "TooManyCommunityItems" })).toBe(false);
    expect(isRankRefusal(new Error("offline"))).toBe(false);
  });

  it("sorts designs into studio tabs", () => {
    const buckets = studioBuckets([
      item("Draft"),
      item("PendingReview"),
      item("ChangesRequested"),
      item("Published"),
      item("Published", "PendingReview"),
      item("Rejected"),
      item("Archived"),
    ]);
    // no review step: anything not yet public is a draft to publish, and a
    // published design with an unpublished new version is in both
    expect(Object.keys(buckets)).toEqual(["drafts", "published"]);
    expect(buckets.drafts).toHaveLength(5);
    expect(buckets.published).toHaveLength(2);
  });
});

describe("communityApi", () => {
  it("lists published designs with filters in the query", async () => {
    const fetch = respond(200, { items: [], creators: [] });
    await communityApi.list(
      client,
      "decorations",
      communityParams("popular", "ring"),
    );
    const url = new URL(String((fetch.mock.calls[0] as unknown as [URL])[0]));
    expect(url.pathname).toBe("/community/decorations");
    expect(url.searchParams.get("sort")).toBe("popular");
    expect(url.searchParams.get("query")).toBe("ring");
    expect(url.searchParams.has("favourites")).toBe(false);
  });

  it("sends review decisions with reason and version", async () => {
    const fetch = respond(200, {});
    await communityApi.decide(client, "abc", "reject", "  too big ", 3);
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(
      "http://127.0.0.1:14702/community/items/abc/reject",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      reason: "too big",
      version: 3,
    });
  });

  it("toggles favourites with PUT and DELETE", async () => {
    const fetch = respond(204);
    await communityApi.favourite(client, "a/b", true);
    await communityApi.favourite(client, "a/b", false);
    const calls = fetch.mock.calls as unknown as [URL, RequestInit][];
    expect(calls[0][1].method).toBe("PUT");
    expect(calls[1][1].method).toBe("DELETE");
    expect(String(calls[0][0])).toContain("/community/items/a%2Fb/favourite");
  });

  it("throws an ApiError with the server's error type on failure", async () => {
    respond(403, { type: "MissingPlatformPermission" });
    const failure = await communityApi
      .create(client, "decorations", { name: "x", file: "f" })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({
      status: 403,
      type: "MissingPlatformPermission",
    });
    expect(communityErrorType(failure)).toBe("MissingPlatformPermission");
  });

  it("manages creators through the admin routes", async () => {
    const fetch = respond(200, {});
    await communityApi.creatorAction(client, "u1", "grant", " ok ");
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:14702/admin/creators");
    expect(JSON.parse(String(init.body))).toEqual({
      user: "u1",
      action: "grant",
      reason: "ok",
    });
  });
});

describe("mayCreate", () => {
  it("needs the right to submit, whatever the standing says", () => {
    expect(mayCreate(undefined)).toBe(false);
    expect(mayCreate({ permissions: [] })).toBe(false);
    expect(
      mayCreate({
        permissions: ["cosmetics.manage_own"],
        creator: "Suspended",
      }),
    ).toBe(false);
    expect(
      mayCreate({ permissions: ["cosmetics.submit"], creator: "Active" }),
    ).toBe(true);
  });

  it("is not given by staff rights alone", () => {
    // a privileged account holds every permission and no creator record
    expect(mayCreate({ permissions: ["cosmetics.submit"] })).toBe(false);
  });

  it("does not count a paused rank", () => {
    expect(
      mayCreate({ permissions: ["cosmetics.submit"], creator: "Suspended" }),
    ).toBe(false);
  });
});

describe("maySeeStudio", () => {
  const own = ["cosmetics.manage_own"];

  it("lets active creators in", () => {
    expect(
      maySeeStudio({
        permissions: ["cosmetics.submit", ...own],
        creator: "Active",
      }),
    ).toBe(true);
  });

  it("lets a suspended creator see their designs, not make them", () => {
    const suspended = { permissions: own, creator: "Suspended" };
    expect(maySeeStudio(suspended)).toBe(true);
    expect(mayCreate(suspended)).toBe(false);
  });

  it("keeps out a revoked creator", () => {
    expect(maySeeStudio({ permissions: own, creator: "Revoked" })).toBe(false);
  });

  it("keeps out staff rights with no creator record", () => {
    expect(maySeeStudio({ permissions: ["cosmetics.submit", ...own] })).toBe(
      false,
    );
    expect(maySeeStudio(undefined)).toBe(false);
  });
});

describe("effects", () => {
  it("have their own size limit", () => {
    const type = "image/gif";
    expect(checkCommunityFile({ type, size: 2_100_000 }, "effects")).toBe(
      "size",
    );
    expect(checkCommunityFile({ type, size: 2_100_000 })).toBeUndefined();
    expect(
      checkCommunityFile({ type, size: 1_900_000 }, "effects"),
    ).toBeUndefined();
    expect(
      checkCommunityFile({ type: "image/svg+xml", size: 10 }, "effects"),
    ).toBe("type");
  });

  it("have the shape of a profile", () => {
    expect(artFit("effects", 576, 1024)).toBeUndefined();
    expect(artFit("effects", 1024, 1024)).toBe("tall");
  });

  it("are listed under their own address", () => {
    expect(kindOf({ kind: "Effect" })).toBe("effects");
    expect(kindOf({ kind: "Nameplate" })).toBe("nameplates");
    expect(kindOf({ kind: "Decoration" })).toBe("decorations");
  });

  it("read why the media server refused a file", () => {
    expect(
      effectProblem({ fields: [{ field: "file", rule: "flashing" }] }),
    ).toBe("flashing");
    expect(
      effectProblem({ fields: [{ field: "file", rule: "image" }] }),
    ).toBeUndefined();
    expect(effectProblem(new Error("no"))).toBeUndefined();
    expect(effectProblem(undefined)).toBeUndefined();
  });
});

describe("a WebM", () => {
  const type = "video/webm";

  it("has its own limit going in, for every kind", () => {
    for (const kind of ["decorations", "nameplates", "effects"] as const) {
      expect(
        checkCommunityFile({ type, size: 7_900_000 }, kind),
      ).toBeUndefined();
      expect(checkCommunityFile({ type, size: 8_100_000 }, kind)).toBe(
        "webm-size",
      );
    }
  });

  it("reads why the media server refused one", () => {
    expect(effectProblem({ fields: [{ field: "file", rule: "webm" }] })).toBe(
      "webm",
    );
  });
});
