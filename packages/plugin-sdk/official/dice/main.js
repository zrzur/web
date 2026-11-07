// Dice and Picks: fair random results (crypto, not Math.random), written
// into the message box so the roll is visible to everyone once sent.

const locale = zrzur.locale;
function t(key, vars) {
  const locales = zrzur.manifest.locales || {};
  const table = (locales[locale] || locales[locale.split("-")[0]] || {}).strings || {};
  let text = table[key] || locales.en.strings[key] || key;
  for (const name in vars || {}) text = text.replace(`{${name}}`, vars[name]);
  return text;
}

/** a fair integer from 1 to max, without modulo bias */
function random(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limit);
  return (buffer[0] % max) + 1;
}

let settings = { sides: "d6", count: 1 };
let last = "";
const sidesOf = (dice) => Number(String(dice).slice(1)) || 6;

async function say(text) {
  last = text;
  // one result per line, so several rolls in one message stay readable
  await zrzur.composer.insert(`${text}\n`);
}

async function roll(dice = settings.sides, count = settings.count) {
  const sides = sidesOf(dice);
  const rolls = Array.from({ length: Math.min(10, Math.max(1, count)) }, () => random(sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  await say(t("rolled", { dice: `${rolls.length}${dice}`, rolls: rolls.join(" + "), total }));
}

const coin = () => say(t("coin", { side: random(2) === 1 ? t("heads") : t("tails") }));
const pick = (max) => say(t("pick", { max, n: random(max) }));

async function panel() {
  const blocks = [];
  if (last) blocks.push({ type: "text", text: t("last", { text: last.replace(/\*\*/g, "") }) }, { type: "divider" });
  for (const dice of ["d4", "d6", "d8", "d10", "d12", "d20", "d100"]) {
    blocks.push({ type: "button", label: `🎲 1${dice}`, handler: `roll-${dice}` });
  }
  blocks.push(
    { type: "divider" },
    { type: "button", label: `🪙 ${t("heads")} / ${t("tails")}`, handler: "coin" },
    { type: "button", label: `🎯 ${t("number", { max: 10 })}`, handler: "pick-10" },
    { type: "button", label: `🎯 ${t("number", { max: 100 })}`, handler: "pick-100" },
  );
  await zrzur.ui.showPanel({ title: t("title"), blocks });
}

zrzur.commands.register("roll", () => roll());
zrzur.commands.register("coin", coin);
zrzur.commands.register("panel", panel);
for (const dice of ["d4", "d6", "d8", "d10", "d12", "d20", "d100"]) {
  zrzur.ui.onButton(`roll-${dice}`, () => roll(dice, 1));
}
zrzur.ui.onButton("coin", coin);
zrzur.ui.onButton("pick-10", () => pick(10));
zrzur.ui.onButton("pick-100", () => pick(100));

zrzur.settings.get().then((values) => (settings = { ...settings, ...values }));
zrzur.settings.onChange((values) => (settings = { ...settings, ...values }));
