// Keyboard shortcuts page (Ctrl+/) and push to talk. Needs a stack with voice
// (LiveKit). Own server, deleted at the end. The microphone check reads the real
// capture track from a fake device: LiveKit disables the track while muted, so
// `enabled` tells whether we send.
// Seeded account 1. LOCALE=ar|en|de, PHONE=1 for 375 px.
import { tr } from "./lib/catalog.mjs";
import {
  api,
  checks,
  closeSessions,
  deleteServer,
  goTo,
  launch,
  LOCALE,
  PHONE,
  seededAccounts,
  shots,
  signIn,
  sleep,
  token,
  viewport,
} from "./lib/stack.mjs";

const tag = `${LOCALE}${PHONE ? "-phone" : ""}`;
const t = (english) => tr(LOCALE, english);
const shot = shots("shortcuts-check");
const { check, finish } = checks("shortcuts-check", tag);
const [ownerAccount] = seededAccounts(1);
const acc = { a: ownerAccount };
const expectEq = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  return `${what} = ${JSON.stringify(got)}`;
};

const session = await token(acc.a);
const { server } = await api(session, "POST", "/servers/create", { name: `Shortcuts test (${tag})` });
const S = server._id;
const voiceCh = (await api(session, "POST", `/servers/${S}/channels`, { type: "Text", name: "talk", voice: {} }))._id;

const browser = await launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ viewport: viewport(), locale: LOCALE, colorScheme: "dark", permissions: ["microphone", "camera"] });
await ctx.addInitScript(() => {
  // keep every captured microphone track to read its state later
  window.__mics = [];
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    const stream = await real(c);
    window.__mics.push(...stream.getAudioTracks());
    return stream;
  };
  window.__errors = [];
  addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason?.message ?? e.reason)));
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));

// sending = a live microphone track that is enabled
const sending = () => page.evaluate(() => window.__mics.some((t) => t.readyState === "live" && t.enabled));
async function waitSending(want, ms = 4000) {
  for (let i = 0; i < ms / 100; i++) {
    if ((await sending()) === want) return true;
    await sleep(100);
  }
  return false;
}
const blur = () => page.evaluate(() => (document.activeElement)?.blur?.());
const mod = "Control";
// the saved voice settings, as the app stores them (localforage → IndexedDB)
const savedVoice = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("localforage");
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          try {
            const get = open.result.transaction("keyvaluepairs").objectStore("keyvaluepairs").get("voice");
            get.onsuccess = () => resolve(get.result ?? null);
            get.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        };
      }),
  );
// the Input mode select: the control labelled by that row title
async function modeSelect() {
  const title = page.locator("[data-row-title]").filter({ hasText: t("Input mode") }).first();
  await title.waitFor({ timeout: 8000 });
  return page.locator(`[aria-labelledby="${await title.getAttribute("id")}"]`).first();
}

