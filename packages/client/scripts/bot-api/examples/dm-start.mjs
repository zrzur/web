// Bots in direct messages: greet a person who presses Start, read the
// payload of the bot link they came from, and answer with a button.
// Open the conversation with a link like https://zrzur.cc/b/BOT_ID?start=spring-sale

import { Client } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

bot.on("start", (i) => {
  // the `?start=` of the link, or null when they came another way
  const from = i.startPayload;
  return i.reply({
    content: from
      ? `Welcome! You came from the link "${from}".`
      : "Welcome! Press the button to see what I can do.",
    components: [
      {
        type: "button",
        style: "primary",
        label: "Show tips",
        customId: "tips",
      },
    ],
  });
});

bot.component("tips", (i) =>
  i.reply({ content: "Tip: type / or press Commands to see my commands." }),
);

bot.command("help", (i) =>
  i.reply({ content: "Press Start, or use the buttons I send you." }),
);

await bot.login();
// global commands: they are listed on the Start screen and under Commands
await bot.syncCommands([{ name: "help", description: "What this bot does" }]);
console.log("ready");
