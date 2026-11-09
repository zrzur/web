# Voice

`/join` gets a voice ticket and, with `@livekit/rtc-node` installed, connects to the voice channel.

> This tutorial uses `@zrzur/sdk/bot`, which you cannot download yet. See [SDKs](/developers/docs/sdk). Everything it does works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## The code

```example voice.mjs

```

Run it with `node voice.mjs`.

## Try it

Run `/join channel:#voice`. The bot needs Connect (and Speak to be heard).

## What it shows

- `POST /channels/{target}/join_call` returns the LiveKit address and a token.
- The audio itself goes through LiveKit; see [Voice](/developers/docs/voice) for publishing audio.
- Our live test covers the ticket step of this file; publishing audio was verified separately with a real LiveKit server.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
