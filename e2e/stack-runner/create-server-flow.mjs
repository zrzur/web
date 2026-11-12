// The create server flow, as a person uses it: every path (Start from scratch
// and each template, with each answer and with skip), in en/ar/de on desktop
// and at 375 px. Each server is read back from the API (categories, channels,
// roles, permissions) and deleted again.
//
//   node e2e/stack-runner/create-server-flow.mjs [screens] [paths] [failures] [sidebar] [member]
//
// Env: E2E_LIB (folder with stack.mjs and catalog.mjs), E2E_WEB (this web
//   checkout, for the catalogs), E2E_CHROMIUM (headless shell), E2E_BASE,
//   E2E_API, E2E_LOCALES, E2E_SIZES (desktop,phone), E2E_PATHS (e.g. gaming/skip).
//
// The account comes from the dev stack's account file. Servers made here are
// deleted and the sessions opened here are closed in `finally`.
import { pathToFileURL } from "node:url";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs and catalog.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const {
  API,
  APP,
  LOCALES,
  VIEWPORTS,
  accounts,
  api,
  login,
  pw,
  reporter,
  shots,
  token,
} = await import(new URL("stack.mjs", dir));
const { tr } = await import(new URL("catalog.mjs", dir));

const WS = process.env.E2E_WS ?? "ws://127.0.0.1:14703";
const SUITE = "create-server-flow";
const shot = shots(SUITE);
const report = reporter(SUITE);
const want = (part) =>
  process.argv.length <= 2 || process.argv.slice(2).includes(part);
const sizes = (process.env.E2E_SIZES ?? "desktop,phone").split(",");
const locales = process.env.E2E_LOCALES?.split(",") ?? LOCALES;

// permission bits, written out here so a change in the app can't hide
const P = {
  ManageMessages: 2n ** 23n,
  TimeoutMembers: 2n ** 8n,
  KickMembers: 2n ** 6n,
  AssignRoles: 2n ** 9n,
  SendMessage: 2n ** 22n,
};
const MODERATOR =
  P.ManageMessages | P.TimeoutMembers | P.KickMembers | P.AssignRoles;

const START = ["Start here", ["#rules", "#announcements"]];
// no categories: the sidebar's own Text and Voice headings hold these
const SCRATCH_PLAIN = { flat: ["#General", "~Hangout"], groups: [], roles: [] };
const GUILD = [
  START,
  ["Community", ["#General", "#clips"]],
  ["Gaming rooms", ["~Lobby", "~Squad"]],
];
const FRIENDS = [
  ["Friends", ["#General", "#photos"]],
  ["Hang out", ["~Hangout"]],
];
const STAFF = { roles: ["Moderators", "Members"], locked: true };
/** template row × answer → what must exist afterwards */
const PATHS = [
  [
    "scratch",
    "community",
    {
      groups: [START, ["Community", ["#General"]], ["Hang out", ["~Lobby"]]],
      ...STAFF,
    },
  ],
  ["scratch", "friends", SCRATCH_PLAIN],
  ["scratch", "skip", SCRATCH_PLAIN],
  ["gaming", "community", { groups: GUILD, ...STAFF }],
  ["gaming", "friends", { groups: GUILD.slice(1), roles: [] }],
  ["gaming", "skip", { groups: GUILD, ...STAFF }],
  [
    "friends",
    "community",
    { groups: [START, ...FRIENDS], roles: ["Moderators"], locked: true },
  ],
  ["friends", "friends", { groups: FRIENDS, roles: [] }],
  ["friends", "skip", { groups: FRIENDS, roles: [] }],
];
const ROW = {
  scratch: "Start from scratch",
  gaming: "Gaming community",
  friends: "Friends",
};
const ANSWER = {
  community: "A wider community",
  friends: "Just friends",
};
const SKIP = "Decide later";

const exact = (text) =>
  new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);

function fail(message) {
  throw new Error(message);
}
function same(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) fail(`${what}: got ${a}, wanted ${b}`);
}

const made = new Set();
const account = accounts[Number(process.env.E2E_ACCOUNT ?? 1)];
let session;

/** Tell the test about any server the app creates, so it is always removed */
function watchCreated(page) {
  page.on("response", async (response) => {
    if (!response.url().endsWith("/servers/create") || !response.ok()) return;
    const body = await response.json().catch(() => undefined);
    if (body?.server?._id) made.add(body.server._id);
  });
}

/**
 * The API as this suite. Sessions per account are capped and other suites sign
 * in to these accounts too, so a long run can lose its session: sign in again.
 */
async function call(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await api(session, method, path, body);
    } catch (error) {
      const wait = /\s429\s.*"retry_after":(\d+)/.exec(error.message);
      if (wait && attempt < 6)
        await new Promise((r) => setTimeout(r, Number(wait[1]) + 200));
      else if (/ 401 /.test(error.message) && attempt === 0)
        session = await token(account);
      else throw error;
    }
  }
}

