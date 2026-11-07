import { describe, expect, it } from "vitest";

import { birthDateProblem, matchMonth, yearDigits } from "./birthMonth";

const now = new Date(2026, 10, 1); // 1 November 2026

describe("year digits", () => {
  it("keeps up to four digits", () => {
    expect(yearDigits("19a9")).toBe("199");
    expect(yearDigits("199456")).toBe("1994");
    expect(yearDigits(" 1 9 9 4 ")).toBe("1994");
  });

  it("reads Arabic-Indic and Persian digits", () => {
    expect(yearDigits("١٩٩٤")).toBe("1994");
    expect(yearDigits("۱۹۹۴")).toBe("1994");
  });
});

describe("birth date problems (same limits as the server)", () => {
  it("accepts real dates and an empty field", () => {
    expect(birthDateProblem("", 0, now)).toBeUndefined();
    expect(birthDateProblem("1994", 3, now)).toBeUndefined();
    expect(birthDateProblem("2026", 11, now)).toBeUndefined();
    expect(birthDateProblem("1906", 1, now)).toBeUndefined();
  });

  it("asks for four digits", () => {
    expect(birthDateProblem("199", 3, now)).toBe("format");
  });

  it("refuses the future and anything older than 120 years", () => {
    expect(birthDateProblem("2027", 1, now)).toBe("range");
    expect(birthDateProblem("2026", 12, now)).toBe("range");
    expect(birthDateProblem("1905", 1, now)).toBe("range");
  });

  it("never checks the minimum age (the server does)", () => {
    expect(birthDateProblem("2015", 6, now)).toBeUndefined();
  });
});

describe("month type-ahead", () => {
  const de = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  it("finds the next month starting with a letter", () => {
    expect(matchMonth(de, "m", 0)).toBe(2);
    expect(matchMonth(de, "m", 2)).toBe(4);
    expect(matchMonth(de, "m", 4)).toBe(2);
  });

  it("cycles on a repeated letter and narrows on a longer search", () => {
    expect(matchMonth(de, "jj", 0)).toBe(5);
    expect(matchMonth(de, "jul", 0)).toBe(6);
    // a longer search keeps the current month when it still matches
    expect(matchMonth(de, "mä", 2)).toBe(2);
    expect(matchMonth(de, "ma", 2)).toBe(4);
  });

  it("returns nothing without a match", () => {
    expect(matchMonth(de, "x", 0)).toBeUndefined();
  });
});
