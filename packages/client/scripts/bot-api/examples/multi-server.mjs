// One bot, many servers: every setting is keyed by server id. `/prefix`
// sets a text-command prefix for this server only.

import { Client, Intents } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
  // privileged: switch it on for the bot in the Developer Portal first
  intents: [Intents.Default, Intents.MessageContent],
});

const MANAGE_SERVER = 1n << 1n;
/** server id → prefix */
const prefixes = new Map();
/** channel id → server id, from Ready and channel events */
const serverOf = new Map();

bot.on("Ready", (event) => {
  for (const channel of event.channels ?? [])
    if (channel.server) serverOf.set(channel._id, channel.server);
});
bot.on(
  "ChannelCreate",
  (channel) => channel.server && serverOf.set(channel._id, channel.server),
);
bot.on("ServerCreate", (event) => {
  // the bot was added to a new server
  for (const channel of event.channels ?? [])
    serverOf.set(channel._id, event.id);
});
bot.on("ServerDelete", (event) => prefixes.delete(event.id));

bot.command("prefix", (i) => {
  if ((BigInt(i.raw.user_permissions) & MANAGE_SERVER) !== MANAGE_SERVER)
    return i.reply({ content: "You need Manage Server.", ephemeral: true });
  prefixes.set(i.serverId, i.option("value"));
  return i.reply({
    content: `Prefix for this server: ${i.option("value")}`,
    ephemeral: true,
  });
});

bot.onMessage((message) => {
  const prefix = prefixes.get(serverOf.get(message.channel)) ?? "!";
  if (message.content === `${prefix}where`) {
    return bot.messages.reply(
      message,
      `This is server ${serverOf.get(message.channel)}.`,
    );
  }
});

await bot.login();
await bot.syncCommands([
  {
    name: "prefix",
    description: "Set the text-command prefix for this server",
    options: [
      {
        type: "String",
        name: "value",
        description: "Prefix",
        required: true,
        max_length: 3,
      },
    ],
  },
]);
console.log("ready");