/** Deleting a server asks for the password again: a one-time ticket */
async function removeServer(id) {
  try {
    for (let attempt = 0; ; attempt++) {
      const { token: ticket } = await call("PUT", "/auth/mfa/ticket", {
        password: account.password,
      });
      const res = await fetch(`${API}/servers/${id}`, {
        method: "DELETE",
        headers: { "x-session-token": session, "x-mfa-ticket": ticket },
      });
      if (res.ok) break;
      if (res.status !== 429 || attempt >= 5) throw new Error(`${res.status}`);
      const { retry_after: wait } = await res.json().catch(() => ({}));
      await new Promise((resolve) => setTimeout(resolve, (wait ?? 5000) + 200));
    }
    made.delete(id);
  } catch (error) {
    console.log(`  could not delete ${id}: ${error.message}`);
  }
}

/** Only the names this suite gives its servers */
const OURS =
  /^E2E ((scratch|gaming|friends)\/|(retry|busy|icon|side|stopped|member)$)/;

/** Servers an interrupted run left behind, read from the gateway's Ready */
async function leftovers(userId) {
  const socket = new WebSocket(`${WS}/?token=${session}&format=json`);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no Ready")), 20000);
      socket.onerror = () => reject(new Error("gateway error"));
      socket.onmessage = ({ data }) => {
        const event = JSON.parse(data);
        if (event.type !== "Ready") return;
        clearTimeout(timer);
        resolve(
          (event.servers ?? [])
            .filter((s) => s.owner === userId && OURS.test(s.name))
            .map((s) => s._id),
        );
      };
    });
  } finally {
    socket.close();
  }
}

const dialog = (page) =>
  page.locator('[role="dialog"][aria-modal="true"]').last();

/** Open step 1 the way this screen size offers it */
async function openFlow(page, L) {
  await page.goto(`${APP}/app`);
  const rail = page.getByRole("button", {
    name: tr(L, "Create or join a server"),
  });
  const tile = page.locator("[data-add]").first();
  const start = page.getByRole("button", {
    name: tr(L, "Create your server"),
  });
  // the rail exists on a phone too, out of sight
  const narrow = page.viewportSize().width < 600;
  const way = (narrow ? tile : rail).or(start).first();
  await way.waitFor({ timeout: 60000 });
  await way.click();
  await dialog(page).waitFor();
  await page.waitForTimeout(250);
}

const row = (page, L, english) =>
  dialog(page).getByRole("button", { name: tr(L, english), exact: false });

async function pickRow(page, L, key) {
  await row(page, L, ROW[key]).click();
  await dialog(page).getByText(tr(L, "Who will gather here?")).waitFor();
}
async function answer(page, L, key) {
  if (key === "skip")
    await dialog(page)
      .getByRole("button", { name: tr(L, SKIP) })
      .click();
  else await row(page, L, ANSWER[key]).click();
  await dialog(page).getByText(tr(L, "Make it yours")).waitFor();
}
const nameField = (page) => dialog(page).locator('input[name="name"]');
const createButton = (page, L) =>
  dialog(page).getByRole("button", { name: exact(tr(L, "Create")) });

async function create(page, L, name) {
  await nameField(page).fill(name);
  await dialog(page).getByRole("switch").click();
  await createButton(page, L).click();
}

async function noSidewaysScroll(page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  if (wide > 1) fail(`page scrolls sideways by ${wide}px`);
  const inner = await dialog(page).evaluate((box) => {
    const body = box.querySelector("[data-dialog-body]");
    return body ? body.scrollWidth - body.clientWidth : 0;
  });
  if (inner > 1) fail(`dialog body scrolls sideways by ${inner}px`);
}

async function noMessageIds(page) {
  const text = await dialog(page).innerText();
  if (
    /\b[A-Za-z0-9_-]{6}\b/.test(text) &&
    /\b(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z0-9]{6}\b/.test(text)
  )
    fail(`looks like a raw message id: ${text.slice(0, 120)}`);
}

/** The body of the dialog has no scroll bar: everything fits */
async function fitsWithoutScroll(page) {
  const over = await dialog(page).evaluate((box) => {
    const body = box.querySelector("[data-dialog-body]");
    return body.scrollHeight - body.clientHeight;
  });
  if (over > 1) fail(`dialog body scrolls by ${over}px`);
}

