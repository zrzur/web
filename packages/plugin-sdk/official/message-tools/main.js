// Message Tools: the plugin only sees a message when you pick one of its
// actions on it. Time stamps use Zrzur's <t:unix:format> syntax, which
// every reader sees in their own time zone and language.

const locale = zrzur.locale;
function t(key, vars) {
  const locales = zrzur.manifest.locales || {};
  const table = (locales[locale] || locales[locale.split("-")[0]] || {}).strings || {};
  let text = table[key] || locales.en.strings[key] || key;
  for (const name in vars || {}) text = text.replace(`{${name}}`, vars[name]);
  return text;
}

const MAX = 1800; // room for the quote marks inside the 2000 character limit

zrzur.messageActions.register("quote", async (message) => {
  const text = message.content.trim();
  if (!text) return zrzur.notifications.show(t("empty"));
  const quoted = text
    .slice(0, MAX)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  await zrzur.composer.insert(`${quoted}\n**${message.author_name}**\n`);
});

zrzur.messageActions.register("stats", async (message) => {
  const text = message.content.trim();
  if (!text) return zrzur.notifications.show(t("empty"));
  const words = text.split(/\s+/).filter(Boolean).length;
  // about 200 words a minute; Arabic reads a little slower
  const perMinute = /[؀-ۿ]/.test(text) ? 160 : 200;
  const seconds = Math.max(1, Math.round((words / perMinute) * 60));
  const read = seconds < 60 ? t("seconds", { n: seconds }) : t("minutes", { n: Math.round(seconds / 60) });
  await zrzur.notifications.show(t("stats", { w: words, c: [...text].length, r: read }));
});

zrzur.messageActions.register("code", async (message) => {
  const text = message.content.trim();
  if (!text) return zrzur.notifications.show(t("empty"));
  // a fence longer than any run of backticks inside keeps the text intact
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  await zrzur.composer.insert(`${fence}\n${text.slice(0, MAX)}\n${fence}\n`);
});

zrzur.messageActions.register("time", async (message) => {
  const ms = Date.now() - message.created_at;
  const minutes = Math.round(ms / 60000);
  const ago =
    minutes < 1
      ? t("seconds", { n: Math.max(1, Math.round(ms / 1000)) })
      : minutes < 120
        ? t("minutes", { n: minutes })
        : minutes < 2880
          ? t("hours", { n: Math.round(minutes / 60) })
          : t("days", { n: Math.round(minutes / 1440) });
  const date = new Date(message.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  await zrzur.notifications.show(t("sent", { ago, date }));
});

const stamp = (ms, format) => `<t:${Math.floor(ms / 1000)}:${format}>`;
zrzur.commands.register("now", () => zrzur.composer.insert(stamp(Date.now(), "t")));
zrzur.commands.register("in-hour", () => zrzur.composer.insert(stamp(Date.now() + 3600000, "R")));
zrzur.commands.register("tomorrow", () => zrzur.composer.insert(stamp(Date.now() + 86400000, "F")));
