// File upload: `/report` writes a small CSV and attaches it to a message.
// Files go to the file server first (tag "attachments"); the message then
// carries the returned file ids.

import { Client } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

bot.command("report", async (i) => {
  await i.defer();
  const csv = `user,when\n${i.user.username},${new Date().toISOString()}\n`;

  // 1. upload: POST {files}/attachments with the bot token, returns { id }
  const fileId = await bot.rest.uploadFile(
    "attachments",
    new TextEncoder().encode(csv),
    "report.csv",
    "text/csv",
  );

  // 2. send a message that carries the file id
  await bot.rest.req("post", `/channels/${i.channelId}/messages`, {
    content: "Here is your report.",
    attachments: [fileId],
  });
  await i.editReply("Report posted.");

  // Shortcut: bot.messages.send(channelId, { files: [{ name, data, type }] })
  // does both steps.
});

await bot.login();
await bot.syncCommands([{ name: "report", description: "Post a CSV report" }]);
console.log("ready");