/** Everything the app built, checked through the API */
async function checkServer(id, L, expected, urlChannel) {
  // the catalog has a second "Lobby" for the settings page, under a context
  const name = (english) =>
    english === "Lobby" && L === "ar" ? "الردهة" : tr(L, english);
  const { server, channels } = await readServer(id);
  const label = (entry) => {
    const prefix =
      entry.channel_type === "VoiceChannel" || entry.voice ? "~" : "#";
    return `${prefix}${entry.name}`;
  };
  const byId = new Map(channels.map((c) => [c._id, c]));
  same(
    (server.categories ?? []).map((c) => [
      c.title,
      c.channels.map((channel) =>
        label(byId.get(channel) ?? { name: "missing" }),
      ),
    ]),
    expected.groups.map(([title, rooms]) => [
      name(title),
      rooms.map((room) => `${room[0]}${name(room.slice(1))}`),
    ]),
    "categories and channels",
  );
  const flat = (expected.flat ?? []).map(
    (room) => `${room[0]}${name(room.slice(1))}`,
  );
  same(
    flat.filter((room) => !channels.some((c) => label(c) === room)),
    [],
    "rooms missing",
  );
  same(
    channels.length,
    flat.length + expected.groups.flatMap((g) => g[1]).length,
    "channel count",
  );
  same(server.discoverable ?? false, false, "listed on Discover");
  // the sidebar always draws these two headings; no category may repeat them
  const reserved = [name("Text channels"), name("Voice channels")];
  same(
    (server.categories ?? [])
      .map((c) => c.title)
      .filter((t) => reserved.includes(t)),
    [],
    "category repeats a sidebar heading",
  );

  // the first text room a plain member can write in, as the API sees it
  const writable = (server.categories ?? [])
    .flatMap((c) => c.channels)
    .concat(channels.map((c) => c._id))
    .find(
      (c) =>
        label(byId.get(c)).startsWith("#") &&
        !(BigInt(byId.get(c).default_permissions?.d ?? 0) & P.SendMessage),
    );
  same(urlChannel, writable, "opens on the first writable text channel");

  const roles = Object.entries(server.roles ?? {}).sort(
    (a, b) => (a[1].rank ?? 0) - (b[1].rank ?? 0),
  );
  same(
    roles.map(([, r]) => r.name),
    expected.roles.map(name),
    "roles",
  );
  for (const [, role] of roles) {
    const moderators = role.name === name("Moderators");
    same(
      BigInt(role.permissions?.a ?? 0).toString(),
      (moderators ? MODERATOR : 0n).toString(),
      `${role.name} allow`,
    );
    same(role.permissions?.d ?? 0, 0, `${role.name} deny`);
    if (!role.colour) fail(`${role.name} has no colour`);
  }

  const room = (english) => channels.find((c) => c.name === name(english));
  if (expected.locked) {
    same(server.rules_channel, room("rules")?._id, "rules channel");
    const moderators = roles.find(([, r]) => r.name === name("Moderators"))[0];
    for (const key of ["rules", "announcements"]) {
      const channel = room(key);
      if (!(BigInt(channel.default_permissions?.d ?? 0) & P.SendMessage))
        fail(`${key}: everyone can still post`);
      if (
        !(
          BigInt(channel.role_permissions?.[moderators]?.a ?? 0) & P.SendMessage
        )
      )
        fail(`${key}: Moderators can't post`);
      const others = Object.keys(channel.role_permissions ?? {}).filter(
        (role) => role !== moderators,
      );
      same(others, [], `${key}: other roles with their own rights`);
    }
  } else {
    same(server.rules_channel ?? null, null, "rules channel");
    for (const channel of channels)
      same(
        channel.default_permissions ?? null,
        null,
        `${channel.name} has its own rights`,
      );
  }
  return { server, channels };
}

async function readServer(id) {
  const res = await call("GET", `/servers/${id}?include_channels=true`);
  return { server: res.server ?? res, channels: res.channels ?? [] };
}

function pageServer(page) {
  const match = page
    .url()
    .match(/\/server\/([0-9A-Z]{26})\/channel\/([0-9A-Z]{26})/);
  if (!match) fail(`not on a channel: ${page.url()}`);
  return { id: match[1], channel: match[2] };
}

