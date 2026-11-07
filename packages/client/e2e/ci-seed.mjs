// Creates throwaway accounts for one e2e run in CI, against the run's own
// empty stack. The passwords are made here and die with the run.
// Env: E2E_API, MAILDEV_URL, ZRZUR_DEV_ACCOUNTS (file to write), SEED_COUNT.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const API = process.env.E2E_API ?? "http://127.0.0.1:14702";
const MAIL = process.env.MAILDEV_URL ?? "http://127.0.0.1:14080";
const OUT = process.env.ZRZUR_DEV_ACCOUNTS;
const COUNT = Number(process.env.SEED_COUNT ?? 3);
if (!OUT) throw new Error("ZRZUR_DEV_ACCOUNTS is not set");

async function post(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function verifyCode(email) {
  for (let i = 0; i < 30; i++) {
    const mail = await fetch(`${MAIL}/email`).then((r) => r.json());
    const hit = mail.findLast((m) => m.to?.some((t) => t.address === email));
    const code = /verify\/([\w-]+)/.exec(hit?.text ?? hit?.html ?? "")?.[1];
    if (code) return code;
    await new Promise((done) => setTimeout(done, 1000));
  }
  return null; // the stack may not ask for verification
}

const accounts = [];
for (let i = 0; i < COUNT; i++) {
  const email = `ci-${i}-${randomBytes(4).toString("hex")}@zrzur.test`;
  const password = randomBytes(18).toString("base64url");
  await post("/auth/account/create", {
    email,
    password,
    birth_month: "2000-01",
  });
  const code = await verifyCode(email);
  if (code) await post(`/auth/account/verify/${code}`, {});
  const session = await post("/auth/session/login", {
    email,
    password,
    friendly_name: "ci seed",
  });
  await fetch(`${API}/onboard/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": session.token,
    },
    body: JSON.stringify({ username: `ci${i}${randomBytes(3).toString("hex")}` }),
  });
  await fetch(`${API}/auth/session/logout`, {
    method: "POST",
    headers: { "X-Session-Token": session.token },
  });
  accounts.push({ email, password });
}
writeFileSync(OUT, JSON.stringify({ accounts }));
console.log(`seeded ${accounts.length} accounts`);
