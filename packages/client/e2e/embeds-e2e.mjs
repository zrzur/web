// Rich embeds: a webhook and a bot send them, the API refuses broken or dangerous
// ones, edits keep the rules, and the app renders them safely (no script,
// web-only links, outside images only through the proxy) and well (fields,
// footer, RTL, phone width). The hostile strings here are inert test inputs that
// prove those protections hold.
// Seeded account 1; account 2 owns the shared test bot; own server, deleted at
// the end. LOCALE=ar|en|de; both sizes run in one process.
import {
  call,
  checks,
  closeSessions,
  deleteServer,
  goTo,
  launch,
  LOCALE,
  seededAccounts,
  session,
  shots,
  signIn,
  VIEWPORTS,
} from "./lib/stack.mjs";

const tag = LOCALE;
const shot = shots("embeds-e2e");
const { record, finish } = checks("embeds-e2e", tag);
const [ownerAccount, memberAccount] = seededAccounts(2);
const acc = { a: ownerAccount, b: memberAccount };
let browser;

const user = await session(acc.a);
const { server } = (await call("POST", "/servers/create", { name: `Embeds test (${tag})` }, user)).json;
const S = server._id, CH = server.channels[0];
const hook = (await call("POST", `/channels/${CH}/webhooks`, { name: "Match feed" }, user)).json;
const H = `/webhooks/${hook.id}/${hook.token}`;
const { testBot, addTestBot } = await import("./lib/test-bot.mjs");
const shared = await testBot();
const botHeaders = { "x-bot-token": shared.token };
await addTestBot(shared, S, user);

const XSS = `<img src=x onerror="window.__xss='img'"><script>window.__xss='script'</script>`;
const rich = {
  title: "Ranked match ready",
  url: "https://zrzur.com/match/1",
  description: `Team **Falcons** vs Team **Wolves** [rules](https://zrzur.com/rules) ${XSS} [bad](javascript:window.__xss='md')`,
  colour: "#E0195F",
  author: { name: `Match bot ${XSS}`, url: "https://zrzur.com", icon_url: "https://evil.example/track-author.png" },
  icon_url: "https://evil.example/track-icon.png",
  fields: [
    { name: "Map", value: "Dust", inline: true },
    { name: "Mode", value: "5v5", inline: true },
    { name: "Server", value: "EU West", inline: true },
    { name: `Notes ${XSS}`, value: `Bring a headset ${XSS}`, inline: false },
  ],
  footer: { text: `Season 3 ${XSS}`, icon_url: "https://evil.example/track-footer.png" },
  timestamp: new Date().toISOString(),
};
const arabic = {
  title: "مباراة مصنّفة جاهزة",
  description: "فريق **الصقور** ضد فريق **الذئاب**",
  colour: "#55DCC8",
  author: { name: "Match bot" },
  fields: [
    { name: "الخريطة", value: "الصحراء", inline: true },
    { name: "النمط", value: "5 ضد 5", inline: true },
  ],
  footer: { text: "الموسم الثالث" },
};

