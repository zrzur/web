// Hello World with @zrzur/sdk/bot.
//
//   ZRZUR_BOT_TOKEN=... ZRZUR_API_URL=https://api.zrzur.com \
//   ZRZUR_WS_URL=wss://ws.zrzur.com node hello.mjs

import { Client } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

bot.command("hello", (i) =>
  i.reply(`Hello, ${i.user.display_name ?? i.user.username}!`),
);

await bot.login();
await bot.syncCommands([{ name: "hello", description: "Say hello" }]);
console.log(`ready as ${bot.user.username}`);
