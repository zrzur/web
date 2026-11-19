import assert from "node:assert/strict";
import test from "node:test";

import { headTags } from "../src/head.mjs";
import {
  inviteCard,
  inviteCode,
  inviteImageCode,
  inviteMeta,
  roughMembers,
} from "../src/invite.mjs";

const server = {
  type: "Server",
  code: "game-nights",
  server_id: "01SERVER",
  server_name: "Game Nights",
  server_description: "We play **every evening**: races and quiz nights.",
  server_icon: { _id: "icon", tag: "icons" },
  server_banner: { _id: "banner", tag: "banners" },
  channel_id: "01CHANNEL",
  channel_name: "general",
  user_name: "samer",
  user_avatar: { _id: "avatar", tag: "avatars" },
  member_count: 1284,
};

test("reads the code of an invite path and nothing else", () => {
  assert.equal(inviteCode("/invite/abc123"), "abc123");
  assert.equal(inviteCode("/invite/game-nights/"), "game-nights");
  for (const path of [
    "/invite/",
    "/invite/a/b",
    "/invite/a_b",
    "/invite/-a",
    "/invite/a--b",
    "/invite/%2e%2e",
    `/invite/${"a".repeat(65)}`,
    "/login",
    "/",
  ])
    assert.equal(inviteCode(path), undefined, path);
});

test("reads the code of a preview image path", () => {
  assert.equal(inviteImageCode("/og/invite/game-nights.png"), "game-nights");
  assert.equal(inviteImageCode("/og/invite/../x.png"), undefined);
  assert.equal(inviteImageCode("/og/server/x.png"), undefined);
});

test("the preview names the server and never the person who invited", () => {
  const meta = inviteMeta({
    origin: "https://app.zrzur.com",
    code: "game-nights",
    data: server,
  });
  assert.equal(meta.title, "Join Game Nights on Zrzur");
  assert.equal(
    meta.description,
    "1.2k+ members · We play every evening: races and quiz nights.",
  );
  assert.equal(meta.canonical, "https://app.zrzur.com/invite/game-nights");
  assert.equal(meta.image, "https://app.zrzur.com/og/invite/game-nights.png");
  const tags = headTags(meta);
  assert.ok(!tags.includes("samer"));
  assert.ok(!tags.includes("avatar"));
  assert.ok(!tags.includes("general"));
});

test("every invite page is kept out of search engines", () => {
  for (const data of [server, null]) {
    const tags = headTags(
      inviteMeta({ origin: "https://app.zrzur.com", code: "x", data }),
    );
    assert.ok(tags.includes('<meta name="robots" content="noindex">'));
  }
});

test("a server with an Arabic name gets an Arabic preview", () => {
  const meta = inviteMeta({
    origin: "https://app.zrzur.com",
    code: "x",
    data: { ...server, server_name: "ليالي الألعاب", server_description: "" },
  });
  assert.equal(meta.lang, "ar");
  assert.equal(meta.dir, "rtl");
  assert.equal(meta.title, "انضم إلى ليالي الألعاب في زرزور");
  assert.ok(meta.description.startsWith("الأعضاء: 1.2k+"));
});

test("?hl= wins over the name's script", () => {
  const meta = inviteMeta({
    origin: "https://app.zrzur.com",
    code: "x",
    lang: "de",
    data: server,
  });
  assert.equal(meta.lang, "de");
  assert.equal(meta.title, "Tritt Game Nights auf Zrzur bei");
});

test("a dead link says so, with the general picture", () => {
  const meta = inviteMeta({
    origin: "https://app.zrzur.com",
    code: "gone",
    data: null,
  });
  assert.equal(meta.title, "This invite link has ended");
  assert.equal(meta.image, "https://app.zrzur.com/og/site.png");
  assert.equal(meta.status, 200);
});

test("a group invite has no server preview", () => {
  assert.equal(inviteCard({ type: "Group", channel_name: "friends" }), null);
  const meta = inviteMeta({
    origin: "https://app.zrzur.com",
    code: "x",
    data: { type: "Group", channel_name: "friends", user_name: "samer" },
  });
  assert.ok(!headTags(meta).includes("friends"));
});

test("a mature server gives its name only", () => {
  const card = inviteCard({ ...server, server_nsfw: true });
  assert.equal(card.name, "Game Nights");
  assert.equal(card.description, "");
  assert.equal(card.icon, undefined);
  assert.equal(card.banner, undefined);
});

test("markup in a name cannot leave its attribute", () => {
  const tags = headTags(
    inviteMeta({
      origin: "https://app.zrzur.com",
      code: "x",
      data: { ...server, server_name: '"><script>alert(1)</script>' },
    }),
  );
  assert.ok(!tags.includes("<script>alert"));
});

test("member counts are exact when small and rounded when large", () => {
  assert.equal(roughMembers(0), "0");
  assert.equal(roughMembers(41), "41");
  assert.equal(roughMembers(128), "120+");
  assert.equal(roughMembers(1000), "1k+");
  assert.equal(roughMembers(1284), "1.2k+");
  assert.equal(roughMembers(-5), "0");
  assert.equal(roughMembers(undefined), "0");
});
