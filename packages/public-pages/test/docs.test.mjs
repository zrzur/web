import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  docsBlock,
  docsMeta,
  docsRoute,
  docsSitemap,
  injectDocs,
} from "../src/docs.mjs";
import { headTags } from "../src/head.mjs";

const words = (site) => ({
  site,
  about: `${site} about`,
  contents: "Contents",
});
const page = (title) => ({
  title,
  description: `${title} in one line`,
  sections: [],
});
const index = {
  languages: ["en", "de", "ar"],
  words: {
    en: words("Zrzur Developers"),
    de: words("Zrzur Developers"),
    ar: words("مطوّرو زرزور"),
  },
  pages: [
    { id: "overview", group: "start" },
    { id: "gateway", group: "guides" },
  ],
  text: {
    en: { overview: page("Zrzur Bot API"), gateway: page("Gateway") },
    de: { overview: page("Zrzur-Bot-API"), gateway: page("Gateway") },
    ar: { overview: page("واجهة بوتات زرزور"), gateway: page("البوابة") },
  },
};
const origin = "https://developers.zrzur.com";

test("the front page is the overview; the overview has one address", () => {
  assert.deepEqual(docsRoute(index, "/"), {
    kind: "page",
    id: "overview",
    home: true,
  });
  assert.deepEqual(docsRoute(index, "/overview"), { kind: "moved", to: "/" });
  assert.deepEqual(docsRoute(index, "/gateway"), {
    kind: "page",
    id: "gateway",
    home: false,
  });
});

test("addresses copied from inside the app lose /developers/docs", () => {
  assert.deepEqual(docsRoute(index, "/developers/docs/gateway"), {
    kind: "moved",
    to: "/gateway",
  });
  assert.deepEqual(docsRoute(index, "/developers/docs"), {
    kind: "moved",
    to: "/",
  });
  assert.deepEqual(docsRoute(index, "/gateway/"), {
    kind: "moved",
    to: "/gateway",
  });
});

test("an address with no page is missing, never the front page", () => {
  for (const path of [
    "/nothing",
    "/gateway/extra",
    "/login",
    "/GATEWAY",
    "/developers",
  ])
    assert.equal(docsRoute(index, path).kind, "missing", path);
  const meta = docsMeta({ index, origin, route: { kind: "missing" } });
  assert.equal(meta.status, 404);
  assert.match(headTags(meta), /name="robots" content="noindex"/);
});

test("a page's head: own title and description, canonical, three languages", () => {
  const meta = docsMeta({ index, origin, route: docsRoute(index, "/gateway") });
  assert.equal(meta.title, "Gateway · Zrzur Developers");
  assert.equal(meta.description, "Gateway in one line");
  assert.equal(meta.canonical, `${origin}/gateway`);
  assert.equal(meta.lang, "en");
  assert.deepEqual(
    meta.alternates.map((alt) => [alt.hreflang, alt.href]),
    [
      ["en", `${origin}/gateway?hl=en`],
      ["de", `${origin}/gateway?hl=de`],
      ["ar", `${origin}/gateway?hl=ar`],
      ["x-default", `${origin}/gateway`],
    ],
  );
  const tags = headTags(meta);
  assert.match(tags, /"@type":"TechArticle"/);
  assert.match(tags, /"@type":"BreadcrumbList"/);
});

test("Arabic is asked with ?hl=ar: right to left, its own words and address", () => {
  const meta = docsMeta({
    index,
    origin,
    route: docsRoute(index, "/gateway"),
    lang: "ar",
  });
  assert.equal(meta.lang, "ar");
  assert.equal(meta.dir, "rtl");
  assert.equal(meta.title, "البوابة · مطوّرو زرزور");
  assert.equal(meta.canonical, `${origin}/gateway?hl=ar`);
  assert.equal(meta.locale, "ar_AR");
});

test("a language the pages are not written in reads English", () => {
  const meta = docsMeta({
    index,
    origin,
    route: docsRoute(index, "/gateway"),
    lang: "fr",
  });
  assert.equal(meta.lang, "en");
  assert.equal(meta.canonical, `${origin}/gateway`);
});

test("the front page describes the site", () => {
  const meta = docsMeta({ index, origin, route: docsRoute(index, "/") });
  assert.equal(meta.canonical, `${origin}/`);
  assert.equal(meta.description, "Zrzur Developers about");
  assert.equal(meta.type, "website");
});

