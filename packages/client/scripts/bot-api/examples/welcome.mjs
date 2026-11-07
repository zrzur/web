// Welcome bot: `/welcome-here` picks the channel, new members are greeted
// there. Settings live in memory for the demo; store them in a database in a
// real bot.

import { ApiError, Client, Intents } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
  // privileged: switch it on for the bot in the Developer Portal first
  intents: [Intents.Default, Intents.ServerMembers],
});

const MANAGE_SERVER = 1n << 1n;
/** server id → channel id */
const welcomeChannel = new Map();

bot.command("welcome-here", (i) => {
  if ((BigInt(i.raw.user_permissions) & MANAGE_SERVER) !== MANAGE_SERVER)
    return i.reply({ content: "You need Manage Server.", ephemeral: true });
  welcomeChannel.set(i.serverId, i.channelId);
  return i.reply({
    content: "New members will be welcomed in this channel.",
    ephemeral: true,
  });
});

bot.onMemberJoin(async ({ serverId, userId }) => {
  const channel = welcomeChannel.get(serverId);
  if (!channel || userId === bot.user._id) return;
  try {
    await bot.send(channel, `Welcome <@${userId}>! 👋`);
  } catch (error) {
    // lost the permission to write there: stay quiet
    if (
      !(error instanceof ApiError && error.type === "MissingPermission")
    )
      throw error;
  }
});

await bot.login();
await bot.syncCommands([
  { name: "welcome-here", description: "Welcome new members in this channel" },
]);
console.log("ready");
