// Lobby API checks with two accounts: settings, limits, role answers, forged
// requests, deleted channels and roles. No browser, so no language or size.
// Seeded accounts 1 (owner) and 2 (member); own server, deleted at the end.
import {
  call,
  closeSessions,
  deleteServer,
  seededAccounts,
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

const A = await login(accounts.a);
const B = await login(accounts.b);

const created = await rest("POST", "/servers/create", { name: "Lobby functional test" }, A.token);
const server = created.data.server;
const S = `/servers/${server._id}`;
const general = server.channels[0];
const lobbyRead = async (token = A.token) => (await rest("GET", `${S}`, undefined, token)).data?.lobby;
const editLobby = (lobby, token = A.token) => rest("PATCH", S, { lobby }, token);

try {
  // fixtures: channels and roles
  const news = (await rest("POST", `${S}/channels`, { type: "Text", name: "news" }, A.token)).data;
  const temp = (await rest("POST", `${S}/channels`, { type: "Text", name: "temporary" }, A.token)).data;
  const role = async (name) => (await rest("POST", `${S}/roles`, { name }, A.token)).data.id;
  const windows = await role("Windows");
  const android = await role("Android");
  const ios = await role("iOS");
  const arabic = await role("Arabic");
  const manual = await role("Manual");
  const mods = await role("Mods");
  const doomed = await role("Doomed");
  await rest("PUT", `${S}/permissions/${mods}`, { permissions: { allow: 1 << 23, deny: 0 } }, A.token); // ManageMessages

  // 1-5 settings persistence
  const lobby = {
    enabled: true,
    tagline: "Where people who love games meet",
    about: "Welcome to **our** server.\n\n<script>alert(1)</script>",
    onboarding: [
      { id: "devices", question: "What devices do you use?", description: "Pick all that apply.", options: [
        { id: "win", label: "Windows", role: windows },
        { id: "and", label: "Android", role: android },
        { id: "ios", label: "iOS", role: ios },
      ] },
      { id: "lang", question: "What language do you prefer?", options: [
        { id: "ar", label: "العربية", role: arabic },
        { id: "doomed", label: "Doomed", role: doomed },
      ] },
    ],
    actions: [{ label: "Read the news", channel: news._id, emoji: "📣" }, { label: "Temporary", channel: temp._id }],
    channels: [general, news._id, temp._id],
    faq: [{ question: "Is this official?", answer: "Yes, see [the site](https://zrzur.com)." }],
    staff_roles: [mods],
    sections: ["Questions", "Start", "Team", "News"],
    news_channel: news._id,
    intro_channel: temp._id,
  };
  let r = await editLobby(lobby);
  record("admin saves a full lobby", ok(r), `${r.status} ${r.data?.type ?? ""}`);
  const saved = await lobbyRead();
  record("welcome text persists after a fresh fetch", saved?.tagline === lobby.tagline && saved?.about === lobby.about);
  record("section order persists", JSON.stringify(saved?.sections) === JSON.stringify(lobby.sections), JSON.stringify(saved?.sections));
  record("buttons, channels, FAQ, staff persist",
    saved?.actions?.length === 2 && saved?.channels?.length === 3 && saved?.faq?.length === 1 && saved?.staff_roles?.[0] === mods);
  record("role questions and role mapping persist",
    saved?.onboarding?.[0]?.options?.map((o) => o.role).join() === [windows, android, ios].join());

  r = await editLobby({ ...lobby, hide_sections: true, sections: [] });
  const hidden = await lobbyRead();
  record("hiding every section persists", r.status === 200 && hidden?.hide_sections === true, `${r.status}`);
  await editLobby(lobby);

  // limits
  r = await editLobby({ ...lobby, actions: [...lobby.actions, ...lobby.actions] });
  record("more than three buttons rejected", r.status === 400, `${r.status}`);
  r = await editLobby({ ...lobby, onboarding: Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, question: "Q", options: [{ id: "o", label: "x", role: windows }] })) });
  record("more than five role questions rejected", r.status === 400, `${r.status}`);
  r = await editLobby({ ...lobby, onboarding: [{ id: "q", question: "Q", options: Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, label: "x", role: windows })) }] });
  record("more than eight answers rejected", r.status === 400, `${r.status}`);
  r = await editLobby({ ...lobby, onboarding: [{ id: "q", question: "Q", options: [{ id: "o", label: "Mods", role: mods }] }] });
  record("privileged role cannot be offered", !ok(r), `${r.status} ${r.data?.type ?? ""}`);

  // member b joins
  const invite = (await rest("POST", `/channels/${general}/invites`, undefined, A.token)).data;
  r = await rest("POST", `/invites/${invite._id}`, undefined, B.token);
  record("member joins through an invite", ok(r), `${r.status}`);
  await rest("PATCH", `${S}/members/${B.user}`, { roles: [manual] }, A.token);

  // 17 unauthorized edit
  r = await editLobby({ ...lobby, tagline: "hacked" }, B.token);
  record("member cannot edit lobby settings", r.status === 403 || r.status === 401, `${r.status} ${r.data?.type ?? ""}`);
  record("member sees the saved lobby", (await lobbyRead(B.token))?.tagline === lobby.tagline);

  // 12-15 answering
  const answer = (question, option, token = B.token) => rest("POST", `${S}/lobby/answers`, { question, option }, token);
  r = await answer("devices", "win");
  r = await answer("devices", "and");
  const member1 = (await rest("GET", `${S}/members/${B.user}`, undefined, B.token)).data;
  record("member gets the roles of two answers (multiple choice)", [windows, android].every((id) => member1?.roles?.includes(id)), JSON.stringify(member1?.roles?.length));
  record("unrelated manual role is kept", member1?.roles?.includes(manual));
  await Promise.all([answer("lang", "ar"), answer("lang", "ar"), answer("lang", "ar")]);
  const member2 = (await rest("GET", `${S}/members/${B.user}`, undefined, B.token)).data;
  record("repeated concurrent answers give the role once", member2?.roles?.filter((id) => id === arabic).length === 1);

  // forged requests
  r = await answer("devices", "nope");
  record("forged answer id rejected", !ok(r), `${r.status}`);
  r = await rest("POST", `${S}/lobby/answers`, { question: "devices", option: "win", role: mods }, B.token);
  const member3 = (await rest("GET", `${S}/members/${B.user}`, undefined, B.token)).data;
  record("extra role field in a request is ignored", !member3?.roles?.includes(mods), `${r.status}`);

  // a role that becomes privileged after it was configured
  await rest("PATCH", `${S}/roles/${ios}`, { permissions: { allow: 1 << 23, deny: 0 } }, A.token);
  await rest("PUT", `${S}/permissions/${ios}`, { permissions: { allow: 1 << 23, deny: 0 } }, A.token);
  r = await answer("devices", "ios");
  const member4 = (await rest("GET", `${S}/members/${B.user}`, undefined, B.token)).data;
  record("role made privileged later can no longer be chosen", !member4?.roles?.includes(ios), `${r.status} ${r.data?.type ?? ""}`);
  await rest("PUT", `${S}/permissions/${ios}`, { permissions: { allow: 0, deny: 0 } }, A.token);

  // 18 deleted channel and role
  await rest("DELETE", `/channels/${temp._id}`, undefined, A.token);
  await rest("DELETE", `${S}/roles/${doomed}`, undefined, A.token);
  const afterDelete = await lobbyRead();
  record("deleted channel is dropped from the stored lobby",
    !JSON.stringify(afterDelete).includes(temp._id), "stored lobby still references it");
  record("deleted role is dropped from the stored lobby",
    !JSON.stringify(afterDelete).includes(doomed), "stored lobby still references it");
  r = await editLobby({ ...afterDelete, tagline: "Edited after deletions" });
  record("admin can still save after a channel and a role were deleted", ok(r), `${r.status} ${r.data?.type ?? ""}`);

  // changing one's mind
  r = await rest("DELETE", `${S}/lobby/answers`, { question: "devices", option: "win" }, B.token);
  const member5 = (await rest("GET", `${S}/members/${B.user}`, undefined, B.token)).data;
  record("member can remove an interest again", ok(r) && !member5?.roles?.includes(windows), `${r.status}`);
  record("removing an interest keeps the other roles",
    [android, manual].every((id) => member5?.roles?.includes(id)));

  // disabled lobby
  await editLobby({ ...(await lobbyRead()), enabled: false });
  r = await answer("devices", "and");
  record("answers are refused while the lobby is off", !ok(r), `${r.status}`);
} finally {
  await deleteServer(server._id, accounts.a, { "x-session-token": A.token });
  await closeSessions();
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
}
