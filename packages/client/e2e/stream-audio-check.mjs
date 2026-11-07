// Stream sound for viewers. Needs a stack with voice (LiveKit). A shares a screen
// with sound, B watches. B hears it by default, the button on the stream mutes
// it, the stream volume menu works and 0 % survives a reload. Own server, deleted
// at the end. Seeded accounts 1 and 2. LOCALE=ar|en|de, PHONE=1 for 375 px.
import { tr } from "./lib/catalog.mjs";
import {
  api,
  checks,
  closeSessions,
  deleteServer,
  launch,
  LOCALE,
  PHONE,
  seededAccounts,
  shots,
  signIn,
  token,
  viewport,
} from "./lib/stack.mjs";

const tag = `${LOCALE}${PHONE ? "-phone" : ""}`;
const t = (english) => tr(LOCALE, english);
const shot = shots("stream-audio-check");
const { check, finish } = checks("stream-audio-check", tag);
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const tok = { a: await token(acc.a), b: await token(acc.b) };
const A_HEADERS = { "x-session-token": tok.a };
const { server } = await api(tok.a, "POST", "/servers/create", { name: `Stream audio test (${tag})` });
const S = server._id;
const voiceCh = (await api(tok.a, "POST", `/servers/${S}/channels`, { type: "Text", name: "game", voice: {} }))._id;
const code = (await api(tok.a, "POST", `/channels/${server.channels[0]}/invites`))._id;
await api(tok.b, "POST", `/invites/${code}`);

browser = await launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--autoplay-policy=no-user-gesture-required"],
});
async function open(key) {
  const ctx = await browser.newContext({ viewport: viewport(), locale: LOCALE, colorScheme: "dark", permissions: ["microphone", "camera"] });
  await ctx.addInitScript(() => {
    window.__errors = [];
    addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason?.message ?? e.reason)));
    // a sharer's screen capture with a sound track (a test tone): headless
    // capture has no system audio of its own
    const real = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
    if (real)
      navigator.mediaDevices.getDisplayMedia = async (c) => {
        const stream = await real({ ...c, audio: false });
        if (c?.audio) {
          const ac = new AudioContext();
          const osc = ac.createOscillator();
          const dest = ac.createMediaStreamDestination();
          osc.connect(dest);
          osc.start();
          stream.addTrack(dest.stream.getAudioTracks()[0]);
        }
        return stream;
      };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await signIn(page, acc[key]);
  return { page, errors };
}
const go = async (page, path) => {
  await page.evaluate((p) => { history.pushState({}, "", p); dispatchEvent(new PopStateEvent("popstate")); }, path);
  await page.waitForTimeout(2500);
};
// B's hidden audio elements for A's stream sound (RoomAudioManager)
const streamAudio = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("audio")]
      .filter((a) => a.srcObject && a.srcObject.getAudioTracks().length)
      .map((a) => ({ muted: a.muted, volume: a.volume, paused: a.paused })),
  );

