// One bot for a whole run: accounts may only create a few bots a week, so the
// scripts share it. Owned by the second seeded account. Its token lives in a
// file outside the repository and the results folder (E2E_BOT_FILE) and dies
// with the throwaway stack.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { call, seededAccounts, session } from "./stack.mjs";

/** Returns { id, token, ownerHeaders } */
export async function testBot() {
  const owner = seededAccounts(2)[1];
  const ownerHeaders = await session(owner);
  // one file per owner: a bot from another stack's accounts is never reused
  const name = createHash("sha256")
    .update(owner.email)
    .digest("hex")
    .slice(0, 12);
  const file =
    process.env.E2E_BOT_FILE ?? join(tmpdir(), `zrzur-e2e-bot-${name}.json`);
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    const check = await call("GET", "/users/@me", undefined, {
      "x-bot-token": saved.token,
    });
    if (check.status === 200) return { ...saved, ownerHeaders };
  }
  const made = await call(
    "POST",
    "/bots/create",
    { name: `e2ebot${randomBytes(3).toString("hex")}` },
    ownerHeaders,
  );
  if (made.status !== 200) throw new Error(`test bot: ${made.status}`);
  // public, so the other seeded account can add it to its servers
  await call("PATCH", `/bots/${made.json._id}`, { public: true }, ownerHeaders);
  const saved = { id: made.json._id, token: made.json.token };
  writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
  return { ...saved, ownerHeaders };
}

/** Adds the test bot to a server the given user manages */
export const addTestBot = (bot, serverId, userHeaders) =>
  call("POST", `/bots/${bot.id}/invite`, { server: serverId }, userHeaders);
