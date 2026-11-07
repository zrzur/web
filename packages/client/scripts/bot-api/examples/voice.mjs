// Voice: `/join` gets a ticket for the caller's voice channel. Audio goes
// through LiveKit; with `@livekit/rtc-node` installed the bot connects and
// can publish an audio track. Without it, the bot only shows the ticket step.

import { Client } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

bot.command("join", async (i) => {
  const channel = i.option("channel");
  await i.defer({ ephemeral: true });

  // POST /channels/{id}/join_call → { url, token } (needs Connect)
  const ticket = await bot.voice.join(channel);

  let livekit;
  try {
    livekit = await import("@livekit/rtc-node");
  } catch {
    return i.editReply(
      `Got a voice ticket for node ${ticket.node}. Install @livekit/rtc-node to connect.`,
    );
  }
  const room = new livekit.Room();
  await room.connect(ticket.url, ticket.token, { autoSubscribe: false });
  // publish audio: create an AudioSource, a LocalAudioTrack from it, then
  // room.localParticipant.publishTrack(track, options) and feed 48 kHz frames
  await i.editReply("Joined the voice channel.");
});

await bot.login();
await bot.syncCommands([
  {
    name: "join",
    description: "Join a voice channel",
    options: [
      {
        type: "Channel",
        name: "channel",
        description: "Voice channel",
        required: true,
        channel_types: ["Voice"],
      },
    ],
  },
]);
console.log("ready");
