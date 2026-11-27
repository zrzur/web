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

/** The one source of badge texts, and the guide's details below it */
const source = [
  resolve(import.meta.dirname, "useBadgeText.ts"),
  resolve(
    import.meta.dirname,
    "../../../../../../src/interface/badgeGuide/useBadgeGuide.ts",
  ),
]
  .map((path) => readFileSync(path, "utf8"))
  .join(String.fromCharCode(10));

/** The badge rules (badge plan phase 3, texts made one source on
 * 2026-11-24): every number the server or the approved policy sets is said
 * in every language */
const RULES: { badge: string; text: string; numbers: string[] }[] = [
  {
    badge: "community_builder",
    text: "Automatic when a server you own reaches 100 genuine human members; it stays if the server gets smaller.",
    numbers: ["100"],
  },
  {
    badge: "community_builder",
    text: "Bots, deleted, banned or suspended accounts, accounts under 7 days old or without a confirmed e-mail, and people who joined less than a day ago don't count. Counted a few times a day.",
    numbers: ["7"],
  },
  {
    badge: "big_community",
    text: "Automatic when a server you own reaches 1,000 genuine human members, counted as for Community Builder; it stays if the server gets smaller.",
    numbers: ["1"],
  },
  {
    badge: "super_creator",
    text: "Hold Creator, with at least 25 approved, original, published designs and 180 days in the creator program.",
    numbers: ["25", "180"],
  },
  {
    badge: "beta_veteran",
    text: "Completed a beta cycle with at least 3 reviewed feedback reports or 1 confirmed bug report; the team approves it after the cycle.",
    numbers: [],
  },
  {
    badge: "creator",
    text: "Accepted into the Zrzur Designs creator program, with a first original, approved, published design.",
    numbers: [],
  },
  {
    badge: "partner",
    text: "By application, reviewed by the Zrzur team: at least 5,000 genuine human members, a server at least 180 days old and steady weekly activity.",
    numbers: ["5", "180"],
  },
  {
    badge: "server_verified",
    text: "By application, reviewed by the Zrzur team: at least 10,000 genuine human members, 180 days, and proven ownership of the official website (DNS or website check).",
    numbers: ["10", "180", "DNS"],
  },
  {
    badge: "verified_bot_developer",
    text: "By application, reviewed by the Zrzur team: open to every bot, whatever its size; the team looks at its servers, its age and what it does.",
    numbers: [],
  },
  {
    badge: "content_creator",
    text: "By application, reviewed by the Zrzur team: at least 100,000 real followers on one platform, 90 days of activity and regular original work.",
    numbers: ["100", "90"],
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

  it("has every badge text in Arabic and German", () => {
    const texts = [...source.matchAll(/[^\w]t`([^`]*)`/g)].map((m) => m[1]);
    expect(texts.length).toBeGreaterThan(100);
    for (const text of texts) {
      const id = text.replace(/"/g, '\\"');
      expect(ar.get(id), `ar: ${text}`).toMatch(/[؀-ۿ]/);
      expect(de.get(id), `de: ${text}`).toBeTruthy();
    }
  });

  it("writes Arabic marks the way every browser draws them", () => {
    // WebKit tore the tanween off the alif («يوماً») and drew the kasra of
    // «مختبِر» above the letter («مختبَر», a lab): the fathatan goes before
    // the alif («يومًا»), and «مختبر» needs no mark
    const texts = [...source.matchAll(/[^\w]t`([^`]*)`/g)].map((m) => m[1]);
    for (const text of texts) {
      const arabic = ar.get(text.replace(/"/g, '\\"')) ?? "";
      expect(arabic, text).not.toContain("اً");
      expect(arabic, text).not.toContain("مختبِر");
    }
  });

  it("no longer says the old rules", () => {
    // any bot can ask for verification (owner, 2026-11-27)
    expect(source).not.toContain("25 legitimate servers");
    expect(source).not.toContain("25 servers only unlock");
    expect(source).not.toContain("Own a verified server.");
    expect(source).not.toContain("Own a verified bot.");
    expect(source).not.toContain("Apply as a partner");
    expect(source).not.toContain("Built a server that reached 100 members.");
    expect(source).not.toContain(
      "Complete the beta as an active tester who sent feedback or a bug report.",
    );
    expect(source).not.toContain(
      "the Zrzur team picks Super Creators by hand.",
    );
  });
});
