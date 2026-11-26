import { describe, expect, it } from "vitest";

import { type CommunityItem, CREATOR_TERMS_VERSION } from "../communityApi";

import {
  type FileFacts,
  fileChecks,
  fileRefused,
  isAnimated,
  pixelFacts,
} from "./fileCheck";
import { FIT_DEFAULT, clampFit, fitRect, needsRedraw } from "./fit";
import {
  type StepFacts,
  actionsOf,
  emptyRights,
  filtersOf,
  firstOpenStep,
  needsAttention,
  reviewNote,
  rightsFromStored,
  rightsInput,
  rightsMissing,
  shownStatus,
  stepOpen,
  studioCounts,
  studioList,
} from "./studioModel";

const item = (over: Partial<CommunityItem>): CommunityItem =>
  ({
    _id: "01",
    kind: "Decoration",
    name: "Rose ring",
    creator_id: "u",
    file: { _id: "f" },
    status: "Draft",
    revision: 1,
    popularity: 0,
    ...over,
  }) as CommunityItem;

const pending = (status: string, note?: string) =>
  ({
    revision: 2,
    name: "Rose ring 2",
    file: { _id: "g" },
    status,
    review_note: note,
    submitted_at: 1,
  }) as CommunityItem["pending"];

describe("studio tabs", () => {
  it("puts every state in a tab of its own", () => {
    expect(filtersOf(item({ status: "Draft" }))).toEqual(["drafts"]);
    expect(filtersOf(item({ status: "PendingReview" }))).toEqual(["review"]);
    for (const status of ["ChangesRequested", "Rejected", "Suspended"])
      expect(filtersOf(item({ status } as never))).toEqual(["attention"]);
    expect(filtersOf(item({ status: "Published" }))).toEqual(["published"]);
    expect(filtersOf(item({ status: "Archived" }))).toEqual(["withdrawn"]);
  });

  it("lists a published design with a new version under both", () => {
    const live = item({ status: "Published", pending: pending("Draft") });
    expect(filtersOf(live)).toEqual(["published", "drafts"]);
    expect(shownStatus(live)).toBe("Draft");
    expect(shownStatus(item({ status: "Published" }))).toBe("Published");
  });

  it("counts each tab, and all once per design", () => {
    const counts = studioCounts([
      item({ status: "Draft" }),
      item({ status: "Published", pending: pending("PendingReview") }),
      item({ status: "Rejected" }),
      item({ status: "Archived" }),
    ]);
    expect(counts).toEqual({
      all: 4,
      drafts: 1,
      review: 1,
      attention: 1,
      published: 1,
      withdrawn: 1,
    });
  });

  it("shows the note on the version in the works first", () => {
    const sentBack = item({
      status: "Published",
      review_note: "old",
      pending: pending("ChangesRequested", "calm the flash"),
    });
    expect(reviewNote(sentBack)).toBe("calm the flash");
    expect(needsAttention([sentBack, item({})])).toEqual([sentBack]);
    expect(reviewNote(item({ review_note: "too dark" }))).toBe("too dark");
  });

  it("searches names, tags and descriptions, by type and tab", () => {
    const items = [
      item({ _id: "1", name: "طوق الوَرْد", tags: ["spring"] }),
      item({ _id: "2", kind: "Nameplate", name: "Café night" }),
      item({ _id: "3", kind: "Effect", name: "Comets", status: "Published" }),
    ];
    const ids = (list: CommunityItem[]) => list.map((entry) => entry._id);
    expect(ids(studioList(items, "all", "all", "ورد"))).toEqual(["1"]);
    expect(ids(studioList(items, "all", "all", "cafe"))).toEqual(["2"]);
    expect(ids(studioList(items, "all", "all", "SPRING"))).toEqual(["1"]);
    expect(ids(studioList(items, "all", "nameplates", ""))).toEqual(["2"]);
    expect(ids(studioList(items, "published", "all", ""))).toEqual(["3"]);
    expect(studioList(items, "published", "decorations", "")).toEqual([]);
  });

  it("offers only what the server allows", () => {
    expect(actionsOf(item({ status: "Draft" }), false)).toMatchObject({
      edit: true,
      publish: true,
      withdraw: true,
      restore: false,
      remove: true,
    });
    expect(actionsOf(item({ status: "Published" }), false)).toMatchObject({
      edit: true,
      publish: false,
      withdraw: true,
      // owner, 2026-11-25: anything they publish, they can delete
      remove: true,
    });
    expect(actionsOf(item({ status: "PendingReview" }), false).publish).toBe(
      false,
    );
    expect(actionsOf(item({ status: "Archived" }), false)).toMatchObject({
      edit: false,
      publish: false,
      withdraw: false,
      restore: true,
      remove: true,
    });
    expect(actionsOf(item({ status: "Suspended" }), false)).toMatchObject({
      edit: false,
      withdraw: false,
      remove: false,
    });
    // a suspended creator only downloads
    expect(actionsOf(item({ status: "Draft" }), true)).toEqual({
      edit: false,
      publish: false,
      withdraw: false,
      restore: false,
      remove: false,
      download: true,
    });
  });
});

