# Welcome messages

Greets new members in a channel the server picks with `/welcome-here`.

> This tutorial uses `@zrzur/sdk/bot`, which is not on npm yet. See [SDKs](/developers/docs/sdk). Everything it does works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

Then switch on the **Server Members** intent for the bot in the Developer Portal: without it the bot never hears of new members, and connecting with it asked for but off fails. See [Intents](/developers/docs/gateway#intents).

## The code

```example welcome.mjs

```

Run it with `node welcome.mjs`.

## Try it

Run `/welcome-here` in a channel (needs Manage Server), then invite someone.

## What it shows

- `ServerMemberJoin` arrives when someone joins a server the bot is in.
- Settings are keyed by server id, so one bot serves many servers.
- Losing the permission to write is handled quietly.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
