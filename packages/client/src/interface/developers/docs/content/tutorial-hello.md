# Hello World

A bot that answers `/hello`. Two versions: one with the SDK, and one without any library, to show the protocol.

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## With the SDK

Run `npm install @zrzur/sdk` in your bot's folder (Node 22.3 or newer), then save this file there:

```example hello.mjs

```

Run it with `node hello.mjs`.

## Without a library

Node 22 or newer, nothing to install. This is the same bot:

```example hello-raw.mjs

```

Run it with `node hello-raw.mjs`.

## Try it

Type `/hello` in a channel of your test server.

## What it shows

- `GET /users/@me` tells the bot its own id; for bots, the application id is the same.
- `PUT /applications/{application_id}/commands` registers the command list.
- The gateway delivers `InteractionCreate`; the bot answers through the interaction callback within 3 seconds.
- `Bulk` packets are unpacked, and a `Ping` keeps the connection open.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
