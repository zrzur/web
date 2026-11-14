# One bot, many servers

Per-server settings: `/prefix` sets a text-command prefix for one server only.

> This tutorial uses `@zrzur/sdk/bot`, which is not on npm yet. See [SDKs](/developers/docs/sdk). Everything it does works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

Then switch on the **Message Content** intent for the bot in the Developer Portal: without it the bot gets messages without their text, and connecting with it asked for but off fails. See [Intents](/developers/docs/gateway#intents).

## The code

```example multi-server.mjs

```

Run it with `node multi-server.mjs`.

## Try it

Run `/prefix value:?` in one server, then send `?where` there and `!where` in another server.

## What it shows

- `Ready` lists every channel with its server; `ChannelCreate` and `ServerCreate` add new ones.
- `ServerDelete` tells the bot it left or was removed: drop that server's settings.
- Keep settings in a database in production; this demo keeps them in memory.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
