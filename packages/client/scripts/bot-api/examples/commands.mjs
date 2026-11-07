// Slash commands with options, private replies, deferred answers and
// autocomplete.

import { Client } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

const FRUITS = ["apple", "apricot", "banana", "cherry", "date", "fig", "grape"];

// /roll sides: the server enforces min_value and max_value
bot.command("roll", (i) => {
  const sides = i.option("sides") ?? 6;
  return i.reply(`🎲 ${1 + Math.floor(Math.random() * sides)} (d${sides})`);
});

// /secret text: only the person who asked sees the answer
bot.command("secret", (i) =>
  i.reply({
    content: `Only you can see this: ${i.option("text")}`,
    ephemeral: true,
  }),
);

// /slow: work that takes longer than 3 seconds
bot.command("slow", async (i) => {
  await i.defer();
  await new Promise((resolve) => setTimeout(resolve, 4000));
  await i.editReply("Done after 4 seconds.");
});

// /fruit name: suggestions while the user types
bot.command("fruit", (i) => i.reply(`You picked ${i.option("name")}.`));
bot.autocomplete("fruit", "name", (i) =>
  FRUITS.filter((f) => f.startsWith(String(i.focused?.value ?? ""))).map(
    (f) => ({ name: f, value: f }),
  ),
);

await bot.login();
await bot.syncCommands([
  {
    name: "roll",
    description: "Roll a die",
    options: [
      {
        type: "Integer",
        name: "sides",
        description: "Number of sides",
        min_value: 2,
        max_value: 100,
      },
    ],
  },
  {
    name: "secret",
    description: "Answer only you can see",
    options: [
      { type: "String", name: "text", description: "Text", required: true },
    ],
  },
  { name: "slow", description: "A command that takes a while" },
  {
    name: "fruit",
    description: "Pick a fruit",
    options: [
      {
        type: "String",
        name: "name",
        description: "Fruit",
        required: true,
        autocomplete: true,
      },
    ],
  },
]);
console.log("ready");
