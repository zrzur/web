// Quick Replies: the replies live in the plugin's settings (kept with your
// account); a shortcut puts one in the message box. Nothing is ever sent.

/** A translated string from the manifest's `locales.<lang>.strings` */
function t(key, vars) {
  const locales = zrzur.manifest.locales || {};
  const lang = zrzur.locale.split("-")[0];
  const table = (locales[zrzur.locale] || locales[lang] || {}).strings || {};
  let text = table[key] || (locales.en && locales.en.strings[key]) || key;
  for (const name in vars || {}) text = text.replace(`{${name}}`, vars[name]);
  return text;
}

let replies = {};

async function load() {
  replies = await zrzur.settings.get();
}

async function insert(n) {
  await load();
  const text = String(replies[`reply_${n}`] || "").trim();
  if (!text) return zrzur.notifications.show(t("empty", { n }));
  await zrzur.composer.insert(text);
}

for (const n of [1, 2, 3, 4, 5]) {
  zrzur.commands.register(`reply-${n}`, () => insert(n));
  zrzur.ui.onButton(`pick-${n}`, () => insert(n));
}

zrzur.commands.register("list", async () => {
  await load();
  const blocks = [];
  for (const n of [1, 2, 3, 4, 5]) {
    const text = String(replies[`reply_${n}`] || "").trim();
    if (!text) continue;
    const label = text.length > 55 ? `${text.slice(0, 54)}…` : text;
    blocks.push({ type: "button", label: `${n}. ${label}`, handler: `pick-${n}` });
  }
  if (!blocks.length) blocks.push({ type: "text", text: t("none") });
  else blocks.unshift({ type: "text", text: t("hint") }, { type: "divider" });
  await zrzur.ui.showPanel({ title: t("title"), blocks });
});

zrzur.settings.onChange((values) => {
  replies = values;
});
load();
