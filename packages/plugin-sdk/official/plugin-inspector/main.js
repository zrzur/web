// Plugin Inspector: diagnostics are only answered by development builds;
// elsewhere the panel says so instead of failing.

let locale = zrzur.locale;
function t(key, vars) {
  const locales = zrzur.manifest.locales || {};
  const table = (locales[locale] || locales[locale.split("-")[0]] || {}).strings || {};
  let text = table[key] || locales.en.strings[key] || key;
  for (const name in vars || {}) text = text.replace(`{${name}}`, vars[name]);
  return text;
}

const events = [];
function remember(text) {
  const time = new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  events.unshift(`${time} · ${text}`);
  events.length = Math.min(events.length, 8);
  zrzur.log(text);
}

zrzur.events.on("channel.switch", (e) => remember(`channel.switch ${e.name || e.channel_id}`));
zrzur.events.on("app.locale_change", (e) => {
  locale = e.locale;
  remember(`app.locale_change ${e.locale}`);
});
zrzur.events.on("app.theme_change", () => remember("app.theme_change"));

async function inspect() {
  const blocks = [];
  try {
    const info = await zrzur.diagnostics.get();
    blocks.push({ type: "heading", text: t("version", { v: info.app_version, p: info.platform }) });
    for (const p of info.plugins.slice(0, 15)) {
      blocks.push({
        type: "text",
        text: t("row", { id: p.id, s: p.status, ms: Math.round(p.activation_ms || 0), c: p.calls, e: p.errors }),
      });
    }
  } catch {
    blocks.push({ type: "text", text: t("dev_only") });
  }
  blocks.push({ type: "divider" }, { type: "heading", text: t("events") });
  if (events.length) for (const line of events) blocks.push({ type: "text", text: line });
  else blocks.push({ type: "text", text: t("no_events") });
  blocks.push({ type: "divider" }, { type: "button", label: t("refresh"), handler: "refresh" });
  await zrzur.ui.showPanel({ title: t("title"), blocks });
}

zrzur.commands.register("inspect", inspect);
zrzur.ui.onButton("refresh", inspect);
