// Seeds a stack for the mobile-polish runs (idempotent). Seeded accounts only.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { api, seededAccounts, token } from "./lib/stack.mjs";

/** Ids of the seeded server, outside the repository, per account */
const stateFile = (account) =>
  join(
    tmpdir(),
    `zrzur-mobile-polish-${createHash("sha256").update(account.email).digest("hex").slice(0, 12)}.json`,
  );

/** POST a message, waiting out the rate limit */
async function say(t, channel, content) {
  for (let i = 0; i < 20; i++) {
    try {
      return await api(t, "POST", `/channels/${channel}/messages`, { content });
    } catch (e) {
      const m = String(e.message).match(/429 .*"retry_after":(\d+)/);
      if (!m) throw e;
      await new Promise((r) => setTimeout(r, Number(m[1]) + 200));
    }
  }
  throw new Error("rate limited");
}

export async function seed() {
  const [a, b] = seededAccounts(2);
  const STATE = stateFile(a);
  const ta = await token(a);
  const tb = await token(b);
  const meA = await api(ta, "GET", "/users/@me");
  const meB = await api(tb, "GET", "/users/@me");

  // friendship + DM
  try {
    await api(
      ta,
      "PUT",
      `/users/${meB.username}%23${meB.discriminator}/friend`,
    );
  } catch {
    // already friends
  }
  try {
    await api(tb, "PUT", `/users/${meA._id}/friend`);
  } catch {
    // already friends
  }
  const dm = await api(ta, "GET", `/users/${meB._id}/dm`);

  const state = existsSync(STATE)
    ? JSON.parse(readFileSync(STATE, "utf8"))
    : {};
  if (!state.serverId) {
    const created = await api(ta, "POST", "/servers/create", {
      name: "Mobile Polish",
    });
    state.serverId = created.server._id;
    state.textId = created.channels[0]._id;
    state.voiceId = (
      await api(ta, "POST", `/servers/${state.serverId}/channels`, {
        type: "Voice",
        name: "Voice",
      })
    )._id;
    state.secondId = (
      await api(ta, "POST", `/servers/${state.serverId}/channels`, {
        type: "Text",
        name: "random",
      })
    )._id;
    writeFileSync(STATE, JSON.stringify(state));
  }
  if (!state.messages) {
    const lines = [
      "Welcome to the phone test server",
      "مرحباً بكم في سيرفر الاختبار على الهاتف، هذه رسالة طويلة قليلاً لنرى كيف تلتف الأسطر في الاتجاه من اليمين إلى اليسار",
      "Eine lange deutsche Nachricht: Donaudampfschifffahrtsgesellschaftskapitaensmuetze passt hoffentlich in die Zeile",
      "https://example.com/some/very/long/link/that/should/not/break/the/layout/at/all/even/if/it/is/long",
      "**bold** _italic_ `code` and a list\n- one\n- two",
      "Another message with an emoji 😀 and a reply target",
    ];
    for (const content of lines) await say(ta, state.textId, content);
    for (let i = 0; i < 20; i++)
      await say(ta, state.textId, `Filler message ${i + 1}`);
    await say(ta, dm._id, "Hello from the DM");
    state.messages = true;
    writeFileSync(STATE, JSON.stringify(state));
  }
  // the second test account joins as a plain member (no permissions)
  if (!state.bJoined) {
    try {
      const invite = await api(ta, "POST", `/channels/${state.textId}/invites`);
      await api(tb, "POST", `/invites/${invite._id}`);
    } catch (error) {
      if (!/AlreadyInServer|already/i.test(String(error.message))) throw error;
    }
    state.bJoined = true;
    writeFileSync(STATE, JSON.stringify(state));
  }
  // a quiet channel the runner never writes to: stable rows for tap and long-press tests
  if (!state.targets) {
    for (let i = 1; i <= 8; i++)
      await say(ta, state.secondId, `Target message ${i}`);
    state.targets = true;
    writeFileSync(STATE, JSON.stringify(state));
  }
  return { ...state, dmId: dm._id, a, b, meA, meB };
}
