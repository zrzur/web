import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** msgid → msgstr of one catalog (single-line entries) */
function catalog(locale: "ar" | "de" | "en"): Map<string, string> {
  const text = readFileSync(
    resolve(
      import.meta.dirname,
      `../../../../../i18n/catalogs/${locale}/messages.po`,
    ),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const entries = new Map<string, string>();
  for (const match of text.matchAll(/^msgid "(.*)"\nmsgstr "(.*)"$/gm)) {
    entries.set(match[1], match[2]);
  }
  return entries;
}

const source = readFileSync(
  resolve(import.meta.dirname, "useBadgeText.ts"),
  "utf8",
);

/** The badge rules of 2026-11-24 (badge plan phase 3): every number the
 * server enforces is said in every language */
const RULES: { badge: string; text: string; numbers: string[] }[] = [
  {
    badge: "community_builder",
    text: "Own a server that reaches 100 genuine human members. Bots, deleted, banned or suspended accounts, accounts under 7 days old or without a confirmed e-mail, and people who joined less than a day ago don't count. Counted a few times a day; it stays if the server gets smaller.",
    numbers: ["100", "7"],
  },
  {
    badge: "big_community",
    text: "Own a server that reaches 1,000 genuine human members, counted as for Community Builder. It stays if the server gets smaller. It is not a partnership or a verification.",
    numbers: ["1"],
  },
  {
    badge: "super_creator",
    text: "Hold Creator, with at least 25 approved, original, published designs and 180 days in the creator program. 25 is only a minimum: the team chooses. Duplicates, simple recolours and copied assets don't count.",
    numbers: ["25", "180"],
  },
  {
    badge: "beta_veteran",
    text: "Complete a beta cycle with at least 3 reviewed feedback reports or 1 confirmed bug report; the team approves it after the cycle. It stays, but gives no beta access.",
    numbers: [],
  },
  {
    badge: "creator",
    text: "Given after you join the Designs creator program and publish your first original, approved design. It stays for good unless the work was fraudulent or infringing. Making bots or videos doesn't count.",
    numbers: [],
  },
];

describe("badge rules in the app", () => {
  const ar = catalog("ar");
  const de = catalog("de");

  for (const rule of RULES) {
    it(`${rule.badge}: the app says the server's rule in ar, en and de`, () => {
      expect(source).toContain(rule.text);
      for (const [name, entries] of [
        ["ar", ar],
        ["de", de],
      ] as const) {
        const translated = entries.get(rule.text.replace(/"/g, '\\"'));
        expect(translated, `${name}: ${rule.badge}`).toBeTruthy();
        expect(translated).not.toBe(rule.text);
        for (const n of rule.numbers)
          expect(translated, `${name}: ${n}`).toContain(n);
      }
      expect(ar.get(rule.text)).toMatch(/[؀-ۿ]/);
    });
  }

  it("beta_veteran: German gives both numbers, Arabic says three and one", () => {
    const text = RULES.find((r) => r.badge === "beta_veteran")!.text;
    expect(de.get(text)).toMatch(/3.*1/);
    expect(ar.get(text)).toMatch(/بثلاثة.*واحد/);
  });

  it("no longer says the old rules", () => {
    expect(source).not.toContain("Built a server that reached 100 members.");
    expect(source).not.toContain(
      "Complete the beta as an active tester who sent feedback or a bug report.",
    );
    expect(source).not.toContain(
      "the Zrzur team picks Super Creators by hand.",
    );
  });
});