let A, B;
try {
  A = await open("a");
  B = await open("b");

  await check("A joins the voice channel and shares a screen with sound", async () => {
    await go(A.page, `/server/${S}/channel/${voiceCh}`);
    await A.page.locator("[data-join]").first().click({ timeout: 15000 });
    const button = A.page.locator('[data-voice-control="screenshare"]').first();
    await button.waitFor({ timeout: 20000 });
    for (let i = 0; i < 20 && (await button.getAttribute("aria-disabled")) === "true"; i++) await A.page.waitForTimeout(500);
    await button.click();
    await A.page.waitForTimeout(1500);
    await A.page.screenshot({ path: shot(`${tag}-after-share-click`) });
    const goBtn = A.page.getByRole("button", { name: t("Start sharing"), exact: true });
    if (await goBtn.waitFor({ timeout: 5000 }).then(() => true, () => false)) await goBtn.click();
    for (let i = 0; i < 20; i++) {
      if ((await button.getAttribute("aria-pressed")) === "true") return "sharing";
      await A.page.waitForTimeout(500);
    }
    await A.page.screenshot({ path: shot(`${tag}-not-sharing`) });
    throw new Error(`not sharing; errors: ${(await A.page.evaluate(() => window.__errors)).join(" | ")}`);
  });

  await check("B hears the stream sound by default", async () => {
    await go(B.page, `/server/${S}/channel/${voiceCh}`);
    await B.page.locator("[data-join]").first().click({ timeout: 15000 });
    for (let i = 0; i < 40; i++) {
      const audio = await streamAudio(B.page);
      // A's microphone and A's stream sound
      if (audio.length >= 2 && audio.every((a) => !a.muted)) return `${audio.length} audio elements, none muted`;
      await B.page.waitForTimeout(500);
    }
    throw new Error(`audio: ${JSON.stringify(await streamAudio(B.page))}`);
  });

  await check("The sound button on the stream mutes and unmutes it", async () => {
    await B.page.screenshot({ path: shot(`${tag}-b-view`) });
    const tile = B.page.locator("[data-voice-participant]").filter({ has: B.page.locator("video") }).first();
    await tile.hover();
    const sound = B.page.locator("[data-stream-sound]").first();
    await sound.waitFor({ timeout: 8000 });
    expectEq(await sound.getAttribute("data-stream-sound"), "on", "starts on");
    await B.page.screenshot({ path: shot(`${tag}-stream-sound-on`) });
    await sound.click();
    await B.page.waitForTimeout(500);
    const after = await streamAudio(B.page);
    const muted = after.filter((a) => a.muted).length;
    expectEq(await sound.getAttribute("data-stream-sound"), "off", "after click");
    if (muted !== 1) throw new Error(`expected only the stream muted, audio: ${JSON.stringify(after)}`);
    await B.page.screenshot({ path: shot(`${tag}-stream-sound-off`) });
    await sound.click();
    await B.page.waitForTimeout(500);
    if ((await streamAudio(B.page)).some((a) => a.muted)) throw new Error("still muted");
    return "on → off (only the stream muted, A's voice kept) → on";
  });

  await check("Right-click on the stream: stream volume to 0 % stays 0 % after reload", async () => {
    const tile = B.page.locator("[data-voice-participant]").filter({ has: B.page.locator("video") }).first();
    await tile.click({ button: "right" });
    const slider = B.page.getByRole("slider", { name: t("Stream volume"), exact: true });
    await slider.waitFor({ timeout: 8000 });
    await B.page.screenshot({ path: shot(`${tag}-stream-menu`) });
    await slider.evaluate((el) => {
      el.value = "0";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await B.page.waitForTimeout(400);
    const vol = await streamAudio(B.page);
    if (!vol.some((a) => a.volume === 0)) throw new Error(`no audio at volume 0: ${JSON.stringify(vol)}`);
    await B.page.keyboard.press("Escape");
    await B.page.waitForTimeout(1800);
    await B.page.reload();
    await B.page.waitForTimeout(4000);
    const saved = await B.page.evaluate(
      () =>
        new Promise((resolve) => {
          const open = indexedDB.open("localforage");
          open.onsuccess = () => {
            const get = open.result.transaction("keyvaluepairs").objectStore("keyvaluepairs").get("voice");
            get.onsuccess = () => resolve(get.result?.screenShareVolumes ?? null);
          };
        }),
    );
    const value = Object.values(saved ?? {})[0];
    return expectEq(value, 0, "saved stream volume");
  });

  await check("No page errors", async () => {
    const all = [...A.errors, ...B.errors, ...(await A.page.evaluate(() => window.__errors)), ...(await B.page.evaluate(() => window.__errors))];
    if (all.length) throw new Error(all.join(" || "));
    return "none";
  });
} finally {
  await browser?.close();
  await deleteServer(S, acc.a, A_HEADERS);
  await closeSessions();
  finish();
}

function expectEq(got, want, what) {
  if (got !== want) throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  return `${what} = ${JSON.stringify(got)}`;
}
