#!/usr/bin/env node
// RSS feed of the API changelog: one item per dated section of
// src/interface/developers/docs/content/changelog.md (the "coming" section
// has no date and is left out). The feed is a static file in public/, so
// it is served as it is, without the app and without a build step:
//
//   public/developers/api-changelog.xml  →  https://app.zrzur.com/developers/api-changelog.xml
//
// Usage (from web/packages/client): node scripts/bot-api/changelog-feed.mjs [--check]
// docs.test.ts fails when the committed feed is not what this script makes.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(
  here,
  "../../src/interface/developers/docs/content/changelog.md",
);
export const FEED = resolve(here, "../../public/developers/api-changelog.xml");
const SITE = "https://app.zrzur.com";
const PAGE = `${SITE}/developers/docs/changelog`;

const escape = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Markdown of a section as plain text: no link targets, no backticks */
const plain = (markdown) =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

/** The feed for a changelog page */
export function feedFrom(markdown) {
  const items = [];
  for (const section of markdown.split(/^## /m).slice(1)) {
    const [heading, ...body] = section.split("\n");
    const date = /(\d{4}-\d{2}-\d{2})/.exec(heading)?.[1];
    const anchor = /\{#([a-z0-9-]+)\}/.exec(heading)?.[1];
    if (!date || !anchor) continue;
    const title = heading.replace(/\s*\{#[^}]+\}\s*$/, "").trim();
    const published = new Date(`${date}T12:00:00Z`).toUTCString();
    items.push(
      [
        "    <item>",
        `      <title>${escape(title)}</title>`,
        `      <link>${PAGE}#${anchor}</link>`,
        `      <guid isPermaLink="true">${PAGE}#${anchor}</guid>`,
        `      <pubDate>${published}</pubDate>`,
        `      <description>${escape(plain(body.join("\n")))}</description>`,
        "    </item>",
      ].join("\n"),
    );
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>Zrzur API changelog</title>",
    `    <link>${PAGE}</link>`,
    "    <description>Changes to the Zrzur Bot API and its documentation.</description>",
    "    <language>en</language>",
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const feed = feedFrom(readFileSync(SOURCE, "utf8"));
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(FEED, "utf8");
    } catch {
      // missing counts as out of date
    }
    if (current !== feed) {
      console.error(
        "api-changelog.xml is out of date: run node scripts/bot-api/changelog-feed.mjs",
      );
      process.exit(1);
    }
    console.log("api-changelog.xml is up to date");
  } else {
    mkdirSync(join(FEED, ".."), { recursive: true });
    writeFileSync(FEED, feed);
    console.log(`wrote ${FEED}`);
  }
}