async function screens(page, L, tag, username) {
  await report.step(
    `${tag} step 1: small, fixed rows, no counts, nothing hidden shows`,
    async () => {
      await openFlow(page, L);
      same(
        await page.evaluate(() => document.documentElement.dir || "ltr"),
        L === "ar" ? "rtl" : "ltr",
        "direction",
      );
      await page.screenshot({ path: shot(`${tag}-1-start`) });
      const box = dialog(page);
      for (const text of [
        "Start from scratch",
        "Or start ready-made",
        "Gaming community",
        "Friends",
        "Got an invite?",
        "Join with an invite",
      ])
        await box
          .getByText(tr(L, text), { exact: true })
          .first()
          .waitFor({ timeout: 5000 });
      for (const text of [
        "Study group",
        "School club",
        "Team",
        "Class or course",
      ])
        same(
          await box.getByText(tr(L, text), { exact: true }).count(),
          0,
          `${text} on screen`,
        );
      same(await box.locator("[data-flow-row]").count(), 3, "rows");
      same(
        await box.locator("[data-flow-row] svg[data-flow-art]").count(),
        3,
        "coloured icons",
      );
      const text = await box.innerText();
      if (/\d/.test(text)) fail(`a number on step 1: ${text}`);
      await fitsWithoutScroll(page);
      await noSidewaysScroll(page);
      await noMessageIds(page);

      // the scratch row comes before the template heading
      const top = async (loc) => (await loc.boundingBox()).y;
      if (
        (await top(row(page, L, ROW.scratch))) >=
        (await top(box.getByText(tr(L, "Or start ready-made"))))
      )
        fail("Start from scratch is not on top");

      if (tag.endsWith("desktop")) {
        const size = await box.locator("[data-dialog-body]").evaluate((b) => {
          const surface = b.parentElement.getBoundingClientRect();
          return { w: surface.width, h: surface.height };
        });
        // the old box was 440 wide, with six template rows
        if (size.w > 400) fail(`box is ${size.w}px wide`);
        if (size.h > 480) fail(`box is ${size.h}px tall`);
        console.log(`       box ${Math.round(size.w)} x ${Math.round(size.h)}`);
      }
      if (L === "ar") {
        const transform = await box
          .locator("[data-flow-row] .z-icon")
          .first()
          .evaluate((el) => getComputedStyle(el).transform);
        if (!transform.startsWith("matrix(-1"))
          fail(`chevron not mirrored: ${transform}`);
      }
    },
  );

  await report.step(
    `${tag} step 2: rows, skip link, Back; focus moves`,
    async () => {
      await row(page, L, ROW.gaming).focus();
      await page.keyboard.press("Enter");
      await dialog(page).getByText(tr(L, "Who will gather here?")).waitFor();
      await page.waitForTimeout(100);
      await page.screenshot({ path: shot(`${tag}-2-question`) });
      same(await dialog(page).locator("[data-flow-row]").count(), 2, "answers");
      same(
        await dialog(page)
          .locator("[data-flow-row] svg[data-flow-art]")
          .count(),
        2,
        "coloured icons",
      );
      const focused = await page.evaluate(
        () => document.activeElement?.textContent ?? "",
      );
      if (!focused.includes(tr(L, ANSWER.community)))
        fail(`focus on "${focused}"`);
      await fitsWithoutScroll(page);
      await noSidewaysScroll(page);
      await dialog(page)
        .getByRole("button", { name: tr(L, "Back") })
        .click();
      await dialog(page).getByText(tr(L, "Or start ready-made")).waitFor();
      await page.waitForTimeout(100);
      const back = await page.evaluate(
        () => document.activeElement?.textContent ?? "",
      );
      if (!back.includes(tr(L, ROW.gaming))) fail(`focus back on "${back}"`);
    },
  );

  await report.step(
    `${tag} step 3: default name, switch required, Back keeps typing`,
    async () => {
      await pickRow(page, L, "gaming");
      await answer(page, L, "friends");
      await page.waitForTimeout(100);
      await page.screenshot({ path: shot(`${tag}-3-yours`) });
      same(
        await nameField(page).inputValue(),
        tr(L, "{name}'s server").replace("{name}", username),
        "default name",
      );
      same(
        await page.evaluate(() => document.activeElement?.getAttribute("name")),
        "name",
        "focus on the name",
      );
      await nameField(page).fill("Typed name");

      // the required switch, with Zrzur's rules behind the link
      const link = dialog(page).getByRole("link");
      same(
        await link.getAttribute("href"),
        "https://zrzur.com/legal/server-owner-rules",
        "rules link",
      );
      if (!(await createButton(page, L).isDisabled()))
        fail("Create works before the rules are accepted");
      // the link is its own target; the rest of the row flips the switch
      await link.evaluate((a) => {
        a.addEventListener("click", (e) => e.preventDefault());
        a.click();
      });
      same(
        await dialog(page).getByRole("switch").getAttribute("aria-checked"),
        "false",
        "switch after the link",
      );
      const words = dialog(page).locator("[data-flow-rules] > span");
      const area = await words.boundingBox();
      await words.click({
        position: { x: L === "ar" ? area.width - 4 : 4, y: area.height / 2 },
      });
      if (await createButton(page, L).isDisabled())
        fail("Create stays off after the rules are accepted");

      await page.screenshot({ path: shot(`${tag}-3-yours-on`) });

      await dialog(page)
        .getByRole("button", { name: tr(L, "Back") })
        .click();
      await dialog(page).getByText(tr(L, "Who will gather here?")).waitFor();
      await page.waitForTimeout(100);
      const focused = await page.evaluate(
        () => document.activeElement?.textContent ?? "",
      );
      if (!focused.includes(tr(L, ANSWER.friends)))
        fail(`focus on "${focused}"`);
      await answer(page, L, "friends");
      same(
        await nameField(page).inputValue(),
        "Typed name",
        "typed name after Back",
      );
      same(
        await dialog(page).getByRole("switch").getAttribute("aria-checked"),
        "true",
        "switch after Back",
      );
      await noSidewaysScroll(page);
      await noMessageIds(page);
    },
  );

  await report.step(
    `${tag} Escape closes every step and creates nothing`,
    async () => {
      await page.keyboard.press("Escape");
      await dialog(page).waitFor({ state: "detached", timeout: 5000 });
      same(made.size, 0, "servers made");
      await openFlow(page, L);
      await pickRow(page, L, "friends");
      await page.keyboard.press("Escape");
      await dialog(page).waitFor({ state: "detached", timeout: 5000 });
      await openFlow(page, L);
      await page.keyboard.press("Escape");
      await dialog(page).waitFor({ state: "detached", timeout: 5000 });
    },
  );

  await report.step(
    `${tag} Join a server leaves for the join dialog`,
    async () => {
      await openFlow(page, L);
      await dialog(page)
        .getByRole("button", { name: tr(L, "Join with an invite") })
        .click();
      await page.waitForTimeout(300);
      same(
        await dialog(page).getByText(tr(L, "Or start ready-made")).count(),
        0,
        "still on step 1",
      );
      await page.keyboard.press("Escape");
    },
  );
}

