# Hello World

A bot that answers `/hello`. Two versions: one without any library, to show the protocol, and one with the SDK.

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## Without a library

Node 22 or newer, nothing to install.

```example hello-raw.mjs

```

Run it with `node hello-raw.mjs`.

## With the SDK

`@zrzur/sdk` is not on npm yet, see [SDKs](/developers/docs/sdk). When you have it, this is the same bot:

```example hello.mjs

```

Run it with `node hello.mjs`.

## Try it

Type `/hello` in a channel of your test server.

## What it shows

- `GET /users/@me` tells the bot its own id; for bots, the application id is the same.
- `PUT /applications/{application_id}/commands` registers the command list.
- The gateway delivers `InteractionCreate`; the bot answers through the interaction callback within 3 seconds.
- `Bulk` packets are unpacked, and a `Ping` keeps the connection open.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
