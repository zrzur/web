import { describe, expect, it } from "vitest";

import {
  anyTextMatches,
  compareNames,
  foldText,
  pickByFold,
  textMatches,
} from "./arabicFold";

/** Two spellings a person may type for the same word */
const same = (a: string, b: string) => expect(foldText(a)).toBe(foldText(b));

describe("foldText, letter by letter", () => {
  it.each([
    ["أ", "ا", "alef with hamza above"],
    ["إ", "ا", "alef with hamza below"],
    ["آ", "ا", "alef with madda"],
    ["ٱ", "ا", "alef wasla"],
    ["ٲ", "ا", "alef with wavy hamza above"],
    ["ة", "ه", "ta marbuta"],
    ["ى", "ي", "alef maqsura"],
    ["ی", "ي", "Persian ya"],
    ["ے", "ي", "Urdu ya barree"],
    ["ئ", "ي", "ya with hamza"],
    ["ؤ", "و", "waw with hamza"],
    ["ک", "ك", "Persian kaf"],
    ["ڪ", "ك", "swash kaf"],
    ["ہ", "ه", "Urdu ha goal"],
    ["ھ", "ه", "ha do-chashmee"],
    ["ە", "ه", "ae"],
  ])("%s is read as %s (%s)", (typed, folded) => {
    expect(foldText(typed)).toBe(folded);
  });

  it.each([
    ["\u064B", "fathatan"],
    ["\u064C", "dammatan"],
    ["\u064D", "kasratan"],
    ["\u064E", "fatha"],
    ["\u064F", "damma"],
    ["\u0650", "kasra"],
    ["\u0651", "shadda"],
    ["\u0652", "sukun"],
    ["\u0653", "madda above"],
    ["\u0654", "hamza above"],
    ["\u0655", "hamza below"],
    ["\u0670", "superscript alef"],
    ["\u06D6", "Quranic small high ligature"],
    ["\u06ED", "Quranic small low meem"],
    ["\u0640", "tatweel"],
    ["\u200C", "zero-width non-joiner"],
    ["\u200D", "zero-width joiner"],
    ["\u200E", "left-to-right mark"],
    ["\u200F", "right-to-left mark"],
    ["\u202E", "right-to-left override"],
    ["\u2067", "right-to-left isolate"],
    ["\u061C", "Arabic letter mark"],
  ])("U+%s is dropped (%s)", (mark) => {
    expect(foldText(`كت${mark}اب`)).toBe("كتاب");
  });

  it.each([
    ["٠", "0"],
    ["١", "1"],
    ["٢", "2"],
    ["٣", "3"],
    ["٤", "4"],
    ["٥", "5"],
    ["٦", "6"],
    ["٧", "7"],
    ["٨", "8"],
    ["٩", "9"],
    ["۰", "0"],
    ["۱", "1"],
    ["۲", "2"],
    ["۳", "3"],
    ["۴", "4"],
    ["۵", "5"],
    ["۶", "6"],
    ["۷", "7"],
    ["۸", "8"],
    ["۹", "9"],
  ])("digit %s is %s", (typed, latin) => {
    expect(foldText(typed)).toBe(latin);
  });

  it("keeps letters that are different letters", () => {
    for (const [a, b] of [
      ["ب", "ت"],
      ["ح", "خ"],
      ["ع", "غ"],
      ["ك", "گ"],
      ["ق", "ف"],
      ["ه", "ح"],
      ["ا", "ع"],
      ["ي", "ب"],
      ["ء", "ا"],
      ["ز", "ر"],
    ])
      expect(foldText(a)).not.toBe(foldText(b));
  });

  it("folds whole words the ways people type them", () => {
    same("أحمد", "احمد");
    same("إيمان", "ايمان");
    same("آمنة", "امنه");
    same("مدرسة", "مدرسه");
    same("مصطفى", "مصطفي");
    same("مُحَمَّدٌ", "محمد");
    same("مرحبـــــا", "مرحبا");
    same("کریم", "كريم");
    same("مسؤول", "مسوول");
    same("قائمة", "قايمه");
    same("غرفة ٢٠٢٤", "غرفه 2024");
    same("ﻻ", "لا"); // presentation-form ligature
    same("ﻣﺮﺣﺒﺎ", "مرحبا"); // presentation forms
  });

  it("folds Latin case and accents, and space runs", () => {
    same("ZAID", "zaid");
    same("José", "jose");
    same("  two   words ", "two words");
    // the dotless i of a Turkish locale must not appear
    expect(foldText("I")).toBe("i");
  });

  it("does not change what it was given", () => {
    const stored = "أَحْمَد";
    foldText(stored);
    expect(stored).toBe("أَحْمَد");
  });
});