async function paths(page, L, tag) {
  const only = process.env.E2E_PATHS?.split(",");
  for (const [template, reply, expected] of PATHS) {
    const path = `${template}/${reply}`;
    if (only && !only.includes(path)) continue;
    await report.step(
      `${tag} ${path}: builds the listed server and opens it`,
      async () => {
        await openFlow(page, L);
        await pickRow(page, L, template);
        await answer(page, L, reply);
        await create(page, L, `E2E ${path}`.slice(0, 32));
        await page.waitForURL(/\/server\/[0-9A-Z]{26}\/channel\//, {
          timeout: 180000,
        });
        const { id, channel } = pageServer(page);
        try {
          await checkServer(id, L, expected, channel);
          await page.waitForTimeout(400);
          await page.screenshot({
            path: shot(`${tag}-created-${path.replace("/", "-")}`),
          });
          same(
            await page.locator('[role="dialog"][aria-modal="true"]').count(),
            0,
            "dialog left open",
          );
        } finally {
          await removeServer(id);
        }
      },
    );
  }
}

/** A stretch of the page as a real picture for the icon */
const picture = async (page) => ({
  name: "icon.png",
  mimeType: "image/png",
  buffer: await page.screenshot({
    clip: { x: 0, y: 0, width: 256, height: 256 },
  }),
});

async function failures(page, L, tag) {
  // The server is made in one request (the blueprint): it comes back complete
  // or nothing exists, so there is no half-built server to continue any more.
  const createRoute = /\/servers\/create$/;
  await report.step(
    `${tag} a failed create says why in the dialog, makes nothing, Create again makes it`,
    async () => {
      let failing = true;
      let reached = 0;
      await page.route(createRoute, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        if (!failing) {
          reached++;
          return route.continue();
        }
        await route.fulfill({
          status: 500,
          body: '{"type":"InternalError"}',
          contentType: "application/json",
        });
      });
      try {
        await openFlow(page, L);
        await pickRow(page, L, "gaming");
        await answer(page, L, "community");
        await create(page, L, "E2E retry");
        const alert = dialog(page).getByRole("alert");
        await alert.waitFor({ timeout: 60000 });
        await page.screenshot({ path: shot(`${tag}-create-failed`) });
        if (!(await alert.innerText()).trim()) fail("the error says nothing");
        await noMessageIds(page);
        same(
          await dialog(page)
            .getByRole("button", { name: exact(tr(L, "Back")) })
            .count(),
          1,
          "Back still offered (nothing was made)",
        );
        same(
          (await leftovers(userId)).length,
          0,
          "servers made by the failed create",
        );
        failing = false;
        await createButton(page, L).click();
        await page.waitForURL(/\/server\/[0-9A-Z]{26}\/channel\//, {
          timeout: 60000,
        });
        same(reached, 1, "create requests that reached the server");
        const { id, channel } = pageServer(page);
        try {
          await checkServer(id, L, { groups: GUILD, ...STAFF }, channel);
        } finally {
          await removeServer(id);
        }
      } finally {
        await page.unroute(createRoute);
      }
    },
  );

  await report.step(
    `${tag} a create with no answer in time opens the server that landed, no second one`,
    async () => {
      let reached = 0;
      await page.route(createRoute, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        reached++;
        // past the 20 s the app waits; the request still lands afterwards
        await new Promise((resolve) => setTimeout(resolve, 23000));
        await route.continue().catch(() => {});
      });
      try {
        await openFlow(page, L);
        await pickRow(page, L, "friends");
        await answer(page, L, "skip");
        const before = made.size;
        await create(page, L, "E2E stopped");
        await dialog(page)
          .getByRole("alert")
          .getByText(tr(L, "Zrzur did not answer in time."))
          .waitFor({ timeout: 40000 });
        await page.screenshot({ path: shot(`${tag}-create-timeout`) });
        // the late answer: the server exists now and the gateway brings it in
        const until = Date.now() + 20000;
        while (made.size === before && Date.now() < until)
          await page.waitForTimeout(250);
        const landed = [...made].at(-1);
        if (made.size === before) fail("the held create never landed");
        await page.waitForTimeout(1500);
        await createButton(page, L).click();
        await page.waitForURL(new RegExp(`/server/${landed}(/|$)`), {
          timeout: 30000,
        });
        same(reached, 1, "create requests sent");
        await removeServer(landed);
      } finally {
        await page.unroute(createRoute);
      }
    },
  );

  await report.step(
    `${tag} Escape does nothing while the server is being built`,
    async () => {
      await page.route(/\/servers\/[0-9A-Z]{26}\/channels$/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.continue();
      });
      try {
        await openFlow(page, L);
        await pickRow(page, L, "friends");
        await answer(page, L, "skip");
        await create(page, L, "E2E busy");
        await page.waitForTimeout(300);
        await page.keyboard.press("Escape");
        await page.waitForURL(/\/server\/[0-9A-Z]{26}\/channel\//, {
          timeout: 60000,
        });
        const { id, channel } = pageServer(page);
        try {
          await checkServer(id, L, { groups: FRIENDS, roles: [] }, channel);
        } finally {
          await removeServer(id);
        }
      } finally {
        await page.unroute(/\/servers\/[0-9A-Z]{26}\/channels$/);
      }
    },
  );

  await report.step(`${tag} chosen icon lands on the server`, async () => {
    await openFlow(page, L);
    const file = await picture(page);
    await pickRow(page, L, "scratch");
    await answer(page, L, "skip");
    await dialog(page).locator('input[type="file"]').setInputFiles(file);
    await dialog(page)
      .getByRole("button", { name: exact(tr(L, "Crop")) })
      .click();
    await page.waitForTimeout(500);
    await dialog(page).getByText(tr(L, "Make it yours")).waitFor();
    await page.screenshot({ path: shot(`${tag}-3-icon`) });
    await dialog(page)
      .getByRole("button", { name: tr(L, "Back") })
      .click();
    await answer(page, L, "skip");
    if (!(await dialog(page).locator("img").count()))
      fail("picture lost after Back");
    await create(page, L, "E2E icon");
    await page.waitForURL(/\/server\/[0-9A-Z]{26}\/channel\//, {
      timeout: 60000,
    });
    const { id } = pageServer(page);
    try {
      const { server } = await readServer(id);
      if (!server.icon?._id) fail("server has no icon");
    } finally {
      await removeServer(id);
    }
  });

  await report.step(
    `${tag} a very long display name still gives a valid default`,
    async () => {
      const before = (await call("GET", "/users/@me")).display_name;
      const long = "ن".repeat(32);
      await call("PATCH", "/users/@me", { display_name: long });
      try {
        await openFlow(page, L);
        await pickRow(page, L, "scratch");
        await answer(page, L, "skip");
        const value = await nameField(page).inputValue();
        if ([...value].length > 32)
          fail(`default is ${[...value].length} long`);
        await dialog(page).getByRole("switch").click();
        if (await createButton(page, L).isDisabled()) fail("Create off");
        await page.keyboard.press("Escape");
      } finally {
        await api(
          session,
          "PATCH",
          "/users/@me",
          before ? { display_name: before } : { remove: ["DisplayName"] },
        );
      }
    },
  );
}

