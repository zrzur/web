import assert from "node:assert/strict";
import test from "node:test";

import {
  headTags,
  injectHead,
  pageMeta,
  roughCount,
  routeOf,
} from "../src/head.mjs";

const ORIGIN = "https://discover.zrzur.com";
const card = {
  _id: "01JC3V9X8Q2W5E7R4T6Y1Z0P9A",
  name: "ربع الحارة",
  description: "سهرات ألعاب كل خميس وجمعة.",
  member_count: 123,
  link: "rabea",
  language: "ar",
};

test("routes on the Discover site", () => {
  assert.deepEqual(routeOf("discover", "/"), { kind: "home" });
  assert.deepEqual(routeOf("discover", "/gaming"), {
    kind: "topic",
    id: "gaming",
  });
  assert.deepEqual(routeOf("discover", "/de"), { kind: "language", id: "de" });
  assert.deepEqual(routeOf("discover", "/rabea"), {
    kind: "server",
    slug: "rabea",
  });
  assert.deepEqual(routeOf("discover", "/servers/abc"), {
    kind: "server",
    slug: "abc",
  });
  assert.deepEqual(routeOf("discover", "/a/b/c"), { kind: "other" });
});

test("routes on the Designs site", () => {
  assert.deepEqual(routeOf("designs", "/look-night-glow"), {
    kind: "design",
    ref: { kind: "look", id: "night-glow" },
  });
  assert.equal(routeOf("designs", "/looks").kind, "other");
});

test("a server page has its own title, description, image and languages", () => {
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/rabea",
    lang: "ar",
    route: { kind: "server", slug: "rabea" },
    data: card,
  });
  assert.equal(meta.title, "ربع الحارة — اكتشف زرزور");
  assert.equal(meta.description, card.description);
  assert.equal(meta.canonical, `${ORIGIN}/rabea?hl=ar`);
  assert.equal(meta.image, `${ORIGIN}/og/server/rabea.png`);
  assert.equal(meta.dir, "rtl");
  assert.deepEqual(
    meta.alternates.map((a) => a.hreflang),
    ["ar", "en", "de", "x-default"],
  );
  assert.equal(meta.alternates.at(-1).href, `${ORIGIN}/rabea`);
});

test("no description: a short line with a rounded member count", () => {
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/rabea",
    lang: "de",
    route: { kind: "server", slug: "rabea" },
    data: { ...card, description: "" },
  });
  assert.match(meta.description, /etwa 100 Mitgliedern/);
});

test("a page that is not there says so to search engines", () => {
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/nothing",
    route: { kind: "server", slug: "nothing" },
    data: null,
  });
  assert.equal(meta.status, 404);
  assert.match(headTags(meta), /noindex/);
});

test("counts are never exact", () => {
  assert.equal(roughCount(7), "7");
  assert.equal(roughCount(123), "100");
  assert.equal(roughCount(3412), "3500");
});

test("the head goes into the page and text is escaped", () => {
  const html =
    '<!doctype html><html lang="en"><head><title>Zrzur</title><meta name="description" content="x"></head><body></body></html>';
  const meta = pageMeta({
    site: "discover",
    origin: ORIGIN,
    path: "/rabea",
    lang: "en",
    route: { kind: "server", slug: "rabea" },
    data: { ...card, name: 'A "quoted" <b>name</b>' },
  });
  const out = injectHead(html, meta);
  assert.match(out, /<html lang="en" dir="ltr">/);
  assert.match(
    out,
    /<title>A &quot;quoted&quot; &lt;b&gt;name&lt;\/b&gt; — Zrzur Discover<\/title>/,
  );
  assert.equal((out.match(/name="description"/g) ?? []).length, 1);
  assert.match(
    out,
    /og:image" content="https:\/\/discover\.zrzur\.com\/og\/server\/rabea\.png"/,
  );
  assert.doesNotMatch(out, /<b>name/);
});
