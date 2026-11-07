// Time Tracker: counts the time between channel switches. It only learns
// the id and name of the channel you open (context.channel), keeps totals
// on this device, and forgets them the next day.

const locale = zrzur.locale;
function t(key, vars) {
  const locales = zrzur.manifest.locales || {};
  const table = (locales[locale] || locales[locale.split("-")[0]] || {}).strings || {};
  let text = table[key] || locales.en.strings[key] || key;
  for (const name in vars || {}) text = text.replace(`{${name}}`, vars[name]);
  return text;
}

const today = () => new Date().toISOString().slice(0, 10);
/** an hour away from the screen is not time in a channel */
const MAX_STRETCH = 60 * 60 * 1000;

let current = null; // { id, name, since }
let limit = 120;
let reminded = false;

function duration(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return t("min", { n: minutes });
  return t("hour", { h: Math.floor(minutes / 60), m: minutes % 60 });
}

async function load() {
  const saved = (await zrzur.storage.get("day")) || {};
  return saved.date === today() ? saved : { date: today(), channels: {}, reminded: false };
}

/** add the time spent in the current channel so far */
async function commit() {
  if (!current) return;
  const now = Date.now();
  const spent = Math.min(now - current.since, MAX_STRETCH);
  current.since = now;
  if (spent < 1000) return;
  const day = await load();
  const entry = day.channels[current.id] || { name: current.name, ms: 0 };
  entry.ms += spent;
  if (current.name) entry.name = current.name;
  day.channels[current.id] = entry;
  // keep the 30 busiest channels so the store stays small
  const kept = Object.entries(day.channels).sort((a, b) => b[1].ms - a[1].ms).slice(0, 30);
  day.channels = Object.fromEntries(kept);
  await zrzur.storage.set("day", day);
  const total = kept.reduce((sum, [, c]) => sum + c.ms, 0);
  reminded = day.reminded;
  if (limit > 0 && !reminded && total >= limit * 60000) {
    day.reminded = true;
    await zrzur.storage.set("day", day);
    await zrzur.notifications.show(t("limit", { t: duration(total) }));
  }
}

zrzur.events.on("channel.switch", async (event) => {
  await commit();
  current = { id: event.channel_id, name: event.server_id ? `#${event.name || "…"}` : event.name || t("dm"), since: Date.now() };
});

zrzur.commands.register("report", async () => {
  await commit();
  const day = await load();
  const rows = Object.values(day.channels).sort((a, b) => b.ms - a.ms);
  const total = rows.reduce((sum, c) => sum + c.ms, 0);
  const blocks = rows.length
    ? [
        { type: "heading", text: t("total", { t: duration(total) }) },
        { type: "divider" },
        ...rows.slice(0, 10).map((c) => ({ type: "text", text: `${c.name} · ${duration(c.ms)}` })),
        { type: "divider" },
        { type: "button", label: t("clear"), handler: "clear" },
      ]
    : [{ type: "text", text: t("none") }];
  await zrzur.ui.showPanel({ title: t("title"), blocks });
});

async function clear() {
  await zrzur.storage.set("day", { date: today(), channels: {}, reminded: false });
  if (current) current.since = Date.now();
  await zrzur.ui.showPanel({ title: t("title"), blocks: [{ type: "text", text: t("none") }] });
}
zrzur.commands.register("clear", clear);
zrzur.ui.onButton("clear", clear);

zrzur.settings.get().then((values) => {
  if (typeof values.limit_minutes === "number") limit = values.limit_minutes;
});
zrzur.settings.onChange((values) => {
  if (typeof values.limit_minutes === "number") limit = values.limit_minutes;
});
// save the running stretch now and then, and before the plugin stops
setInterval(commit, 60000);
zrzur.onDeactivate(commit);
