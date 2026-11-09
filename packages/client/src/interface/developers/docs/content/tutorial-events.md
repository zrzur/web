# Events

React to what happens in a server without commands: answer `!ping`, log reactions and members leaving.

> This tutorial uses `@zrzur/sdk/bot`, which you cannot download yet. See [SDKs](/developers/docs/sdk). Everything it does works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

Then switch on the **Message Content** intent for the bot in the Developer Portal: without it the bot gets messages without their text, and connecting with it asked for but off fails. See [Intents](/developers/docs/gateway#intents).

## The code

```example events.mjs

```

Run it with `node events.mjs`.

## Try it

Send `!ping` in a channel the bot can see.

## What it shows

- `Message` arrives for every new message the bot can see; skip your own and other bots' messages.
- `BeginTyping` shows the bot as typing.
- Editing the reply shows the round-trip time.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
