// Gateway events: answer "!ping", log reactions and members leaving.

import { Client, Intents } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
  // privileged: switch it on for the bot in the Developer Portal first
  intents: [Intents.Default, Intents.MessageContent],
});

// Message: every new message in a channel the bot can see (its own are skipped)
bot.onMessage(async (message) => {
  if (message.content !== "!ping") return;
  await bot.typing(message.channel);
  const started = Date.now();
  const reply = await bot.messages.reply(message, "pong");
  await bot.messages.edit(
    message.channel,
    reply._id,
    `pong (${Date.now() - started} ms)`,
  );
});

// MessageReact: someone added a reaction
bot.onReaction(({ messageId, userId, emoji }) => {
  console.log(`reaction ${emoji} by ${userId} on ${messageId}`);
});

// Any other event by its type name
bot.on("ServerMemberLeave", (event) =>
  console.log(`member ${event.user} left ${event.id}`),
);

await bot.login();
console.log("ready");
