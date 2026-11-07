// Production shape: configuration from the environment, a health endpoint
// for the process manager, and a clean shutdown on SIGTERM.

import { createServer } from "node:http";

import { Client } from "@zrzur/sdk/bot";

for (const name of ["ZRZUR_BOT_TOKEN", "ZRZUR_API_URL", "ZRZUR_WS_URL"]) {
  if (!process.env[name]) {
    console.error(`${name} is not set`);
    process.exit(2);
  }
}

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

let ready = false;
bot.on("Ready", () => (ready = true));
bot.on("Disconnected", () => (ready = false));

bot.command("hello", (i) => i.reply("Hello!"));

// /healthz answers 200 once connected; bind to loopback only
const health = createServer((request, response) => {
  if (request.url === "/healthz")
    return response.writeHead(ready ? 200 : 503).end(ready ? "ok" : "starting");
  response.writeHead(404).end();
});
health.listen(Number(process.env.HEALTH_PORT ?? 8080), "127.0.0.1");

async function shutdown() {
  health.close();
  bot.destroy();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await bot.login();
await bot.syncCommands([{ name: "hello", description: "Say hello" }]);
console.log("ready");
