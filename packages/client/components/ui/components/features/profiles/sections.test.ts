import { describe, expect, it } from "vitest";

import {
  linkDomain,
  linkName,
  linkProblem,
  moveRow,
  PROFILE_SECTIONS,
  profileLinkUrl,
  rowsToProfile,
  safeProfileLinks,
  sectionRows,
  siteAddress,
  visibleSections,
} from "./sections";

describe("links", () => {
  it("names what is wrong before anything is sent", () => {
    expect(linkProblem("http://127.0.0.1")).toBe("https");
    expect(linkProblem("example.org")).toBe("https");
    expect(linkProblem("https://127.0.0.1")).toBe("address");
    expect(linkProblem("https://localhost/x")).toBe("address");
    expect(linkProblem("https://example.org/a b")).toBe("address");
    expect(linkProblem("https://example.org/path")).toBeUndefined();
    expect(linkProblem("   ")).toBeUndefined();
  });
});

describe("link names", () => {
  const name = (link: string) => linkName(new URL(link));

  it("gives a site that reads like a known one its full domain", () => {
    expect(name("https://instagram.xyz/")).toBe("instagram.xyz");
    expect(name("https://x.com.co/")).toBe("x.com.co");
    expect(name("https://www.youtube.net/a")).toBe("youtube.net");
    expect(name("https://romance.rip/nt")).toBe("Romance");
  });

  it("names known sites", () => {
    expect(name("https://www.youtube.com/@me")).toBe("YouTube");
    expect(name("https://m.tiktok.com/@me")).toBe("TikTok");
    expect(name("https://twitter.com/me")).toBe("X");
  });

  it("never lends a known name to another site", () => {
    expect(name("https://youtube.com.evil.org/x")).toBe("Evil");
    expect(name("https://notgithub.com/")).toBe("Notgithub");
  });

  it("shows the site alone, without subdomain or path", () => {
    expect(name("https://mail.google.com/x")).toBe("Google");
    expect(name("https://ko-fi.com/zrzur")).toBe("Ko-fi");
    expect(name("https://romance.rip/nt")).toBe("Romance");
    expect(name("https://www.example.org/")).toBe("Example");
  });

  it("keeps the name under a shared ending", () => {
    expect(name("https://shop.example.co.uk/a")).toBe("Example");
    expect(linkDomain(new URL("https://www.youtube.com/x"))).toBe(
      "youtube.com",
    );
  });
});

describe("profile sections", () => {
  it("keeps the default order for a profile that never chose", () => {
    expect(sectionRows().map((row) => row.id)).toEqual([...PROFILE_SECTIONS]);
    expect(sectionRows().every((row) => row.shown)).toBe(true);
  });

  it("keeps the chosen order and marks hidden rows", () => {
    const rows = sectionRows(["links", "about"], ["wearing"]);
    expect(rows.slice(0, 2).map((row) => row.id)).toEqual(["links", "about"]);
    expect(rows.find((row) => row.id === "wearing")?.shown).toBe(false);
    expect(rows).toHaveLength(PROFILE_SECTIONS.length);
  });

  it("has no Interests section", () => {
    expect(PROFILE_SECTIONS).not.toContain("interests");
    expect(sectionRows(["interests", "about"]).map((row) => row.id)).toEqual([
      "about",
      "links",
      "creations",
      "wearing",
      "member_since",
    ]);
  });

  it("keeps Member since first when a person put it there", () => {
    const rows = sectionRows();
    const chosen = [rows[4], ...rows.slice(0, 4)];
    const { sections } = rowsToProfile(chosen);
    expect(visibleSections(sections)[0]).toBe("member_since");
    expect(sectionRows(sections)[0].id).toBe("member_since");
  });

  it("keeps an order saved before the card changed", () => {
    expect(
      visibleSections(["about", "member_since", "links", "interests"]),
    ).toEqual(["about", "member_since", "links"]);
  });

  it("keeps Interests hidden for someone who hid it", () => {
    const rows = sectionRows(["about"], ["interests", "links"]);
    const saved = rowsToProfile(rows, ["interests", "links"]);
    expect(saved.hidden_sections).toContain("interests");
    expect(saved.hidden_sections).toContain("links");
    // the API refuses a section both shown and hidden
    expect(saved.sections).not.toContain("interests");
  });

  it("turns rows into what the API takes", () => {
    const rows = sectionRows(["links"], ["about"]);
    const { sections, hidden_sections } = rowsToProfile(rows);
    expect(sections[0]).toBe("links");
    expect(hidden_sections).toEqual(["about"]);
    expect(sections).not.toContain("about");
  });

  it("moves a row by one and stops at the ends", () => {
    const rows = sectionRows();
    expect(moveRow(rows, 1, -1)[0].id).toBe("links");
    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(moveRow(rows, rows.length - 1, 1)).toBe(rows);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "http://example.com/",
    "file:///etc/passwd",
    "https://user:pw@example.com/",
    "not a link",
    "",
    null,
    42,
  ])("never shows the saved value %s", (value) => {
    expect(profileLinkUrl(value)).toBeUndefined();
  });

  it("skips bad saved links and keeps the good ones", () => {
    const links = safeProfileLinks([
      "javascript:alert(1)",
      "https://example.com/me",
      "%%%",
    ]);
    expect(links.map((url) => url.hostname)).toEqual(["example.com"]);
    expect(safeProfileLinks(undefined)).toEqual([]);
  });

  it("drops section ids it does not know", () => {
    expect(visibleSections(["crown", "about"])).toEqual(["about"]);
    expect(visibleSections(undefined)).toEqual([...PROFILE_SECTIONS]);
    expect(visibleSections([])).toEqual([]);
  });

  it("shows the real site, whatever the rest of the address says", () => {
    expect(siteAddress("https://example.com/paypal.com")).toBe("example.com");
    expect(siteAddress("https://xn--pypal-4ve.com/")).toBe("xn--pypal-4ve.com");
  });
});