/** Sidebar category headings a person sees, by name */
const heading = (page, L, english) =>
  page.locator("[aria-expanded]").filter({ hasText: exact(tr(L, english)) });
/** The channel list: a phone shows it behind the back arrow */
async function openChannelList(page, id) {
  await page.goto(`${APP}/server/${id}`);
  await page.getByText("side-rooms").first().waitFor({ timeout: 60000 });
  if (page.viewportSize().width < 600) {
    await page.locator('button:has([data-icon="arrow-left"])').first().click();
    await page.waitForTimeout(600);
  }
  await page
    .getByText("side-inside", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
}

async function sidebar(page, L, tag) {
  await report.step(
    `${tag} sidebar: empty default headings hide, rooms outside categories keep theirs`,
    async () => {
      const created = await call("POST", "/servers/create", {
        name: "E2E side",
      });
      const id = created.server._id;
      made.add(id);
      try {
        const add = (name, type) =>
          call("POST", `/servers/${id}/channels`, { name, type });
        // text outside any category, voice inside one
        await call("PATCH", `/channels/${created.channels[0]._id}`, {
          name: "side-rooms",
        });
        const voice = await add("side-voice", "Voice");
        const inside = await add("side-inside", "Text");
        await call("PATCH", `/servers/${id}`, {
          categories: [
            {
              id: "01M6SIDE0000000000000000AA",
              title: "Side",
              channels: [voice._id, inside._id],
            },
          ],
        });
        await openChannelList(page, id);
        same(
          await heading(page, L, "Text channels").count(),
          1,
          "Text heading with a room in it",
        );
        same(
          await heading(page, L, "Voice channels").count(),
          0,
          "empty Voice heading",
        );
        await page.screenshot({ path: shot(`${tag}-sidebar-mixed`) });

        // every room in categories: neither heading
        await call("PATCH", `/servers/${id}`, {
          categories: [
            {
              id: "01M6SIDE0000000000000000AA",
              title: "Side",
              channels: [created.channels[0]._id, voice._id, inside._id],
            },
          ],
        });
        await openChannelList(page, id);
        same(
          await heading(page, L, "Text channels").count(),
          0,
          "empty Text heading",
        );
        same(
          await heading(page, L, "Voice channels").count(),
          0,
          "empty Voice heading",
        );
        await page.screenshot({ path: shot(`${tag}-sidebar-categorised`) });

        // a drag shows the hidden groups, and a room can go back to one
        if (page.viewportSize().width >= 600) {
          const row = await page
            .getByText("side-inside", { exact: true })
            .first()
            .boundingBox();
          const list = await page
            .getByText("side-rooms", { exact: true })
            .first()
            .boundingBox();
          await page.mouse.move(row.x + 8, row.y + 8);
          await page.mouse.down();
          await page.mouse.move(row.x + 12, row.y - 10, { steps: 6 });
          await page.mouse.move(list.x + 8, list.y - 30, { steps: 12 });
          await page.waitForTimeout(400);
          same(
            await heading(page, L, "Text channels").count(),
            1,
            "Text heading during a drag",
          );
          same(
            await heading(page, L, "Voice channels").count(),
            1,
            "Voice heading during a drag",
          );
          await page.screenshot({ path: shot(`${tag}-sidebar-drag`) });
          const zone = await heading(page, L, "Text channels").boundingBox();
          await page.mouse.move(zone.x + 20, zone.y + zone.height + 20, {
            steps: 8,
          });
          await page.waitForTimeout(300);
          await page.mouse.up();
          await page.waitForTimeout(1200);
          const { server } = await readServer(id);
          const moved = await call("GET", `/channels/${inside._id}`);
          same(moved.name, "side-inside", "dragged room");
          if (server.categories[0].channels.includes(inside._id))
            fail("the room did not leave its category");
          same(
            await heading(page, L, "Text channels").count(),
            1,
            "Text heading after the drop",
          );
          same(
            await heading(page, L, "Voice channels").count(),
            0,
            "Voice heading after the drop",
          );
        }

        // the owner can still add a channel: the menu of the list on desktop
        if (page.viewportSize().width >= 600) {
          await page
            .locator("[aria-expanded]")
            .filter({ hasText: exact("Side") })
            .click({ button: "right" });
          await page
            .locator("#floating")
            .getByText(tr(L, "Create channel"), { exact: true })
            .first()
            .waitFor({ timeout: 5000 });
          await page.keyboard.press("Escape");
          await page.mouse.click(700, 400);
        }
        // and the + on any category, by hand, at every size
        const plus = page
          .getByRole("button", { name: tr(L, "Create channel") })
          .first();
        await plus.click();
        await dialog(page).locator('input[name="name"]').fill("side-new");
        await dialog(page)
          .getByRole("button", { name: exact(tr(L, "Create channel")) })
          .click();
        await page
          .waitForURL(/\/channel\//, { timeout: 30000 })
          .catch(() => {});
        await page.waitForTimeout(800);
        const { channels } = await readServer(id);
        if (!channels.some((c) => c.name === "side-new"))
          fail("the new channel was not made");
      } finally {
        await removeServer(id);
      }
    },
  );
}

/** A second real account, as a plain member and then as a moderator */
async function memberRights(browser, page, L, tag) {
  const other = accounts.find((a) => a !== account);
  await report.step(
    `${tag} a member: rules closed, General open, threads and reactions`,
    async () => {
      await openFlow(page, L);
      await pickRow(page, L, "gaming");
      await answer(page, L, "community");
      await create(page, L, "E2E member");
      await page.waitForURL(/\/server\/[0-9A-Z]{26}\/channel\//, {
        timeout: 180000,
      });
      const { id, channel: general } = pageServer(page);
      const member = await token(other);
      const as = async (who, method, path, body) => {
        for (let attempt = 0; ; attempt++) {
          const res = await fetch(`${API}${path}`, {
            method,
            headers: {
              "x-session-token": who,
              ...(body ? { "content-type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
          });
          const text = await res.text();
          const data = text ? JSON.parse(text) : undefined;
          if (res.status === 429 && attempt < 5) {
            await new Promise((r) =>
              setTimeout(r, (data?.retry_after ?? 3000) + 200),
            );
            continue;
          }
          return { status: res.status, data };
        }
      };
      const allowed = async (what, call) => {
        const { status, data } = await call;
        if (status >= 300) fail(`${what}: ${status} ${JSON.stringify(data)}`);
        return data;
      };
      const refused = async (what, call) => {
        const { status, data } = await call;
        if (status < 400 || status === 429) fail(`${what} worked: ${status}`);
        if (data?.type !== "MissingPermission")
          fail(`${what}: ${JSON.stringify(data)}`);
      };
      const post = (who, room, content) =>
        as(who, "POST", `/channels/${room}/messages`, { content });
      const startThread = (who, room, message, name) =>
        as(who, "POST", `/channels/${room}/threads`, { name, message });
      const react = (who, room, message) =>
        as(
          who,
          "PUT",
          `/channels/${room}/messages/${message}/reactions/${encodeURIComponent("👍")}`,
        );
      const memberContext = await login(browser, other, {
        viewport: page.viewportSize(),
        locale: L,
      });
      try {
        const { channels } = await readServer(id);
        const rules = channels.find((c) => c.name === tr(L, "rules"))._id;
        const invite = await allowed(
          "invite",
          as(session, "POST", `/channels/${general}/invites`),
        );
        await allowed("join", as(member, "POST", `/invites/${invite._id}`));

        // what the moderator (here the owner) leaves for members
        const notice = await allowed(
          "owner post",
          post(session, rules, "welcome"),
        );
        const hello = await allowed(
          "owner post",
          post(session, general, "hello"),
        );
        const rulesThread = await allowed(
          "owner thread in rules",
          startThread(session, rules, notice._id, "rules talk"),
        );
        const talk = await allowed(
          "owner thread in General",
          startThread(session, general, hello._id, "general talk"),
        );

        // the member, in the app: writes in General, can't in rules
        const screen = memberContext.page;
        const box = screen.locator('textarea, [contenteditable="true"]').last();
        await screen.goto(`${APP}/server/${id}/channel/${general}`);
        await box.waitFor({ timeout: 60000 });
        await box.click();
        await screen.keyboard.type("from a member");
        await screen.keyboard.press("Enter");
        await screen
          .getByText("from a member")
          .first()
          .waitFor({ timeout: 15000 });
        await screen.goto(`${APP}/server/${id}/channel/${rules}`);
        await screen.getByText("welcome").first().waitFor({ timeout: 60000 });
        await screen.waitForTimeout(800);
        await screen.screenshot({ path: shot(`${tag}-member-rules`) });
        same(
          await screen
            .locator('textarea:not([disabled]), [contenteditable="true"]')
            .count(),
          0,
          "a composer in rules",
        );

        // the same rights through the API
        await refused("posting in rules", post(member, rules, "no"));
        await refused(
          "starting a thread in rules",
          startThread(member, rules, notice._id, "no"),
        );
        await refused(
          "replying in the thread in rules",
          post(member, rulesThread._id, "no"),
        );
        await allowed("reacting in rules", react(member, rules, notice._id));

        const own = await allowed(
          "posting in General",
          post(member, general, "mine"),
        );
        await allowed(
          "starting a thread in General",
          startThread(member, general, own._id, "mine"),
        );
        await allowed(
          "replying in a moderator's thread",
          post(member, talk._id, "yes"),
        );
        await allowed("reacting in General", react(member, general, hello._id));

        // given Moderators, the same person writes in rules
        const role = Object.entries((await readServer(id)).server.roles).find(
          ([, r]) => r.name === tr(L, "Moderators"),
        )[0];
        const me = (await as(member, "GET", "/users/@me")).data._id;
        await allowed(
          "giving the role",
          as(session, "PATCH", `/servers/${id}/members/${me}`, {
            roles: [role],
          }),
        );
        await allowed(
          "a moderator posting in rules",
          post(member, rules, "mod"),
        );
        await allowed(
          "a moderator replying in the rules thread",
          post(member, rulesThread._id, "mod"),
        );
      } finally {
        await memberContext.context.close();
        await as(member, "POST", "/auth/session/logout");
        await removeServer(id);
      }
    },
  );
}

const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
});
let userId;
try {
  session = await token(account);
  const me = await api(session, "GET", "/users/@me");
  userId = me._id;
  for (const id of await leftovers(userId)) await removeServer(id);
  for (const L of want("sweep") && process.argv.length === 3 ? [] : locales) {
    for (const size of sizes) {
      const tag = `${L}-${size}`;
      console.log(`\n${tag}`);
      const { page, context, errors } = await login(browser, account, {
        viewport: VIEWPORTS[size],
        locale: L,
      });
      report.page = page;
      watchCreated(page);
      try {
        if (want("screens"))
          await screens(page, L, tag, me.display_name ?? me.username);
        if (want("paths")) await paths(page, L, tag);
        if (want("failures")) await failures(page, L, tag);
        if (want("sidebar")) await sidebar(page, L, tag);
        if (want("member")) await memberRights(browser, page, L, tag);
        await report.step(`${tag} no page errors`, async () => {
          same(errors, [], "page errors");
        });
      } finally {
        await context.close();
      }
    }
  }
} finally {
  for (const id of [...made]) await removeServer(id);
  if (userId) {
    const left = await leftovers(userId).catch(() => []);
    for (const id of left) await removeServer(id);
    console.log(`
servers left behind: ${left.length}`);
  }
  // this suite's own session; stack.mjs closes the browser sessions on exit.
  // Never close others here: the accounts are shared with other suites.
  if (session)
    await api(session, "POST", "/auth/session/logout").catch(() => {});
  await browser.close();
}
console.log(`\napp ${APP}, api ${API}, screenshots ${shot("")}`);
process.exitCode = report.done() ? 1 : 0;