describe("rights step", () => {
  it("asks every question before it gives a promise", () => {
    expect(rightsMissing(emptyRights())).toEqual([
      "own",
      "others",
      "ai",
      "confirmed",
    ]);
    expect(rightsInput(emptyRights())).toBeUndefined();
  });

  it("gives the plain promise for own work", () => {
    expect(
      rightsInput({
        own: "mine",
        others: false,
        othersText: "left over",
        ai: false,
        aiText: "",
        confirmed: true,
      }),
    ).toEqual({
      confirmed: true,
      terms_version: CREATOR_TERMS_VERSION,
      third_party: undefined,
      ai_parts: undefined,
    });
  });

  it("needs the source for licensed work and for parts by others", () => {
    const licensed = { ...emptyRights(), own: "licensed" as const, ai: false };
    // the "parts by others" question is answered by the licence itself
    expect(rightsMissing(licensed)).toEqual(["othersText", "confirmed"]);
    const others = {
      ...emptyRights(),
      own: "mine" as const,
      others: true,
      ai: true,
      confirmed: true,
    };
    expect(rightsMissing(others)).toEqual(["othersText", "aiText"]);
    expect(
      rightsInput({
        ...others,
        othersText: " Cairo font, OFL 1.1 ",
        aiText: "sky, made with a tool",
      }),
    ).toMatchObject({
      third_party: "Cairo font, OFL 1.1",
      ai_parts: "sky, made with a tool",
    });
  });

  it("never ticks the box for them", () => {
    const answers = rightsFromStored({ third_party: "Cairo font, OFL" });
    expect(answers.own).toBeUndefined();
    expect(answers).toMatchObject({
      others: true,
      othersText: "Cairo font, OFL",
      ai: false,
      confirmed: false,
    });
    expect(rightsFromStored(undefined)).toEqual(emptyRights());
  });
});

describe("steps", () => {
  const facts = (over: Partial<StepFacts>): StepFacts => ({
    hasImage: false,
    fileRefused: false,
    name: "",
    rights: emptyRights(),
    rightsKept: false,
    ...over,
  });

  it("walks in order", () => {
    expect(firstOpenStep(facts({}))).toBe("type");
    expect(firstOpenStep(facts({ kind: "decorations" }))).toBe("file");
    const withFile = facts({ kind: "decorations", hasImage: true });
    expect(firstOpenStep(withFile)).toBe("details");
    expect(firstOpenStep({ ...withFile, name: "Rose" })).toBe("rights");
    expect(firstOpenStep({ ...withFile, name: "Rose", rightsKept: true })).toBe(
      "send",
    );
  });

  it("does not open a step past an unfinished one", () => {
    const withFile = facts({ kind: "decorations", hasImage: true });
    expect(stepOpen("preview", withFile)).toBe(true);
    expect(stepOpen("details", withFile)).toBe(true);
    expect(stepOpen("rights", withFile)).toBe(false);
    expect(stepOpen("send", { ...withFile, name: "Rose" })).toBe(false);
    // a refused file stops at the file
    expect(stepOpen("details", { ...withFile, fileRefused: true })).toBe(false);
  });
});

