import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SAMPLE_AVATARS,
  defaultAvatarFor,
  sampleAvatar,
  sampleAvatarFor,
  withDefaultAvatar,
} from "../../../components/ui/components/features/profiles/sampleAvatars";

import { isOn, needsMore, takenOff, weave } from "./gallery";

const many = (name: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${name}${i}`);

describe("weave", () => {
  it("keeps every tile and the order inside each kind", () => {
    const wall = weave({ look: many("l", 3), frame: many("f", 5) });
    expect(wall).toHaveLength(8);
    expect(wall.filter((tile) => tile.startsWith("f"))).toEqual(many("f", 5));
  });

  it("gives a mixed wall from six designs", () => {
    const wall = weave({
      look: many("l", 2),
      frame: many("f", 2),
      plate: many("p", 2),
    });
    expect(wall.slice(0, 4)).toEqual(["l0", "f0", "f1", "p0"]);
    expect(wall).toHaveLength(6);
  });

  it("carries on with what is left when a kind runs out", () => {
    expect(weave({ frame: many("f", 40) })).toHaveLength(40);
  });

  it("handles six hundred designs without losing one", () => {
    const wall = weave({ frame: many("f", 450), plate: many("p", 150) });
    expect(new Set(wall).size).toBe(600);
  });

  it("does not hang on kinds outside the rhythm", () => {
    expect(weave({ frame: ["f"] }, ["look"])).toEqual([]);
    expect(weave({})).toEqual([]);
  });
});

describe("try-on helpers", () => {
  it("knows when a piece is on", () => {
    const style = { decoration: "gold", theme: ["#111111", "#222222"] };
    expect(isOn(style, { decoration: "gold" })).toBe(true);
    expect(isOn(style, { decoration: "ice" })).toBe(false);
    expect(isOn(style, { theme: ["#111111", "#222222"] })).toBe(true);
    expect(isOn(style, { theme: ["#111111"] })).toBe(false);
  });

  it("takes a piece off again", () => {
    expect(takenOff({ decoration: "gold" })).toEqual({ decoration: undefined });
  });
});

describe("needsMore", () => {
  it("asks only near the end, once, while there is more", () => {
    expect(needsMore(10, 60, true, false)).toBe(false);
    expect(needsMore(56, 60, true, false)).toBe(true);
    expect(needsMore(56, 60, true, true)).toBe(false);
    expect(needsMore(56, 60, false, false)).toBe(false);
  });
});

const EXPECTED = [
  ["01M5TGZFE80SKMC8JVGJKBHS2A", "avatar-14-indigo"],
  ["01HZZZZZZZZZZZZZZZZZZZZZZZ", "avatar-04-tangerine"],
  ["01J9Q0ABCDEFGHJKMNPQRSTVWX", "avatar-05-amber"],
  ["user-1", "avatar-12-ocean"],
];

describe("sample people", () => {
  const pages = readdirSync(__dirname).filter((f) => f.endsWith(".tsx"));

  it("are all in the pack, with no name turned into a letter", () => {
    expect(SAMPLE_AVATARS).toBe(20);
    for (let i = 0; i < SAMPLE_AVATARS; i++) {
      const file = sampleAvatar(i).split("/").pop()!;
      expect(
        existsSync(join(__dirname, `../../../public/avatars/${file}`)),
      ).toBe(true);
    }
    for (const page of pages) {
      const code = readFileSync(join(__dirname, page), "utf8");
      expect(code).not.toMatch(/<Avatar[^>]*fallback=\{\s*[^<\s]/);
      expect(code).not.toMatch(/\[\.\.\.[a-zA-Z.]*name\]\[0\]/);
    }
  });

  it("give the same name the same picture", () => {
    expect(sampleAvatarFor("Lina")).toBe(sampleAvatarFor("Lina"));
    expect(sampleAvatar(21)).toBe(sampleAvatar(1));
  });

  it("choose a default picture exactly as the pack does", () => {
    // from the pack's own default-avatar.js
    for (const [id, expected] of EXPECTED) {
      expect(defaultAvatarFor(id)).toContain(expected);
    }
  });

  it("replace the server's default picture, not an official one", () => {
    const api = "https://api.zrzur.com/users/01M5TGZFE80SKMC8JVGJKBHS2A";
    expect(withDefaultAvatar(`${api}/default_avatar`)).toBe(
      defaultAvatarFor("01M5TGZFE80SKMC8JVGJKBHS2A"),
    );
    expect(withDefaultAvatar(`${api}/default_avatar?v=2`)).toBe(
      `${api}/default_avatar?v=2`,
    );
    expect(withDefaultAvatar("https://cdn/avatars/abc")).toBe(
      "https://cdn/avatars/abc",
    );
    expect(withDefaultAvatar(undefined)).toBeUndefined();
  });
});
