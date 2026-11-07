// Server access through the API: public, private with approval, rejected, locked,
// bypass attempts, and a change of access. No browser, so no language or size.
// Seeded accounts 1 (owner) and 2 (applicant); own servers, deleted at the end.
import {
  call,
  checks,
  closeSessions,
  deleteServer,
  seededAccounts,
  token,
} from "./lib/stack.mjs";

const [ownerAccount, memberAccount] = seededAccounts(2);
const A = await token(ownerAccount);
const B = await token(memberAccount);
const { check: checkOne, finish } = checks("privacy-e2e");
const check = (test, name, ok, detail = "") => checkOne(`${test}: ${name}`, () => {
  if (!ok) throw new Error(detail || "failed");
  return detail;
});
const me = async (session) => (await call("GET", "/users/@me", undefined, { "x-session-token": session })).json._id;
const B_ID = await me(B);

const as = (sessionToken, method, path, body) =>
  call(method, path, body, sessionToken ? { "x-session-token": sessionToken } : {});

const made = [];

async function server(name, access) {
  const r = await as(A, "POST", "/servers/create", { name, ...(access ? { access } : {}) });
  made.push(r.json.server._id);
  return { id: r.json.server._id, channel: r.json.channels[0]._id, access: r.json.server.access, discoverable: !!r.json.server.discoverable };
}
const invite = async (channel) => (await as(A, "POST", `/channels/${channel}/invites`)).json._id;

try {
// A — public
const pub = await server("Privacy test A (public)", "Open");
await check("A", "public server is not listed on Discover", pub.discoverable === false);
const ja = await as(B, "POST", `/invites/${await invite(pub.channel)}`);
await check("A", "member joins directly", ja.status === 200 && ja.json.type === "Server", `status ${ja.status} ${ja.json?.type}`);
await check("A", "member can read the server", (await as(B, "GET", `/servers/${pub.id}`)).status === 200);

// B — private, approved
const priv = await server("Privacy test B (private)", "Approval");
await check("B", "created with access Approval", priv.access === "Approval", String(priv.access));
await check("B", "private server is not listed", priv.discoverable === false);
const privInvite = await invite(priv.channel);
const preview = await as(undefined, "GET", `/invites/${privInvite}`);
await check("B", "invite preview says Approval", preview.json?.server_access === "Approval");
const jb = await as(B, "POST", `/invites/${privInvite}`);
await check("B", "join link creates a request", jb.status === 200 && jb.json?.type === "JoinRequest" && jb.json.request.status === "Pending", `${jb.status} ${jb.json?.type}`);
await check("B", "pending applicant can't read the server", (await as(B, "GET", `/servers/${priv.id}`)).status === 404);
await check("B", "pending applicant can't read messages", [403, 404].includes((await as(B, "GET", `/channels/${priv.channel}/messages?limit=1`)).status));
await check("B", "asking again keeps one pending request", (await as(B, "POST", `/invites/${privInvite}`)).json?.request?.status === "Pending");
const own = await as(B, "GET", `/servers/${priv.id}/join_requests/@me`);
await check("B", "applicant can read own request", own.status === 200 && own.json.status === "Pending");
const list = await as(A, "GET", `/servers/${priv.id}/join_requests`);
await check("B", "owner sees the request", list.status === 200 && list.json.requests.length === 1 && list.json.users[0]?._id === B_ID);
const ap = await as(A, "POST", `/servers/${priv.id}/join_requests/${B_ID}/approve`);
await check("B", "owner approves", ap.status === 204, String(ap.status));
await check("B", "approved member can read the server", (await as(B, "GET", `/servers/${priv.id}`)).status === 200);
await check("B", "approved member can read messages", (await as(B, "GET", `/channels/${priv.channel}/messages?limit=1`)).status === 200);
await check("B", "second approve is refused", (await as(A, "POST", `/servers/${priv.id}/join_requests/${B_ID}/approve`)).status === 400);

// C — private, rejected
const priv2 = await server("Privacy test C (private)", "Approval");
const inv2 = await invite(priv2.channel);
await as(B, "POST", `/invites/${inv2}`);
await check("C", "owner rejects", (await as(A, "POST", `/servers/${priv2.id}/join_requests/${B_ID}/reject`)).status === 204);
await check("C", "rejected applicant is not a member", (await as(B, "GET", `/servers/${priv2.id}`)).status === 404);
await check("C", "asking again right away is refused", (await as(B, "POST", `/invites/${inv2}`)).status === 400);
await check("C", "own request shows Rejected", (await as(B, "GET", `/servers/${priv2.id}/join_requests/@me`)).json?.status === "Rejected");

// D — locked: an invite from someone allowed to invite still works
const locked = await server("Privacy test D (locked)", "Locked");
const jd = await as(B, "POST", `/invites/${await invite(locked.channel)}`);
await check("D", "invite from the owner lets b in", jd.status === 200 && jd.json?.type === "Server", `${jd.status} ${jd.json?.type}`);

// F — bypass attempts (b is a member of the public and locked servers)
await check("F", "member can't approve on another server", (await as(B, "POST", `/servers/${priv2.id}/join_requests/${B_ID}/approve`)).status === 403);
await check("F", "member can't list requests", (await as(B, "GET", `/servers/${pub.id}/join_requests`)).status === 403);
await check("F", "member can't change access", (await as(B, "PATCH", `/servers/${pub.id}`, { access: "Open" })).status === 403);
await check("F", "no token: list requests refused", (await as(undefined, "GET", `/servers/${priv.id}/join_requests`)).status === 401);
await check("F", "listing a private server on Discover refused", (await as(A, "PATCH", `/servers/${priv.id}`, { discoverable: true })).status >= 400);

// G — persistence of a change
await as(A, "PATCH", `/servers/${pub.id}`, { access: "Approval" });
await check("G", "access change is stored", (await as(A, "GET", `/servers/${pub.id}`)).json?.access === "Approval");
await as(A, "PATCH", `/servers/${pub.id}`, { access: "Open" });
await check("G", "and back to Open", (await as(A, "GET", `/servers/${pub.id}`)).json?.access !== "Approval");

} finally {
  for (const id of made) await deleteServer(id, ownerAccount, { "x-session-token": A });
  await closeSessions();
  finish();
}
