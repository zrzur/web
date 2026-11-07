// Focus Timer: rounds of work and breaks. While a round runs it switches its
// own `focusing` setting on, which the manifest binds to Zrzur's quiet
// notifications (no sound, no previews). The plugin never sees a
// notification itself.

let locale = zrzur.locale;
function t(key, vars) {
  const locales = zrzur.manifest.locales || {};
  const table = (locales[locale] || locales[locale.split("-")[0]] || {}).strings || {};
  let text = table[key] || locales.en.strings[key] || key;
  for (const name in vars || {}) text = text.replace(`{${name}}`, vars[name]);
  return text;
}

/** phase: idle | work | break; `left` is kept while paused */
let state = { phase: "idle", endsAt: 0, left: 0, paused: false };
let timer = null;
let settings = { work_minutes: 25, break_minutes: 5, quiet: true };

const minutesLeft = () =>
  Math.max(1, Math.ceil((state.paused ? state.left : state.endsAt - Date.now()) / 60000));
const today = () => new Date().toISOString().slice(0, 10);

async function roundsToday() {
  const saved = (await zrzur.storage.get("rounds")) || {};
  return saved.day === today() ? saved.count : 0;
}

async function setFocusing(on) {
  await zrzur.settings.set("focusing", Boolean(on && settings.quiet));
}

function schedule() {
  clearTimeout(timer);
  if (state.phase === "idle" || state.paused) return;
  timer = setTimeout(finishPhase, Math.max(0, state.endsAt - Date.now()));
}

async function finishPhase() {
  if (state.phase === "work") {
    const count = (await roundsToday()) + 1;
    await zrzur.storage.set("rounds", { day: today(), count });
    state = { phase: "break", endsAt: Date.now() + settings.break_minutes * 60000, left: 0, paused: false };
    await setFocusing(false);
    await zrzur.notifications.show(t("break_now", { m: settings.break_minutes }));
  } else {
    state = { phase: "idle", endsAt: 0, left: 0, paused: false };
    await zrzur.notifications.show(t("back"));
  }
  schedule();
  await showPanel();
}

async function toggle() {
  if (state.phase === "idle") {
    state = { phase: "work", endsAt: Date.now() + settings.work_minutes * 60000, left: 0, paused: false };
    await setFocusing(true);
    await zrzur.notifications.show(t("started", { m: settings.work_minutes }));
  } else if (state.paused) {
    state = { ...state, paused: false, endsAt: Date.now() + state.left };
    await setFocusing(state.phase === "work");
  } else {
    state = { ...state, paused: true, left: state.endsAt - Date.now() };
    await setFocusing(false);
  }
  schedule();
  await showPanel();
}

async function reset() {
  state = { phase: "idle", endsAt: 0, left: 0, paused: false };
  schedule();
  await setFocusing(false);
  await showPanel();
}

async function showPanel() {
  const line =
    state.phase === "idle"
      ? t("idle")
      : state.paused
        ? t("paused", { m: minutesLeft() })
        : t(state.phase, { m: minutesLeft() });
  const action = state.phase === "idle" ? t("start") : state.paused ? t("resume") : t("pause");
  await zrzur.ui.showPanel({
    title: t("title"),
    blocks: [
      { type: "heading", text: line },
      { type: "text", text: t("today", { n: await roundsToday() }) },
      { type: "divider" },
      { type: "button", label: action, handler: "toggle" },
      { type: "button", label: t("reset"), handler: "reset" },
    ],
  });
}

zrzur.commands.register("toggle", toggle);
zrzur.commands.register("status", showPanel);
zrzur.commands.register("reset", reset);
zrzur.ui.onButton("toggle", toggle);
zrzur.ui.onButton("reset", reset);
zrzur.events.on("app.locale_change", (event) => {
  locale = event.locale;
});
zrzur.settings.onChange((values) => {
  settings = { ...settings, ...values };
});
zrzur.onDeactivate(() => setFocusing(false));

zrzur.settings.get().then((values) => {
  settings = { ...settings, ...values };
  // a reload or update ends any round: notifications must not stay quiet
  if (values.focusing) setFocusing(false);
});
