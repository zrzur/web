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
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/join_call" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
# answer: { "token": "LIVEKIT_TOKEN", "url": "wss://voice.zrzur.com" }
```

Then connect with a LiveKit client. With the SDK and `@livekit/rtc-node`:

```js
const ticket = await bot.voice.join(channelId); // { url, token, node }
const room = new Room(); // from @livekit/rtc-node
await room.connect(ticket.url, ticket.token, { autoSubscribe: false });
```

Then create an `AudioSource` at 48 kHz, wrap it in a `LocalAudioTrack`, publish it with `room.localParticipant.publishTrack(...)` and feed it 10 ms frames. Other members see `VoiceChannelJoin` when the bot is in the room.

The bot needs Connect to join and Speak to be heard. `GET /` lists the voice nodes under `features.livekit.nodes`.

The [voice tutorial](/developers/docs/tutorial-voice) has a complete `/join` command.

## Soundboard {#soundboard}

A bot that is in a call can play the server's sounds: `POST /channels/{target}/soundboard/{sound_id}`. It needs Use Soundboard and Speak there and must not be server-muted; on a stage only speakers play sounds. A few sounds every ten seconds (bucket `soundboard_play`). Everyone in the call gets `SoundboardPlay`. Adding and editing the sounds themselves is on the [Servers](/developers/docs/servers#soundboard) page.

## Stages {#stages}

A stage is a voice channel with speakers and listeners.

| Route | What it does | Needs |
| --- | --- | --- |
| `GET /channels/{target}/stage` | Topic, speakers and raised hands | |
| `PATCH /channels/{target}/stage` | Set or clear the topic | Mute Members |
| `PUT /channels/{target}/stage/speakers/{member}` | Give someone in the stage the floor; their hand goes down | Mute Members and a higher rank |
| `DELETE /channels/{target}/stage/speakers/{member}` | Send a speaker back to the listeners (or stop speaking yourself) | Mute Members and a higher rank, for others |
| `PUT /channels/{target}/stage/hand` | Ask to speak (once every 20 seconds) | Connect |
| `DELETE /channels/{target}/stage/hands/{member}` | Lower a raised hand | Mute Members, for others |
| `DELETE /channels/{target}/stage` | End the stage: everyone leaves and topic, speakers and hands are cleared | Mute Members and Move Members |

The gateway sends `StageUpdate` with only what changed (`StageChange`). A stage has at most a few speakers at once (`TooManySpeakers`).

## Stream previews {#stream-previews}

`GET /channels/{target}/stream_preview/{member}` returns the latest still of someone's screen share in a voice channel the bot can see (needs View Channel and Listen). A bot that shares its own screen sends one with `PUT /channels/{target}/stream_preview`: a JPEG or WebP of at most 20 KB, base64, at most every 25 seconds (`NoEffect` before that).

## Clips and recordings {#capture}

A voice room can have clips and recorded episodes. Every voice is included only by its owner's choice, and everyone who sees the room is told.

| Route | What it does | Needs |
| --- | --- | --- |
| `GET /channels/{target}/capture` | Whether clips are on or a recording runs, who is included, what is left this month | |
| `PUT /channels/{target}/capture/consent` | Choose whether your own voice may be in clips and the recording, until you leave the room | Being in the room |
| `PUT /channels/{target}/capture/clips` | Turn clips on or off | Manage Channel, being in the room |
| `POST /channels/{target}/capture/clips` | Share a clip: upload the audio first (tag `attachments`), then name it here with everyone whose voice is in it | Being in the room, clips on |
| `POST /channels/{target}/capture/recording` | Start recording an episode | Manage Channel; the server needs recording time left (by its Wings level) |
| `DELETE /channels/{target}/capture/recording` | Stop without saving | Who started it, or Manage Channel |
| `POST /channels/{target}/capture/recording/finish` | Save the recording you started as an episode (upload the audio first) | Who started it |
| `GET /channels/{target}/capture/items` | The clips and episodes of the room, newest first | |
| `DELETE /channels/{target}/capture/items/{id}` | Remove a clip or an episode with its message and file | Who saved it, anyone whose voice is in it, or Manage Messages |

The gateway sends `VoiceCaptureUpdate` with the whole state. Errors to expect: `VoiceNotAgreed` (someone named did not agree), `TooManyVoiceClips` and `RecordingTimeUsedUp`.

## Reference

```endpoints voice

```