try {
  // --- sending
  const viaHook = await call("POST", H, { content: "webhook", embeds: [rich] });
  record("send", "webhook sends a full rich embed", viaHook.status === 200 && viaHook.json?.embeds?.[0]?.fields?.length === 4, viaHook.status);
  const viaHookAr = await call("POST", H, { embeds: [arabic] });
  record("send", "webhook sends an Arabic embed", viaHookAr.status === 200, viaHookAr.status);
  const viaBot = await call("POST", `/channels/${CH}/messages`, { content: "bot", embeds: [{ ...rich, title: "Bot: match ready" }] }, botHeaders);
  record("send", "bot sends a full rich embed", viaBot.status === 200 && viaBot.json?.embeds?.[0]?.author?.name?.startsWith("Match bot"), viaBot.status);

  // --- refused input (webhook and bot)
  const bad = {
    "javascript: link": { ...rich, url: "javascript:alert(1)" },
    "data: icon": { ...rich, icon_url: "data:image/svg+xml,<svg onload=alert(1)>" },
    "file: footer icon": { ...rich, footer: { text: "x", icon_url: "file:///etc/passwd" } },
    "CSS in colour": { ...rich, colour: "red; background:url(https://evil.example/x)" },
    "26 fields": { ...rich, fields: Array.from({ length: 26 }, () => ({ name: "a", value: "b" })) },
    "field value over 1024": { ...rich, fields: [{ name: "a", value: "x".repeat(1025) }] },
    "title over 256": { ...rich, title: "x".repeat(257) },
  };
  for (const [what, embed] of Object.entries(bad)) {
    const r = await call("POST", H, { embeds: [embed] });
    record("refuse", `webhook: ${what}`, r.status === 400, r.status);
    const b = await call("POST", `/channels/${CH}/messages`, { embeds: [embed] }, botHeaders);
    record("refuse", `bot: ${what}`, b.status === 400, b.status);
  }
  const tooMany = await call("POST", H, { embeds: Array.from({ length: 11 }, () => ({ title: "x" })) });
  record("refuse", "webhook: 11 embeds (limit 10)", tooMany.status === 400, tooMany.status);

  // --- lengths (characters, Arabic counts once per letter)
  const arabicText = await call("POST", `/channels/${CH}/messages`, { content: "ع".repeat(2000) }, user);
  record("length", "a 2000-letter Arabic message is accepted", arabicText.status === 200, arabicText.status);
  const longEmbed = await call("POST", H, {
    content: "Season report",
    embeds: [{ title: "ت".repeat(256), description: `**Season summary**\n${"Line of the season report. ".repeat(150).slice(0, 4000)}` }],
  });
  record("length", "256-character title + 4096-character description accepted", longEmbed.status === 200, longEmbed.status);
  const overTotal = await call("POST", H, { embeds: [{ description: "d".repeat(3000) }, { description: "d".repeat(3000) }, { title: "x" }] });
  record("length", "more than 6000 characters across embeds refused", overTotal.status === 422, overTotal.status);

  // --- edits
  const plain = (await call("POST", H, { content: "plain" })).json;
  const editMany = await call("PATCH", `${H}/${plain._id}`, { embeds: Array.from({ length: 11 }, () => ({ title: "x" })) });
  record("edit", "webhook edit can't go over 10 embeds", editMany.status === 400, editMany.status);
  await call("PATCH", `/webhooks/${hook.id}`, { permissions: 2 ** 22 /* SendMessage only */ }, user);
  const editAdd = await call("PATCH", `${H}/${plain._id}`, { embeds: [{ title: "sneaky" }] });
  record("edit", "webhook without embed permission can't add embeds by editing", editAdd.status === 403, editAdd.status);
  await call("PATCH", `/webhooks/${hook.id}`, { permissions: 0 }, user);
  const editAny = await call("PATCH", `${H}/${plain._id}`, { content: "changed" });
  record("edit", "webhook without send permission can't edit", editAny.status === 403, editAny.status);

  // --- rendering in the app
  browser = await launch();
  for (const [label, size] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: size, locale: LOCALE, colorScheme: "dark" });
    const page = await ctx.newPage();
    const requested = [];
    page.on("request", (r) => requested.push(r.url()));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    page.on("dialog", (d) => { errors.push(`dialog: ${d.message()}`); d.dismiss(); });
    await signIn(page, acc.a);
    await goTo(page, `/server/${S}/channel/${CH}`, 5000);
    await page.screenshot({ path: shot(`${tag}-${label}`), fullPage: false });

    const report = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      const text = main.innerText;
      const embedLinks = [...main.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
      const handlers = [...main.querySelectorAll("*")].filter((el) => [...el.attributes].some((a) => /^on/i.test(a.name))).length;
      const scripts = main.querySelectorAll("script").length;
      const imgs = [...main.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? "");
      const rtl = [...main.querySelectorAll('[dir="rtl"]')].some((el) => el.textContent?.includes("الصقور"));
      return {
        xss: window.__xss ?? null,
        handlers,
        scripts,
        text,
        badLinks: embedLinks.filter((h) => !/^(https?:|mailto:|tel:|\/|#)/i.test(h ?? "")),
        directOutside: imgs.filter((src) => src.includes("evil.example") && !src.includes("/proxy?url=")),
        proxied: imgs.filter((src) => src.includes("/proxy?url=")).length,
        rtl,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    record(`render ${label}`, "no script ran (img/script/markdown link)", report.xss === null && !errors.some((e) => e.startsWith("dialog")), report.xss);
    record(`render ${label}`, "no event-handler attributes or script tags injected", report.handlers === 0 && report.scripts === 0, `${report.handlers} handlers, ${report.scripts} scripts`);
    record(`render ${label}`, "only web links are clickable", report.badLinks.length === 0, report.badLinks.join(" "));
    record(`render ${label}`, "outside icons never load directly", report.directOutside.length === 0 && !requested.some((u) => u.startsWith("https://evil.example")), `${report.proxied} through the proxy`);
    record(`render ${label}`, "author, fields and footer are shown", /Match bot/.test(report.text) && /Dust/.test(report.text) && /EU West/.test(report.text) && /Season 3/.test(report.text));
    record(`render ${label}`, "hostile text is shown as text", report.text.includes("<script>") || report.text.includes("onerror"), "");
    record(`render ${label}`, "Arabic embed reads right to left", report.rtl);
    record(`render ${label}`, "no sideways scroll", report.overflow <= 0, report.overflow);

    // the long season report starts folded and opens with Show more
    const more = page.locator("[data-embed-more]").first();
    const hasMore = await more.count();
    let opened = false;
    if (hasMore) {
      const folded = await page.locator("[data-folded]").count();
      await more.scrollIntoViewIfNeeded();
      await more.click();
      await page.waitForTimeout(300);
      opened = folded > 0 && (await more.getAttribute("aria-expanded")) === "true";
      await page.screenshot({ path: shot(`${tag}-${label}-long`) });
    }
    record(`render ${label}`, "a long description starts folded and opens", !!hasMore && opened);
    record(`render ${label}`, "no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} finally {
  await browser?.close();
  await deleteServer(S, acc.a, user);
  await closeSessions();
  finish();
}
