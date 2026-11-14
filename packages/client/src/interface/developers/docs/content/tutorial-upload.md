# File upload

`/report` creates a CSV file and posts it.

> This tutorial uses `@zrzur/sdk/bot`, so run `npm install @zrzur/sdk` in your bot's folder first. See [SDKs](/developers/docs/sdk). Everything it does also works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## The code

```example upload.mjs

```

Run it with `node upload.mjs`.

## Try it

Run `/report`. The bot needs Upload Files in that channel.

## What it shows

- Files are uploaded to the file server first (tag `attachments`).
- The message then carries the returned id in `attachments`.
- `bot.messages.send(channel, { files })` does both steps.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
