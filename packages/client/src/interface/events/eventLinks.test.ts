import { describe, expect, it } from "vitest";

import {
  eventIcs,
  icsFileName,
  invitationLink,
  isInvitationCode,
  isSharePath,
  linkBase,
  reminderSpan,
  shareLink,
} from "./eventLinks";

const event = {
  _id: "01EVENT",
  title: "Quiz, night; one",
  description: "Bring snacks\nand a friend",
  starts_at: "2026-11-20T18:00:00.000Z",
  ends_at: "2026-11-20T20:30:00.000Z",
  status: "Scheduled" as const,
};
const NOW = new Date("2026-11-19T10:00:00Z");

describe("links of an event", () => {
  it("builds on the invite origin, and on the app without one", () => {
    expect(linkBase("https://app.example/", "https://zrzur.cc/")).toBe(
      "https://zrzur.cc",
    );
    expect(linkBase("https://app.example/", "")).toBe("https://app.example");
    expect(linkBase("https://app.example", "not a url")).toBe(
      "https://app.example",
    );
    expect(linkBase("https://app.example", "javascript:alert(1)")).toBe(
      "https://app.example",
    );
  });

  it("puts the name before the code", () => {
    expect(
      shareLink("https://zrzur.cc", { code: "k7m2x9pq", name: "quiz-night" }),
    ).toBe("https://zrzur.cc/e/quiz-night-k7m2x9pq");
    expect(shareLink("https://zrzur.cc", { code: "k7m2x9pq" })).toBe(
      "https://zrzur.cc/e/k7m2x9pq",
    );
    expect(invitationLink("https://zrzur.cc", "k7m2x9pqk7m2x9pq")).toBe(
      "https://zrzur.cc/e/join/k7m2x9pqk7m2x9pq",
    );
  });

  it("knows a path that can be a link from one that cannot", () => {
    expect(isSharePath("quiz-night-k7m2x9pq")).toBe(true);
    expect(isSharePath("k7m2x9pq")).toBe(true);
    expect(isSharePath("ليلة-الألعاب-k7m2x9pq")).toBe(true);
    expect(isSharePath("quiz-night")).toBe(false);
    expect(isSharePath("k7m2x9pa")).toBe(false); // a vowel is never in a code
    expect(isSharePath("")).toBe(false);
    expect(isInvitationCode("k7m2x9pqk7m2x9pq")).toBe(true);
    expect(isInvitationCode("k7m2x9pq")).toBe(false);
    expect(isInvitationCode("../../k7m2x9pqk7")).toBe(false);
  });

  it("names a reminder's span in the person's language", () => {
    expect(reminderSpan(15, "en")).toBe("15 minutes");
    expect(reminderSpan(60, "en")).toBe("1 hour");
    expect(reminderSpan(1440, "en")).toBe("1 day");
    expect(reminderSpan(10080, "de")).toBe("7 Tage");
  });
});

describe("the calendar file of an event", () => {
  it("has the times in UTC, the escaped texts and the link", () => {
    const ics = eventIcs(event, "Voice: Lounge", "https://zrzur.cc/e/x", NOW);
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("UID:01EVENT@zrzur");
    expect(lines).toContain("DTSTAMP:20261119T100000Z");
    expect(lines).toContain("DTSTART:20261120T180000Z");
    expect(lines).toContain("DTEND:20261120T203000Z");
    expect(lines).toContain("SUMMARY:Quiz\\, night\\; one");
    expect(lines).toContain(
      "DESCRIPTION:Bring snacks\\nand a friend\\n\\nhttps://zrzur.cc/e/x",
    );
    expect(lines).toContain("LOCATION:Voice: Lounge");
    expect(lines).toContain("URL:https://zrzur.cc/e/x");
    expect(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toContain("RRULE");
  });

  it("gives an event without an end one hour", () => {
    const ics = eventIcs({ ...event, ends_at: undefined }, undefined, "u", NOW);
    expect(ics).toContain("DTEND:20261120T190000Z");
    expect(ics).not.toContain("LOCATION");
  });

  it("keeps a repeating event at its local time", () => {
    const ics = eventIcs(
      { ...event, repeat: "EveryTwoWeeks" as const, time_zone: "Europe/Vienna" },
      undefined,
      "u",
      NOW,
    );
    expect(ics).toContain("DTSTART;TZID=Europe/Vienna:20261120T190000");
    expect(ics).toContain("DTEND;TZID=Europe/Vienna:20261120T213000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2");
    // an unknown zone falls back to UTC, the rule stays
    const utc = eventIcs(
      { ...event, repeat: "Daily" as const, time_zone: "Mars/Olympus" },
      undefined,
      "u",
      NOW,
    );
    expect(utc).toContain("DTSTART:20261120T180000Z");
    expect(utc).toContain("RRULE:FREQ=DAILY");
  });

  it("marks a called-off event and folds long lines", () => {
    const ics = eventIcs(
      { ...event, status: "Cancelled" as const, title: "ليلة ".repeat(30) },
      undefined,
      "u",
      NOW,
    );
    expect(ics).toContain("STATUS:CANCELLED");
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n"))
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
  });

  it("names the file safely", () => {
    expect(icsFileName('Quiz: "night" / one')).toBe("Quiz-night-one.ics");
    expect(icsFileName("ليلة الألعاب")).toBe("ليلة-الألعاب.ics");
    expect(icsFileName("///")).toBe("event.ics");
  });
});
