// Custom invite link API checks, seeded accounts 1 (owner) and 2 (member). Needs a
// stack with `features.billing` on and the test payment provider: nothing is
// charged. Own servers, deleted at the end. Takes minutes: the level sync runs
// every 60 s. No browser, so no language or size.
import {
  call,
  closeSessions,
  deleteServer,
  seededAccounts,
  sleep,
  token,
} from "./lib/stack.mjs";

const [ownerAccount, memberAccount] = seededAccounts(2);
const accounts = { a: ownerAccount, b: memberAccount };
const results = [];
const record = (name, ok, detail = "") => {
  results.push({ area: "api", name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
/** { status, data } for a call as the given session */
const rest = async (method, path, body, sessionToken) => {
  const { status, json } = await call(method, path, body, sessionToken ? { "x-session-token": sessionToken } : {});
  return { status, data: json };
};
const ok = (r) => r.status >= 200 && r.status < 300;
async function login(account) {
  const sessionToken = await token(account);
  const me = await rest("GET", "/users/@me", undefined, sessionToken);
  return { token: sessionToken, user: me.data._id };
}
const key = () => `vanity-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Wait until the server reaches `want` (the level sync runs every 60 s) */
async function waitLevel(serverId, token, want, cmp = (a, b) => a >= b) {
  for (let i = 0; i < 30; i++) {
    const level = (await rest("GET", `/servers/${serverId}`, undefined, token)).data?.supercharge?.level ?? 0;
    if (cmp(level, want)) return level;
    await sleep(5000);
  }
  return (await rest("GET", `/servers/${serverId}`, undefined, token)).data?.supercharge?.level ?? 0;
}

const A = await login(accounts.a);
const B = await login(accounts.b);
const plans = (await rest("GET", "/billing/plans", undefined, A.token)).data;
const vanityLevel = plans?.levels?.find((l) => l.vanity_invite);
record("plans: a level is flagged for the custom link", !!vanityLevel, vanityLevel ? `level ${vanityLevel.level}, ${vanityLevel.supercharges} Wings` : JSON.stringify(plans?.levels?.map((l) => l.level)));

const server = (await rest("POST", "/servers/create", { name: "Vanity functional test" }, A.token)).data.server;
const other = (await rest("POST", "/servers/create", { name: "Vanity parking test" }, A.token)).data.server;
const S = `/servers/${server._id}`;
const general = server.channels[0];
const slug = `zr-e2e-${Date.now().toString(36)}`;

try {
  // b joins with a normal invite (random invites keep working)
  const invite = (await rest("POST", `/channels/${general}/invites`, undefined, A.token)).data;
  record("random invite still joins", ok(await rest("POST", `/invites/${invite._id}`, undefined, B.token)));

  // level 0: refused
  let r = await rest("PUT", `${S}/vanity`, { code: slug }, A.token);
  record("level 0: claim refused (VanityUnavailable)", r.status === 403 && r.data?.type === "VanityUnavailable", `${r.status} ${r.data?.type}`);

  // buy Wings with the test provider and place them, level by level
  const buy = async (serverId, quantity) => {
    const order = await rest("POST", "/billing/orders", { product: { type: "Supercharge", server: serverId, quantity }, idempotency_key: key() }, A.token);
    if (!ok(order)) return order;
    return rest("POST", `/billing/orders/${order.data.order._id}/pay`, undefined, A.token);
  };
  const need = vanityLevel?.supercharges ?? 14;
  const lower = plans?.levels?.filter((l) => l.level < (vanityLevel?.level ?? 3)).at(-1);
  r = await buy(server._id, lower?.supercharges ?? 7);
  record("test purchase of Wings works", ok(r), `${r.status} ${r.data?.type ?? r.data?.status ?? ""}`);
  const lowLevel = await waitLevel(server._id, A.token, lower?.level ?? 2);
  r = await rest("PUT", `${S}/vanity`, { code: slug }, A.token);
  record(`level ${lowLevel}: claim refused`, r.status === 403, `${r.status} ${r.data?.type}`);

  r = await buy(server._id, need - (lower?.supercharges ?? 7));
  const topLevel = await waitLevel(server._id, A.token, vanityLevel?.level ?? 3);
  record(`server reached level ${vanityLevel?.level ?? 3}`, topLevel >= (vanityLevel?.level ?? 3), `level ${topLevel}`);

  // member without Manage Server
  r = await rest("PUT", `${S}/vanity`, { code: slug }, B.token);
  record("member without Manage Server refused", r.status === 403 && r.data?.type !== "VanityUnavailable", `${r.status} ${r.data?.type}`);

  // reserved / malformed
  r = await rest("PUT", `${S}/vanity`, { code: "admin" }, A.token);
  record("reserved name refused", r.status === 400 && r.data?.type === "VanityReserved", `${r.status} ${r.data?.type}`);
  r = await rest("PUT", `${S}/vanity`, { code: "a--b" }, A.token);
  record("malformed name refused", r.status === 400, `${r.status} ${r.data?.type}`);

  // claim (mixed case is stored lowercase)
  r = await rest("PUT", `${S}/vanity`, { code: slug.toUpperCase() }, A.token);
  record("owner claims the link", ok(r) && r.data?.code === slug, `${r.status} ${r.data?.code}`);
  const stored = (await rest("GET", S, undefined, A.token)).data?.vanity_invite;
  record("server shows the link", stored?.code === slug && stored?.channel === general);

  // duplicate on another level-3-less server is refused by level first; same server re-claim is fine
  r = await rest("PUT", `/servers/${other._id}/vanity`, { code: slug }, A.token);
  record("other server cannot take it", r.status === 403 || r.status === 409, `${r.status} ${r.data?.type}`);

  // fetch + join through the name
  r = await rest("GET", `/invites/${slug.toUpperCase()}`, undefined, B.token);
  record("fetch by name (any case) resolves to this server", ok(r) && r.data?.server_id === server._id, `${r.status}`);
  await rest("DELETE", `${S}/members/${B.user}`, undefined, A.token);
  r = await rest("POST", `/invites/${slug}`, undefined, B.token);
  record("join by name lands in the right server", ok(r) && (r.data?.server?._id ?? r.data?.server) === server._id, `${r.status}`);

  // plain invite delete cannot remove it
  r = await rest("DELETE", `/invites/${slug}`, undefined, A.token);
  record("plain invite delete refused", r.status === 400, `${r.status}`);

  // banned member refused
  await rest("PUT", `${S}/bans/${B.user}`, { reason: "vanity e2e" }, A.token);
  r = await rest("POST", `/invites/${slug}`, undefined, B.token);
  record("banned member cannot join by name", !ok(r), `${r.status} ${r.data?.type}`);
  await rest("DELETE", `${S}/bans/${B.user}`, undefined, A.token);

  // downgrade: move Wings to the parking server → grace (link keeps working)
  const mine = (await rest("GET", "/billing/@me", undefined, A.token)).data?.supercharges ?? [];
  const placed = mine.filter((s) => s.server_id === server._id);
  for (const item of placed.slice(0, placed.length - 1)) {
    await rest("POST", "/billing/supercharges", { server: other._id, supercharge: item._id }, A.token);
  }
  const dropped = await waitLevel(server._id, A.token, vanityLevel?.level ?? 3, (a, b) => a < b);
  let marked;
  for (let i = 0; i < 20 && !marked; i++) {
    marked = (await rest("GET", S, undefined, A.token)).data?.vanity_invite?.below_level_since;
    if (!marked) await sleep(5000);
  }
  record("downgrade marks the link (grace starts)", dropped < (vanityLevel?.level ?? 3) && !!marked, `level ${dropped}, since ${marked ?? "-"}`);
  r = await rest("GET", `/invites/${slug}`, undefined, B.token);
  record("link keeps working during grace", ok(r), `${r.status}`);

  // remove frees the name
  r = await rest("DELETE", `${S}/vanity`, undefined, A.token);
  record("owner removes the link", r.status === 204, `${r.status}`);
  r = await rest("GET", `/invites/${slug}`, undefined, B.token);
  record("removed name no longer resolves", r.status === 404, `${r.status}`);
} catch (error) {
  record("script error", false, String(error?.message ?? error));
} finally {
  for (const id of [server._id, other._id]) {
    await deleteServer(id, accounts.a, { "x-session-token": A.token });
  }
  await closeSessions();
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
}