test("the plain page goes before the app root, with every page linked", () => {
  const route = docsRoute(index, "/gateway");
  const block = docsBlock({
    index,
    route,
    lang: "de",
    body: "<h1>Gateway</h1><p>$1 costs $&</p>",
  });
  const html = injectDocs(
    '<html><head></head><body><div id="root"></div></body></html>',
    block,
  );
  assert.match(html, /<div id="docs-static">[\s\S]*<div id="root"><\/div>/);
  // `$` in page text is text, not a replacement pattern
  assert.match(html, /\$1 costs \$&/);
  assert.match(html, /<a href="\/\?hl=de">Zrzur-Bot-API<\/a>/);
  assert.match(
    html,
    /<a href="\/gateway\?hl=de" aria-current="page">Gateway<\/a>/,
  );
  assert.match(html, /<style>#docs-static/);
});

test("page text is escaped in the list of pages", () => {
  const odd = structuredClone(index);
  odd.text.en.gateway.title = '<script>alert("x")</script>';
  const block = docsBlock({ index: odd, route: docsRoute(odd, "/"), body: "" });
  assert.doesNotMatch(block, /<script>/);
});

test("the sitemap lists every page once, with its three languages", () => {
  const xml = docsSitemap(index, origin);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [`${origin}/`, `${origin}/gateway`]);
  assert.equal([...xml.matchAll(/hreflang="ar"/g)].length, 2);
  assert.equal([...xml.matchAll(/hreflang="x-default"/g)].length, 2);
});

test("the server answers documentation addresses: page, move, missing, sitemap", async () => {
  const root = mkdtempSync(join(tmpdir(), "pp-docs-"));
  const dist = join(root, "dist");
  for (const language of index.languages) {
    mkdirSync(join(dist, "docs-pages", language), { recursive: true });
    for (const { id } of index.pages)
      writeFileSync(
        join(dist, "docs-pages", language, `${id}.html`),
        `<h1>${index.text[language][id].title}</h1>`,
      );
  }
  mkdirSync(join(dist, "developers"), { recursive: true });
  writeFileSync(join(dist, "developers", "api-changelog.xml"), "<rss/>");
  writeFileSync(join(dist, "docs-pages", "index.json"), JSON.stringify(index));
  writeFileSync(
    join(dist, "index.html"),
    '<!doctype html><html lang="en"><head><title>App</title><meta name="description" content="app"></head><body><div id="root"></div></body></html>',
  );
  Object.assign(process.env, {
    SITE: "docs",
    DIST: dist,
    PUBLIC_ORIGIN: origin,
  });
  // its own copy of the module: the other test file loads it as Discover
  const { handle } = await import("../src/server.mjs?docs");
  const get = async (url) => {
    const res = {
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(body) {
        this.body = body === undefined ? "" : String(body);
      },
    };
    await handle({ url }, res);
    return res;
  };

  const pageAnswer = await get("/gateway?hl=ar");
  assert.equal(pageAnswer.status, 200);
  assert.match(pageAnswer.body, /<html lang="ar" dir="rtl">/);
  assert.match(pageAnswer.body, /<title>البوابة · مطوّرو زرزور<\/title>/);
  assert.match(
    pageAnswer.body,
    /<link rel="canonical" href="https:\/\/developers\.zrzur\.com\/gateway\?hl=ar">/,
  );
  assert.match(pageAnswer.body, /<div id="docs-static">.*<h1>البوابة<\/h1>/s);
  assert.equal(pageAnswer.headers["Content-Language"], "ar");
  assert.ok(pageAnswer.headers["Content-Security-Policy"]);

  const home = await get("/");
  assert.equal(home.status, 200);
  assert.match(home.body, /<h1>Zrzur Bot API<\/h1>/);

  const moved = await get("/developers/docs/gateway?hl=de");
  assert.equal(moved.status, 301);
  assert.equal(moved.headers.Location, "/gateway?hl=de");

  const missing = await get("/no-such-page");
  assert.equal(missing.status, 404);
  assert.match(missing.body, /noindex/);

  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(
    sitemap.body,
    /<loc>https:\/\/developers\.zrzur\.com\/gateway<\/loc>/,
  );

  const robots = await get("/robots.txt");
  assert.match(
    robots.body,
    /Sitemap: https:\/\/developers\.zrzur\.com\/sitemap\.xml/,
  );

  const feed = await get("/api-changelog.xml");
  assert.equal(feed.status, 200);
  assert.equal(feed.body, "<rss/>");
});
