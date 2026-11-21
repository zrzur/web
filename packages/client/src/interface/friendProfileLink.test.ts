import { describe, expect, it } from "vitest";

import {
  friendProfilePath,
  isUserId,
  profileLinkId,
  withoutProfileParam,
} from "./friendProfileLink";

const ID = "01HZX5Q2N7V3K8M4P6R9T0W1YA";

describe("profileLinkId", () => {
  it("reads the id from ?profile=", () => {
    expect(profileLinkId(`?profile=${ID}`)).toBe(ID);
  });

  it("reads it beside other parameters", () => {
    expect(profileLinkId(`?tab=pending&profile=${ID}&x=1`)).toBe(ID);
  });

  it("accepts the search without its question mark", () => {
    expect(profileLinkId(`profile=${ID}`)).toBe(ID);
  });

  it("trims spaces around the value", () => {
    expect(profileLinkId(`?profile=%20${ID}%20`)).toBe(ID);
  });

  it("is undefined when the parameter is missing or empty", () => {
    expect(profileLinkId("")).toBeUndefined();
    expect(profileLinkId("?tab=pending")).toBeUndefined();
    expect(profileLinkId("?profile=")).toBeUndefined();
    expect(profileLinkId("?profile=%20")).toBeUndefined();
  });

  it("gives back a value that is not an id as it is, for a notice", () => {
    expect(profileLinkId("?profile=nobody")).toBe("nobody");
  });
});

describe("isUserId", () => {
  it("takes a 26-character id", () => {
    expect(isUserId(ID)).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isUserId("nobody")).toBe(false);
    expect(isUserId(ID.toLowerCase())).toBe(false);
    expect(isUserId(`${ID}A`)).toBe(false);
    expect(isUserId("../../users/@me")).toBe(false);
    // I, L, O and U are not in the id alphabet
    expect(isUserId("01HZX5Q2N7V3K8M4P6R9T0W1YI")).toBe(false);
  });
});

describe("withoutProfileParam", () => {
  it("drops the only parameter", () => {
    expect(withoutProfileParam(`?profile=${ID}`)).toBe("");
  });

  it("keeps the others", () => {
    expect(withoutProfileParam(`?tab=pending&profile=${ID}&x=1`)).toBe(
      "?tab=pending&x=1",
    );
  });

  it("leaves a search without it alone", () => {
    expect(withoutProfileParam("?tab=pending")).toBe("?tab=pending");
    expect(withoutProfileParam("")).toBe("");
  });
});

describe("friendProfilePath", () => {
  it("builds the link a notification opens", () => {
    expect(friendProfilePath(ID)).toBe(`/friends?profile=${ID}`);
  });

  it("matches what profileLinkId reads", () => {
    const path = friendProfilePath(ID);
    expect(profileLinkId(path.slice(path.indexOf("?")))).toBe(ID);
  });
});
