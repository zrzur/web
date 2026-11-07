// Deleting a channel removes it from its server's categories. No browser, so no
// language or size. Seeded account 1; own server, deleted at the end.
import {
  api,
  closeSessions,
  deleteServer,
  seededAccounts,
  token,
} from "./lib/stack.mjs";

const [account] = seededAccounts(1);
const session = await token(account);
const { server } = await api(session, "POST", "/servers/create", {
  name: "Category check",
});
const S = server._id;

try {
  const channel = await api(session, "POST", `/servers/${S}/channels`, {
    type: "Text",
    name: "category-probe",
  });
  await api(session, "PATCH", `/servers/${S}`, {
    categories: [
      { id: "01KCATEGORYCHECK000000000", title: "Check", channels: [channel._id] },
    ],
  });
  await api(session, "DELETE", `/channels/${channel._id}`);
  const after = await api(session, "GET", `/servers/${S}`);
  const left = (after.categories ?? []).some((c) =>
    c.channels.includes(channel._id),
  );
  const still = after.channels.includes(channel._id);
  console.log(`${left ? "FAIL" : "PASS"}  deleted channel left its category`);
  console.log(`${still ? "FAIL" : "PASS"}  gone from the server's channels`);
  process.exitCode = left || still ? 1 : 0;
} finally {
  await deleteServer(S, account, { "x-session-token": session });
  await closeSessions();
}
