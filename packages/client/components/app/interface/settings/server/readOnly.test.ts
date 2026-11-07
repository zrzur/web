import { describe, expect, it } from "vitest";

import { missing } from "./permissionNeed";

const serverWith = (granted: string[]) =>
  ({ havePermission: (p: string) => granted.includes(p) }) as never;

describe("missing", () => {
  it("is empty when the person has the permission", () => {
    expect(missing(serverWith(["ManageServer"]), "ManageServer")).toBeUndefined();
  });

  it("names the permission that is lacking", () => {
    expect(missing(serverWith(["ManageChannel"]), "ManageServer")).toBe(
      "ManageServer",
    );
  });
});