describe("file checks", () => {
  const facts = (over: Partial<FileFacts>): FileFacts => ({
    name: "ring.png",
    type: "image/png",
    bytes: 400_000,
    width: 1024,
    height: 1024,
    animated: false,
    clear: 0.7,
    overFace: 0,
    ...over,
  });
  const states = (checks: ReturnType<typeof fileChecks>) =>
    Object.fromEntries(checks.map((check) => [check.id, check.state]));

  it("passes a clean decoration", () => {
    const checks = fileChecks("decorations", facts({}));
    expect(states(checks)).toEqual({
      size: "ok",
      format: "ok",
      weight: "ok",
      transparent: "ok",
      safe: "ok",
    });
    expect(fileRefused(checks)).toBe(false);
  });

  it("warns about shape, a filled background and art over the face", () => {
    const checks = fileChecks(
      "decorations",
      facts({ width: 800, height: 300, clear: 0, overFace: 0.6 }),
    );
    expect(checks.find((check) => check.id === "size")).toEqual({
      id: "size",
      state: "warn",
      reason: "square",
    });
    expect(states(checks)).toMatchObject({ transparent: "warn", safe: "warn" });
    expect(fileRefused(checks)).toBe(false);
    expect(
      fileChecks("decorations", facts({ width: 256, height: 256 }))[0],
    ).toMatchObject({ state: "warn", reason: "small" });
  });

  it("refuses an effect that is still, the wrong shape or too solid", () => {
    const effect = (over: Partial<FileFacts>) =>
      fileChecks(
        "effects",
        facts({
          width: 576,
          height: 1024,
          animated: true,
          clear: 0.8,
          ...over,
        }),
      );
    expect(fileRefused(effect({}))).toBe(false);
    expect(states(effect({ animated: false })).motion).toBe("fail");
    expect(states(effect({ width: 1024, height: 1024 })).size).toBe("fail");
    expect(states(effect({ clear: 0.3 })).transparent).toBe("fail");
  });

  it("leaves a WebM to the server", () => {
    const checks = fileChecks(
      "effects",
      facts({
        type: "video/webm",
        width: 576,
        height: 1024,
        animated: undefined,
      }),
    );
    expect(checks.map((check) => check.id)).toEqual([
      "size",
      "format",
      "weight",
      "motion",
    ]);
    expect(fileRefused(checks)).toBe(false);
  });

  it("tells an animated file from a still one", () => {
    const chunk = (name: string, length = 0) => [
      0,
      0,
      0,
      length,
      ...[...name].map((letter) => letter.charCodeAt(0)),
      ...new Array(length + 4).fill(0),
    ];
    const png = (...chunks: number[][]) =>
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunks.flat()]);
    expect(isAnimated(png(chunk("IHDR", 13), chunk("IDAT")), "image/png")).toBe(
      false,
    );
    expect(
      isAnimated(
        png(chunk("IHDR", 13), chunk("acTL", 8), chunk("IDAT")),
        "image/png",
      ),
    ).toBe(true);

    const riff = (name: string) => [
      ...[..."RIFF"].map((letter) => letter.charCodeAt(0)),
      0,
      0,
      0,
      0,
      ...[..."WEBP"].map((letter) => letter.charCodeAt(0)),
      ...[...name].map((letter) => letter.charCodeAt(0)),
      2,
      0,
      0,
      0,
      0,
      0,
    ];
    expect(isAnimated(new Uint8Array(riff("VP8 ")), "image/webp")).toBe(false);
    expect(isAnimated(new Uint8Array(riff("ANIM")), "image/webp")).toBe(true);

    const gif = (frames: number) =>
      new Uint8Array([
        ...[..."GIF89a"].map((letter) => letter.charCodeAt(0)),
        1,
        0,
        1,
        0,
        0,
        0,
        0,
        ...new Array(frames)
          .fill([0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0])
          .flat(),
        0x3b,
      ]);
    expect(isAnimated(gif(1), "image/gif")).toBe(false);
    expect(isAnimated(gif(3), "image/gif")).toBe(true);
    expect(isAnimated(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe(false);
  });

  it("measures see-through pixels and art over the avatar", () => {
    const size = 30;
    const pixels = (fill: (x: number, y: number) => boolean) => {
      const data = new Uint8ClampedArray(size * size * 4);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          data[(y * size + x) * 4 + 3] = fill(x, y) ? 255 : 0;
      return data;
    };
    // a ring outside the avatar
    const ring = pixelFacts(
      pixels((x, y) => Math.hypot(x + 0.5 - 15, y + 0.5 - 15) > 11),
      size,
      size,
      "decorations",
    );
    expect(ring.overFace).toBe(0);
    expect(ring.clear).toBeGreaterThan(0.3);
    // a filled square hides the face
    const solid = pixelFacts(
      pixels(() => true),
      size,
      size,
      "decorations",
    );
    expect(solid).toEqual({ clear: 0, overFace: 1 });
    // nothing to measure against on a nameplate
    expect(
      pixelFacts(
        pixels(() => true),
        size,
        size,
        "nameplates",
      ).overFace,
    ).toBeUndefined();
  });
});

describe("fit", () => {
  it("covers the frame at 100 %", () => {
    expect(fitRect("decorations", 512, 512, FIT_DEFAULT)).toMatchObject({
      x: 0,
      y: 0,
      width: 1024,
      height: 1024,
    });
    // a wide image on a square frame is centred and cropped at the sides
    const wide = fitRect("decorations", 2000, 1000, FIT_DEFAULT);
    expect(wide).toMatchObject({ width: 2048, height: 1024, x: -512, y: 0 });
    const plate = fitRect("nameplates", 1024, 192, FIT_DEFAULT);
    expect(plate).toMatchObject({ width: 1024, height: 192, x: 0, y: 0 });
  });

  it("scales about the middle and shifts by a share of the frame", () => {
    const rect = fitRect("decorations", 1024, 1024, {
      scale: 50,
      x: 10,
      y: -10,
    });
    expect(rect.width).toBe(512);
    expect(rect.x).toBeCloseTo(256 + 102.4);
    expect(rect.y).toBeCloseTo(256 - 102.4);
  });

  it("keeps values in range and whole", () => {
    expect(clampFit({ scale: 500, x: -99, y: 3.6 })).toEqual({
      scale: 160,
      x: -30,
      y: 4,
    });
  });

  it("uploads a right-sized, unmoved file as it is, and never redraws animation", () => {
    expect(needsRedraw("decorations", 1024, 1024, FIT_DEFAULT, false)).toBe(
      false,
    );
    expect(needsRedraw("decorations", 800, 800, FIT_DEFAULT, false)).toBe(true);
    expect(
      needsRedraw("decorations", 1024, 1024, { ...FIT_DEFAULT, y: 4 }, false),
    ).toBe(true);
    expect(
      needsRedraw("decorations", 800, 300, { scale: 80, x: 0, y: 0 }, true),
    ).toBe(false);
  });
});
