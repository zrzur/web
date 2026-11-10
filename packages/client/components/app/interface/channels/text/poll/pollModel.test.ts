import { describe, expect, it } from "vitest";

import {
  ANSWERS_MAX,
  POLL_DURATIONS,
  canEndPoll,
  draftProblem,
  moveItem,
  pollPercents,
  pollTotal,
  pollsEnabled,
  toDataPoll,
  voteAction,
} from "./pollModel";

const answers = (...texts: string[]) =>
  texts.map((text, i) => ({ key: `k${i}`, text }));

describe("draftProblem", () => {
  it("accepts a question and two answers", () => {
    expect(draftProblem("Lunch?", answers("Soup", "Salad"))).toBeUndefined();
  });

  it("needs a question that is not only spaces", () => {
    expect(draftProblem("   ", answers("a", "b"))).toBe("question");
  });

  it("needs two filled answers; empty rows are ignored", () => {
    expect(draftProblem("q", answers("a", " "))).toBe("answers");
    expect(draftProblem("q", answers("a", "", "b"))).toBeUndefined();
  });

  it("counts characters, not bytes", () => {
    expect(draftProblem("س".repeat(300), answers("ج".repeat(55), "b"))).toBe(
      undefined,
    );
    expect(draftProblem("س".repeat(301), answers("a", "b"))).toBe("question");
    expect(draftProblem("q", answers("ج".repeat(56), "b"))).toBe("answer");
  });

  it("refuses more than ten answers", () => {
    const many = answers(
      ...Array.from({ length: ANSWERS_MAX + 1 }, (_, i) => `${i}`),
    );
    expect(draftProblem("q", many)).toBe("answers");
  });
});

describe("toDataPoll", () => {
  it("trims text, drops empty rows and keeps emoji", () => {
    expect(
      toDataPoll(
        "  Lunch? ",
        [
          { key: "a", text: " Soup ", emoji: "🍲" },
          { key: "b", text: "" },
          { key: "c", text: "Salad" },
        ],
        24,
        true,
      ),
    ).toEqual({
      question: "Lunch?",
      answers: [{ text: "Soup", emoji: "🍲" }, { text: "Salad" }],
      duration: 24,
      allow_multiselect: true,
    });
  });

  it("offers the durations the server takes", () => {
    expect(POLL_DURATIONS).toEqual([1, 4, 8, 24, 72, 168, 336]);
  });
});

describe("moveItem", () => {
  it("moves one row and keeps the others in order", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("results", () => {
  const poll = {
    answers: [
      { id: 1, text: "a", count: 1 },
      { id: 2, text: "b", count: 2 },
      { id: 3, text: "c", count: 0 },
    ],
  };

  it("adds every vote", () => {
    expect(pollTotal(poll)).toBe(3);
  });

  it("gives whole percentages that add up to 100", () => {
    expect(pollPercents(poll)).toEqual([33, 67, 0]);
    const thirds = {
      answers: [1, 2, 3].map((id) => ({ id, text: "", count: 1 })),
    };
    expect(pollPercents(thirds).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is all zero without votes", () => {
    expect(pollPercents({ answers: [{ id: 1, text: "", count: 0 }] })).toEqual([
      0,
    ]);
  });
});

describe("voteAction", () => {
  it("chooses an answer you did not choose and takes back one you did", () => {
    expect(voteAction({ me: [2] }, 1)).toBe("vote");
    expect(voteAction({ me: [2] }, 2)).toBe("unvote");
    expect(voteAction({}, 2)).toBe("vote");
  });
});

describe("canEndPoll", () => {
  it("lets the author or a moderator end an open poll", () => {
    expect(canEndPoll({ author: true, manage: false, closed: false })).toBe(
      true,
    );
    expect(canEndPoll({ author: false, manage: true, closed: false })).toBe(
      true,
    );
    expect(canEndPoll({ author: false, manage: false, closed: false })).toBe(
      false,
    );
    expect(canEndPoll({ author: true, manage: true, closed: true })).toBe(
      false,
    );
  });
});

describe("pollsEnabled", () => {
  it("is on only when the server says so", () => {
    expect(pollsEnabled({ configuration: { features: { polls: true } } })).toBe(
      true,
    );
    expect(
      pollsEnabled({ configuration: { features: { polls: false } } }),
    ).toBe(false);
    expect(pollsEnabled({ configuration: { features: {} } })).toBe(false);
    expect(pollsEnabled(undefined)).toBe(false);
  });
});
