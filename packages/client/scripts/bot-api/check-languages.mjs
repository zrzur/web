#!/usr/bin/env node
// The three languages of a documentation page must say the same thing. This
// compares what can be compared without reading the prose: every `code`
// name, every link target, every anchor and every number of the English
// page must be in the Arabic and the German page as often, and the other
// way round. A difference is printed with its page and language.
//
// Usage (from web/packages/client): node scripts/bot-api/check-languages.mjs
// Exit code 1 when a page differs.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  anchorsOf,
  inlineCodeOf,
  linksOf,
} from "../../src/interface/developers/docs/markdownTree.ts";

const here = dirname(fileURLToPath(import.meta.url));
const content = resolve(here, "../../src/interface/developers/docs/content");

const count = (items) => {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
};

/** What is in one list more often than in the other */
function difference(english, translated) {
  const a = count(english);
  const b = count(translated);
  const out = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const delta = (b.get(key) ?? 0) - (a.get(key) ?? 0);
    if (delta) out.push(`${delta > 0 ? "+" : ""}${delta} ${key}`);
  }
  return out;
}

/** Numbers of the prose: code blocks, code and link targets are compared apart */
function numbersOf(source) {
  const prose = source
    .replace(/^```[\s\S]*?^```$/gm, "")
    .replace(/^@@\d+$/gm, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/\{#[a-z0-9-]+\}/g, "")
    // Arabic digits and separators, written the Latin way for comparing
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/(\d)[ \u00a0\u202f\u2009](?=\d{3}\b)/g, "$1");
  return (prose.match(/\d+(?:[.,]\d+)*/g) ?? []).map((number) =>
    number.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."),
  );
}

const fences = (source) => (source.match(/^```/gm) ?? []).length / 2;
const references = (source) => (source.match(/^@@\d+$/gm) ?? []).length;

/**
 * Differences that were read and say the same thing: Arabic writes a
 * number as a word or names a thing the English sentence only points at.
 */
const SAME_MEANING = {
  "ar/interactions.md": ["numbers: -1 15"], // «الدقائق الخمس عشرة»
  "ar/messages.md": ["numbers: -1 50"], // «خمسين رسالة»
  "ar/oauth2.md": ["code: +1 code_challenge"], // names the value again
  "ar/tutorial-full-bot.md": ["code: +1 429"], // "a global one" names 429
};

let failed = 0;
for (const file of readdirSync(content).filter((name) =>
  name.endsWith(".md"),
)) {
  const english = readFileSync(join(content, file), "utf8");
  for (const language of ["ar", "de"]) {
    const translated = readFileSync(join(content, language, file), "utf8");
    const problems = [];
    const check = (what, a, b) => {
      const delta = difference(a, b);
      if (delta.length) problems.push(`${what}: ${delta.join(" | ")}`);
    };
    check("code", inlineCodeOf(english), inlineCodeOf(translated));
    check("links", linksOf(english), linksOf(translated));
    // the title's anchor follows its words; nothing links to it
    check(
      "anchors",
      anchorsOf(english).slice(1),
      anchorsOf(translated).slice(1),
    );
    // Arabic writes one to ten as words ("دقيقتين"), so only larger numbers
    // can be compared there
    const comparable = (numbers) =>
      language === "ar" ? numbers.filter((n) => Number(n) > 10) : numbers;
    check(
      "numbers",
      comparable(numbersOf(english)),
      comparable(numbersOf(translated)),
    );
    if (fences(english) !== references(translated))
      problems.push(
        `code blocks: ${fences(english)} in English, ${references(translated)} references`,
      );
    const read = SAME_MEANING[`${language}/${file}`] ?? [];
    for (const known of read) {
      const at = problems.indexOf(known);
      if (at !== -1) problems.splice(at, 1);
    }
    if (problems.length) {
      failed++;
      console.log(`${language}/${file}\n  ${problems.join("\n  ")}`);
    }
  }
}
console.log(`${failed} page translations differ`);
process.exit(failed ? 1 : 0);
