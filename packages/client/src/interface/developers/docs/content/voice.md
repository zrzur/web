# Voice

Zrzur voice runs on LiveKit. The API hands out tickets; the audio itself goes through a LiveKit client.

## What works

| Capability                                                                       | Status                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Get a ticket for a voice channel (`POST /channels/{target}/join_call`)           | Supported, verified live with a bot token                                                                           |
| Connect to LiveKit with the ticket and **publish audio**                         | Supported. Verified end to end with `@livekit/rtc-node`: a second participant received and measured the bot's audio |
| Receive other participants' audio                                                | Possible with a LiveKit client; needs Listen. Not covered by our tests                                              |
| Move, mute and deafen members (`PATCH /servers/{server_id}/members/{member_id}`) | Supported with Move Members, Mute Members, Deafen Members                                                           |
| Video and screen sharing from a bot                                              | Not tested; tickets follow the Video permission                                                                     |
| `force_disconnect` when joining                                                  | Not for bots (`IsBot`)                                                                                              |

## Join

Ask for a ticket over plain HTTP:

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/join_call" \n  -H "x-bot-token: YOUR_BOT_TOKEN" \n  -H "content-type: application/json" \n  -d '{}'
# answer: { "token": "LIVEKIT_TOKEN", "url": "wss://voice.zrzur.com" }
```

Then connect with a LiveKit client. With the SDK (not published yet) and `@livekit/rtc-node`:

```js
const ticket = await bot.voice.join(channelId); // { url, token, node }
const room = new Room(); // from @livekit/rtc-node
await room.connect(ticket.url, ticket.token, { autoSubscribe: false });
```

Then create an `AudioSource` at 48 kHz, wrap it in a `LocalAudioTrack`, publish it with `room.localParticipant.publishTrack(...)` and feed it 10 ms frames. Other members see `VoiceChannelJoin` when the bot is in the room.

The bot needs Connect to join and Speak to be heard. `GET /` lists the voice nodes under `features.livekit.nodes`.

The [voice tutorial](/developers/docs/tutorial-voice) has a complete `/join` command.

## Reference

```endpoints voice

```
