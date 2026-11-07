// Moderation: /timeout and /purge. The server checks the bot's own
// permissions and role order; the bot checks the person who asked, using the
// permissions that come with every interaction.

import { ApiError, Client } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

// Permission bits (see "Roles and permissions")
const TIMEOUT_MEMBERS = 1n << 8n;
const MANAGE_MESSAGES = 1n << 23n;

/** Does the invoking member hold `bit` in this channel? */
const can = (i, bit) => (BigInt(i.raw.user_permissions) & bit) === bit;

function refuse(i, error) {
  const text =
    error instanceof ApiError &&
    ["MissingPermission", "NotElevated"].includes(error.type)
      ? "I am not allowed to do that here (check my role and its position)."
      : "Something went wrong.";
  return i.acknowledged
    ? i.editReply(text)
    : i.reply({ content: text, ephemeral: true });
}

bot.command("timeout", async (i) => {
  if (!can(i, TIMEOUT_MEMBERS))
    return i.reply({ content: "You need Timeout Members.", ephemeral: true });
  const user = i.option("user");
  const minutes = i.option("minutes") ?? 10;
  try {
    await bot.members.timeout(i.serverId, user, minutes * 60);
    await i.reply({
      content: `<@${user}> is timed out for ${minutes} minutes.`,
      ephemeral: true,
    });
  } catch (error) {
    await refuse(i, error);
  }
});

bot.command("purge", async (i) => {
  if (!can(i, MANAGE_MESSAGES))
    return i.reply({ content: "You need Manage Messages.", ephemeral: true });
  await i.defer({ ephemeral: true });
  try {
    const messages = await bot.messages.fetchMany(i.channelId, {
      limit: i.option("count") ?? 10,
    });
    // bulk delete only takes messages younger than a week
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const ids = messages
      .filter((m) => idTime(m._id) > weekAgo)
      .map((m) => m._id);
    if (ids.length) await bot.messages.bulkDelete(i.channelId, ids);
    await i.editReply(`Deleted ${ids.length} messages.`);
  } catch (error) {
    await refuse(i, error);
  }
});

/** Milliseconds encoded in the first 10 characters of an id (ULID) */
function idTime(id) {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  return [...id.slice(0, 10)].reduce(
    (time, char) => time * 32 + alphabet.indexOf(char),
    0,
  );
}

await bot.login();
await bot.syncCommands([
  {
    name: "timeout",
    description: "Time out a member",
    options: [
      { type: "User", name: "user", description: "Member", required: true },
      {
        type: "Integer",
        name: "minutes",
        description: "Minutes",
        min_value: 1,
        max_value: 10080,
      },
    ],
  },
  {
    name: "purge",
    description: "Delete recent messages",
    options: [
      {
        type: "Integer",
        name: "count",
        description: "How many",
        min_value: 1,
        max_value: 100,
      },
    ],
  },
]);
console.log("ready");