try {
  await signIn(page, acc.a);
  await page.waitForTimeout(4000);

  await check("Ctrl+/ opens the shortcuts page", async () => {
    await blur();
    await page.keyboard.press(`${mod}+Slash`);
    await page.getByText(t("Keyboard shortcuts"), { exact: true }).first().waitFor({ timeout: 8000 });
    await page.getByText(t("Mute or unmute"), { exact: true }).first().waitFor({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot(`${tag}-shortcuts`) });
    const caps = await page.locator("kbd").allInnerTexts();
    if (!(caps.includes("Ctrl") || caps.includes("Strg")) || !caps.includes("M")) throw new Error(`key caps: ${caps.join(" ")}`);
    return `${caps.length} key caps shown`;
  });

  await check("Push to talk: turn on and choose B", async () => {
    await page.getByText(t("Turn it on and choose the key in voice settings."), { exact: true }).first().click();
    await page.getByText(t("Input mode"), { exact: true }).first().waitFor({ timeout: 8000 });
    // the select sits in the "Input mode" row
    const select = await modeSelect();
    await select.click();
    await page.getByRole("menuitem", { name: t("Push to talk"), exact: true }).first().click();
    await page.getByText(t("Push-to-talk key"), { exact: true }).first().waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: t("Change key"), exact: true }).click();
    await page.getByText(t("Press a key…"), { exact: true }).first().waitFor({ timeout: 3000 });
    await page.keyboard.press("Enter");
    await page.getByText(t("That key is needed elsewhere. Press another key, or Esc to cancel.")).first().waitFor({ timeout: 3000 });
    await page.keyboard.press("KeyB");
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot(`${tag}-ptt-settings`) });
    // settings reach IndexedDB (localforage) after a short delay
    await page.waitForTimeout(1600);
    const voice = await savedVoice();
    expectEq(voice?.inputMode, "ptt", "saved mode");
    return expectEq(voice?.pttKey, "KeyB", "saved key");
  });

  await check("Esc while choosing cancels and keeps settings open", async () => {
    await page.getByRole("button", { name: t("Change key"), exact: true }).click();
    await page.getByText(t("Press a key…"), { exact: true }).first().waitFor({ timeout: 3000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.getByText(t("Push-to-talk key"), { exact: true }).first().waitFor({ timeout: 2000 });
    const cap = await page.locator("kbd").filter({ hasText: /^B$/ }).count();
    if (!cap) throw new Error("key changed or vanished");
    return "still B, settings still open";
  });

  await check("A change survives an immediate reload (V, then reload at once)", async () => {
    await page.getByRole("button", { name: t("Change key"), exact: true }).click();
    await page.getByText(t("Press a key…"), { exact: true }).first().waitFor({ timeout: 3000 });
    await page.keyboard.press("KeyV");
    await page.reload();
    await page.waitForTimeout(5000);
    await blur();
    await page.keyboard.press(`${mod}+Slash`);
    await page.getByText(t("Keyboard shortcuts"), { exact: true }).first().waitFor({ timeout: 8000 });
    const caps = await page.locator("kbd").allInnerTexts();
    if (!caps.includes("V")) throw new Error(`no V cap: ${caps.slice(0, 6).join(" ")}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    return "On, V";
  });

  await check("Joined the call with push to talk: silent until the key is held", async () => {
    await goTo(page, `/server/${S}/channel/${voiceCh}`, 2500);
    await page.locator("[data-join]").first().click({ timeout: 15000 });
    await page.locator('[data-voice-control="microphone"]').first().waitFor({ timeout: 20000 });
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__mics.length)); i++) await sleep(250);
    await page.waitForTimeout(1500);
    if (!(await page.evaluate(() => window.__mics.length))) throw new Error("no microphone captured");
    const silent = await waitSending(false);
    const pressed = await page.locator('[data-voice-control="microphone"]').first().getAttribute("aria-pressed");
    if (!silent) throw new Error("microphone sends without the key");
    return `not sending; mute button aria-pressed=${pressed} (should be false: not muted)`;
  });

  await check("Holding V sends, releasing stops", async () => {
    await blur();
    await page.keyboard.down("KeyV");
    const t0 = Date.now();
    const on = await waitSending(true);
    const firstPressMs = Date.now() - t0;
    await page.screenshot({ path: shot(`${tag}-ptt-held`) });
    await page.keyboard.up("KeyV");
    const off = await waitSending(false);
    if (!on) throw new Error("did not send while held");
    if (!off) throw new Error("kept sending after release");
    return `on while held (first press sending after ~${firstPressMs} ms, 100 ms polling), off after`;
  });

  await check("Holding V while typing in a text box does not send", async () => {
    // the text channel; the call stays connected while browsing
    await goTo(page, `/server/${S}/channel/${server.channels[0]}`, 2500);
    const box = page.locator('[contenteditable="true"]').first();
    await box.waitFor({ timeout: 10000 });
    await box.click();
    await page.keyboard.down("KeyV");
    await sleep(800);
    const s = await sending();
    await page.keyboard.up("KeyV");
    const typed = await box.innerText();
    await page.keyboard.press("Backspace");
    if (s) throw new Error("sent while typing");
    if (!/v/i.test(typed)) throw new Error(`the letter did not reach the box: "${typed}"`);
    await page.evaluate((p) => { history.pushState({}, "", p); dispatchEvent(new PopStateEvent("popstate")); }, `/server/${S}/channel/${voiceCh}`);
    await page.locator('[data-voice-control="microphone"]').first().waitFor({ timeout: 10000 });
    return "not sent, and the letter reached the message box";
  });

  await check("Ctrl+Shift+M mutes: push to talk then stays silent", async () => {
    await blur();
    await page.keyboard.press(`${mod}+Shift+KeyM`);
    await page.waitForTimeout(600);
    const muted = await page.locator('[data-voice-control="microphone"]').first().getAttribute("aria-pressed");
    await page.keyboard.down("KeyV");
    await sleep(800);
    const s = await sending();
    await page.keyboard.up("KeyV");
    expectEq(muted, "true", "mute button pressed");
    if (s) throw new Error("sent while muted");
    await page.keyboard.press(`${mod}+Shift+KeyM`);
    await page.waitForTimeout(600);
    return expectEq(await page.locator('[data-voice-control="microphone"]').first().getAttribute("aria-pressed"), "false", "unmuted again");
  });

  await check("Ctrl+Shift+D deafens and undeafens", async () => {
    await blur();
    await page.keyboard.press(`${mod}+Shift+KeyD`);
    await page.waitForTimeout(600);
    const on = await page.locator('[data-voice-control="deafen"]').first().getAttribute("aria-pressed");
    await page.keyboard.press(`${mod}+Shift+KeyD`);
    await page.waitForTimeout(600);
    const off = await page.locator('[data-voice-control="deafen"]').first().getAttribute("aria-pressed");
    expectEq(on, "true", "deafened");
    return expectEq(off, "false", "undeafened");
  });

  await check("Back to voice activity: sends without a key", async () => {
    await page.keyboard.press(`${mod}+Slash`);
    await page.getByText(t("Turn it on and choose the key in voice settings."), { exact: true }).first().click();
    const select = await modeSelect();
    await select.click();
    await page.getByRole("menuitem", { name: t("Voice activity"), exact: true }).first().click();
    await page.keyboard.press("Escape");
    if (!(await waitSending(true))) throw new Error("not sending in voice activity mode");
    return "sending";
  });

  await check("No page errors", async () => {
    const rej = await page.evaluate(() => window.__errors);
    if (errors.length || rej.length) throw new Error([...errors, ...rej].join(" || "));
    return "none";
  });
} finally {
  await page.locator('[data-voice-control="disconnect"]').first().click({ timeout: 3000 }).catch(() => {});
  await browser.close();
  await deleteServer(S, acc.a, { "x-session-token": session });
  await closeSessions();
  finish();
}