describe("textMatches", () => {
  it("finds a word typed without the definite article", () => {
    expect(textMatches("الكتاب على الطاولة", "كتاب")).toBe(true);
  });
  it("finds a word typed with the article when the text has none", () => {
    expect(textMatches("كتاب جديد", "الكتاب")).toBe(true);
  });
  it("does not strip «ال» that is part of a short word", () => {
    expect(textMatches("م", "الم")).toBe(false);
  });
  it("needs every word typed", () => {
    expect(textMatches("أحمد الخطيب", "احمد خطيب")).toBe(true);
    expect(textMatches("أحمد الخطيب", "احمد سالم")).toBe(false);
  });
  it("an empty query matches everything", () => {
    expect(textMatches("أي شيء", "  ")).toBe(true);
  });
  it("matches digits across scripts", () => {
    expect(textMatches("الموعد يوم ١٥", "15")).toBe(true);
    expect(textMatches("الغرفة 2024", "٢٠٢٤")).toBe(true);
  });
  it("does not find what is not there", () => {
    expect(textMatches("سلمى", "سلمان")).toBe(false);
    expect(textMatches(undefined, "سلمى")).toBe(false);
  });
  it("looks in several texts", () => {
    expect(anyTextMatches([undefined, "arahmad", "أحمد"], "احمد")).toBe(true);
    expect(anyTextMatches([undefined, ""], "احمد")).toBe(false);
  });
});

describe("compareNames", () => {
  it("keeps the forms of alef together", () => {
    const sorted = ["باسل", "إيمان", "أحمد", "آمنة", "احسان"].sort(
      compareNames,
    );
    expect(sorted[sorted.length - 1]).toBe("باسل");
  });
  it("ignores vowel marks when ordering", () => {
    expect(["هُدى", "هبة", "هند"].sort(compareNames)).toEqual([
      "هبة",
      "هُدى",
      "هند",
    ]);
  });
  it("orders numbers as numbers", () => {
    expect(["قناة 10", "قناة 2"].sort(compareNames)).toEqual([
      "قناة 2",
      "قناة 10",
    ]);
  });
});

describe("pickByFold", () => {
  const people = [
    "سلمى الأحمد",
    "أحمد",
    "مصطفى",
    "هُدَى",
    "کریم",
    "فاطمة الزهراء",
    "Zaid",
  ];
  const pick = (typed: string) =>
    pickByFold(
      people,
      typed,
      (name) => name,
      (name) => name,
    );

  it("offers a name however it is typed", () => {
    expect(pick("مصطفي")).toEqual(["مصطفى"]);
    expect(pick("مصطف")).toEqual(["مصطفى"]);
    expect(pick("هدي")).toEqual(["هُدَى"]);
    expect(pick("هُد")).toEqual(["هُدَى"]);
    expect(pick("كريم")).toEqual(["کریم"]);
    expect(pick("فاطمه")).toEqual(["فاطمة الزهراء"]);
  });
  it("puts names that start with it first", () => {
    expect(pick("احم")).toEqual(["أحمد", "سلمى الأحمد"]);
  });
  it("offers nobody for a name nobody has, or for nothing typed", () => {
    expect(pick("زرافة")).toEqual([]);
    expect(pick("")).toEqual([]);
  });
  it("finds a channel typed with the article and another spelling", () => {
    expect(
      pickByFold(
        ["المكتبة-العامة", "نصوص-مختلطة"],
        "المكتبه",
        (name) => name,
        (name) => name,
      ),
    ).toEqual(["المكتبة-العامة"]);
  });
});
